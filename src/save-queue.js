// Serialized, coalescing writes. Edits within `delay` ms share one write of the latest snapshot,
// so typing "135" costs one storage transaction, not three. flush() writes any pending edit now.
// A failed write is reported and retained for retry; it does not poison later attempts.
export function saveQueue(write, status = () => {}, { delay = 0 } = {}) {
  let tail = Promise.resolve(), version = 0, pending = null;

  function start() {
    if (!pending) return tail;
    const job = pending, id = version;
    pending = null;
    clearTimeout(job.timer);
    tail = tail.catch(() => {}).then(() => write(job.value));
    tail.then(job.resolve, job.reject);
    tail.then(() => { if (id === version) status('Saved'); },
      e => { if (id === version) status('Not saved — retry or export before closing', e); });
    return tail;
  }

  return {
    save(value) {
      const snapshot = structuredClone(value);
      version++;
      status('Saving…');
      if (!pending) {
        let resolve, reject;
        const promise = new Promise((a, b) => { resolve = a; reject = b; });
        promise.catch(() => {}); // callers that don't await must not cause unhandled rejections
        pending = { promise, resolve, reject, timer: setTimeout(start, delay) };
      }
      pending.value = snapshot;
      return pending.promise;
    },
    flush() { return pending ? start() : tail; },
    reset() {
      if (pending) { clearTimeout(pending.timer); pending.resolve(); pending = null; }
      tail = Promise.resolve();
      version++;
    },
  };
}
