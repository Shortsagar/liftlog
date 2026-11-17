let leave = null;
export const onLeave = fn => { leave = fn; };
export async function leaveView() {
  if (!leave) return;
  await leave();
  leave = null;
}
const disposers = new WeakMap();
export function onDispose(node, fn) { disposers.set(node, fn); return fn; }
export function disposeTree(node) {
  for (const child of [...node.children || []]) disposeTree(child);
  const fn = disposers.get(node);
  disposers.delete(node);
  fn?.();
}
// Serial execution gives each view ownership of its cleanup callback; the token
// prevents an older async render from mounting after a newer navigation request.
export function latestRunner() {
  let generation = 0, chain = Promise.resolve();
  return job => {
    const id = ++generation;
    const current = () => id === generation;
    const result = chain.catch(() => {}).then(() => current() ? job(current) : undefined);
    chain = result;
    return result;
  };
}

/** History steps needed to return to the rendered entry after a blocked navigation.
 *  Entries this app rendered carry {idx}; a freshly pushed entry has no state. */
export function revertDelta(state, renderedIdx) {
  return state && Number.isInteger(state.idx) ? renderedIdx - state.idx : -1;
}
