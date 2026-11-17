// Transactions are synchronous callbacks over an isolated snapshot. A callback must not
// await: IndexedDB commits only while its native transaction remains active.
export const STORES = ['sessions', 'plans', 'bodyweight', 'kv'];
const clone = v => v === undefined ? undefined : structuredClone(v);
const empty = () => Object.fromEntries(STORES.map(s => [s, []]));
export const installationScope = () => typeof location === 'undefined' ? '/' : new URL('../', import.meta.url).pathname;

function transactionView(data, stores, partial = new Set()) {
  const changes = [];
  const check = s => { if (!stores.includes(s)) throw new Error(`Store ${s} is outside this transaction`); };
  const api = {
    get(s, id) { check(s); return clone(data[s].find(x => x.id === id)); },
    all(s) {
      check(s);
      if (partial.has(s)) throw new Error(`Store ${s} was only partially read in this transaction`);
      return clone(data[s]);
    },
    put(s, obj) {
      check(s);
      if (!obj || typeof obj.id !== 'string' || !obj.id) throw new Error('Record requires an id');
      const value = clone(obj), i = data[s].findIndex(x => x.id === obj.id);
      if (i < 0) data[s].push(value); else data[s][i] = value;
      changes.push({ store: s, type: 'put', value });
    },
    del(s, id) { check(s); data[s] = data[s].filter(x => x.id !== id); changes.push({ store: s, type: 'delete', value: id }); },
    clear(s) { check(s); data[s] = []; changes.push({ store: s, type: 'clear' }); },
  };
  return { api, changes };
}
function invoke(fn, api) {
  const result = fn(api);
  if (result && typeof result.then === 'function') throw new Error('Storage transaction callbacks must be synchronous');
  return result;
}
function backend(kind, atomic, snapshot) {
  return {
    kind, atomic, snapshot,
    get: async (s, id) => (await snapshot([s]))[s].find(x => x.id === id),
    all: async s => (await snapshot([s]))[s],
    put: async (s, obj) => { await atomic([s], tx => tx.put(s, obj)); return obj; },
    del: (s, id) => atomic([s], tx => tx.del(s, id)),
    clear: () => atomic(STORES, tx => STORES.forEach(s => tx.clear(s))),
    replace: data => atomic(STORES, tx => { for (const s of STORES) { tx.clear(s); for (const x of data[s]) tx.put(s, x); } }),
  };
}
export function memoryBackend() {
  let data = empty();
  return backend('memory', async (stores, fn) => {
    const next = clone(data), { api } = transactionView(next, stores);
    const result = invoke(fn, api); data = next; return result;
  }, async () => clone(data));
}
export function localBackend(ls = globalThis.localStorage, prefix = 'liftlog:') {
  const key = prefix + 'database';
  const read = () => {
    const raw = ls.getItem(key);
    if (raw !== null && raw !== undefined) {
      const data = JSON.parse(raw);
      if (!data || !STORES.every(s => Array.isArray(data[s]))) throw new Error('Local storage is damaged. Export or recover it before continuing.');
      return data;
    }
    // Old versions used one object per store. Read without swallowing corruption.
    const data = empty();
    for (const s of STORES) {
      const old = JSON.parse(ls.getItem(prefix + s) || '{}');
      if (!old || Array.isArray(old) || typeof old !== 'object') throw new Error(`Damaged ${s} storage`);
      data[s] = Object.values(old);
    }
    return data;
  };
  return backend('localStorage', async (stores, fn) => {
    const commit = () => {
      const data = read(), { api } = transactionView(data, stores);
      const result = invoke(fn, api);
      // A single setItem either succeeds completely or leaves the old snapshot intact.
      ls.setItem(key, JSON.stringify(data));
      // The snapshot now holds everything; drop the pre-snapshot per-store copies so quota isn't spent twice.
      for (const st of STORES) if (ls.getItem(prefix + st) !== null) ls.removeItem(prefix + st);
      return result;
    };
    // Coordinate read/modify/write across tabs on browsers with Web Locks.
    return typeof window !== 'undefined' && globalThis.navigator?.locks ? navigator.locks.request(key, commit) : commit();
  }, async () => read());
}
async function idbOpen(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => STORES.forEach(s => { if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: 'id' }); });
    let blocked = false;
    req.onsuccess = () => {
      if (blocked) { req.result.close(); return; }
      req.result.onversionchange = () => req.result.close(); resolve(req.result);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => { blocked = true; reject(new Error('Close other LiftLog windows to upgrade storage')); };
  });
}
export async function idbBackend(name = 'liftlog') {
  const db = await idbOpen(name);
  // keys: optional { store: [ids] } — read only those records instead of the whole store
  // (finishing a workout must not load every past session).
  const run = (stores, fn, mode, keys) => new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode), data = empty(), partial = new Set();
    let result, error, remaining = 0;
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () => reject(error || tx.error || new Error('Storage transaction aborted'));
    const proceed = () => {
      try {
        if (!fn) { result = data; return; }
        const { api, changes } = transactionView(data, stores, partial);
        result = invoke(fn, api);
        for (const c of changes) tx.objectStore(c.store)[c.type](...(c.type === 'clear' ? [] : [c.value]));
      } catch (e) { error = e; tx.abort(); }
    };
    const done = () => { if (--remaining === 0) proceed(); };
    for (const s of stores) {
      const st = tx.objectStore(s);
      if (Array.isArray(keys?.[s])) {
        partial.add(s);
        for (const id of keys[s]) { remaining++; const req = st.get(id); req.onsuccess = () => { if (req.result !== undefined) data[s].push(req.result); done(); }; }
      } else {
        remaining++;
        const req = st.getAll();
        req.onsuccess = () => { data[s] = req.result; done(); };
      }
    }
    if (remaining === 0) proceed();
  });
  const b = backend('indexedDB', (stores, fn, opts) => run(stores, fn, 'readwrite', opts?.keys), (stores = STORES) => run(stores, null, 'readonly'));
  // Individual reads should use the object-store key rather than loading history.
  b.get = (s, id) => new Promise((resolve, reject) => {
    const tx = db.transaction(s), req = tx.objectStore(s).get(id);
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Storage read failed'));
  });
  const mutate = (s, type, value) => new Promise((resolve, reject) => {
    const tx = db.transaction(s, 'readwrite');
    tx.oncomplete = () => resolve(value);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Storage write failed'));
    try { tx.objectStore(s)[type](value); } catch (e) { tx.abort(); reject(e); }
  });
  b.put = (s, obj) => mutate(s, 'put', obj);
  b.del = (s, id) => mutate(s, 'delete', id);
  b.close = () => db.close();
  return b;
}
/** legacy: a backend, or an async function that opens one (only called if migration is still needed). */
export async function migrateLegacy(b, legacySource, scope) {
  if (await b.get('kv', '__scopeMigrated')) return;
  const legacy = typeof legacySource === 'function' ? await legacySource() : legacySource;
  try {
    const data = await legacy.atomic(STORES, tx => {
      const owner = tx.get('kv', '__scopeOwner');
      if (owner && owner.value !== scope) return null;
      tx.put('kv', { id: '__scopeOwner', value: scope });
      return Object.fromEntries(STORES.map(s => [s, tx.all(s)]));
    });
    await b.atomic(STORES, tx => {
      // Never replace records already created in the scoped database.
      if (data) for (const s of STORES) for (const x of data[s]) if (!tx.get(s, x.id)) tx.put(s, x);
      tx.put('kv', { id: '__scopeMigrated', value: true });
    });
  } finally { legacy.close?.(); }
}
async function pickBackend() {
  const scope = installationScope(), suffix = scope === '/' ? '' : ':' + encodeURIComponent(scope);
  let b;
  if (globalThis.indexedDB) {
    // Do not hide an existing database behind another backend on transient errors.
    b = await idbBackend('liftlog' + suffix);
    if (suffix) await migrateLegacy(b, () => idbBackend(), scope);
    else await b.put('kv', { id: '__scopeOwner', value: scope });
    return b;
  }
  let ls;
  try { ls = globalThis.localStorage; } catch { /* unavailable */ }
  if (ls) {
    b = localBackend(ls, 'liftlog' + suffix + ':');
    // A failed write must remain an actionable error, not silently switch to memory.
    if (suffix) await migrateLegacy(b, () => localBackend(ls), scope);
    else await b.put('kv', { id: '__scopeOwner', value: scope });
    return b;
  }
  return memoryBackend();
}
export async function openStore(provided) {
  const b = provided || await pickBackend();
  return { ...b,
    resetUserData: () => b.atomic(STORES, tx => {
      const metadata = tx.all('kv').filter(x => x.id.startsWith('__'));
      for (const s of STORES) tx.clear(s);
      for (const item of metadata) tx.put('kv', item);
    }),
    async kvGet(key, dflt) { const r = await b.get('kv', key); return r === undefined ? dflt : r.value; },
    async kvSet(key, value) { await b.put('kv', { id: key, value }); return value; },
  };
}
