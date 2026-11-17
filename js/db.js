// Storage layer: IndexedDB with a localStorage fallback (and an in-memory backend for tests).
// Every backend implements: get(store,id) put(store,obj) del(store,id) all(store) clear()
// Objects are keyed by their `id` field.

export const STORES = ['sessions', 'plans', 'bodyweight', 'kv'];
const DB_NAME = 'liftlog';
const DB_VERSION = 1;

const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export function memoryBackend() {
  const data = Object.fromEntries(STORES.map(s => [s, new Map()]));
  return {
    kind: 'memory',
    async get(s, id) { return clone(data[s].get(id)); },
    async put(s, obj) { data[s].set(obj.id, clone(obj)); return obj; },
    async del(s, id) { data[s].delete(id); },
    async all(s) { return [...data[s].values()].map(clone); },
    async clear() { STORES.forEach(s => data[s].clear()); },
  };
}

export function localBackend(ls = globalThis.localStorage, prefix = 'liftlog:') {
  const read = s => { try { return JSON.parse(ls.getItem(prefix + s) || '{}'); } catch { return {}; } };
  const write = (s, o) => ls.setItem(prefix + s, JSON.stringify(o));
  return {
    kind: 'localStorage',
    async get(s, id) { return read(s)[id]; },
    async put(s, obj) { const o = read(s); o[obj.id] = obj; write(s, o); return obj; },
    async del(s, id) { const o = read(s); delete o[id]; write(s, o); },
    async all(s) { return Object.values(read(s)); },
    async clear() { STORES.forEach(s => ls.removeItem(prefix + s)); },
  };
}

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

export async function idbBackend() {
  const db = await idbOpen();
  const run = (s, mode, fn) => new Promise((resolve, reject) => {
    const tx = db.transaction(s, mode);
    const req = fn(tx.objectStore(s));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return {
    kind: 'indexedDB',
    get: (s, id) => run(s, 'readonly', st => st.get(id)),
    put: async (s, obj) => { await run(s, 'readwrite', st => st.put(obj)); return obj; },
    del: (s, id) => run(s, 'readwrite', st => st.delete(id)),
    all: (s) => run(s, 'readonly', st => st.getAll()),
    clear: () => new Promise((resolve, reject) => {
      const tx = db.transaction(STORES, 'readwrite');
      STORES.forEach(s => tx.objectStore(s).clear());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }),
  };
}

async function pickBackend() {
  try {
    if (globalThis.indexedDB) return await idbBackend();
  } catch (e) { console.warn('IndexedDB unavailable, using localStorage', e); }
  try {
    if (globalThis.localStorage) { localStorage.setItem('liftlog:probe', '1'); return localBackend(); }
  } catch { /* private mode etc. */ }
  console.warn('No persistent storage available; data will not survive reload');
  return memoryBackend();
}

export async function openStore(backend) {
  const b = backend || await pickBackend();
  return {
    kind: b.kind,
    get: b.get, put: b.put, del: b.del, all: b.all, clear: b.clear,
    async kvGet(key, dflt) { const r = await b.get('kv', key); return r === undefined ? dflt : r.value; },
    async kvSet(key, value) { await b.put('kv', { id: key, value }); return value; },
  };
}
