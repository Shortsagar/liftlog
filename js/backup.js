// Backup: export every store to one JSON object; import validates fully BEFORE replacing anything.
export const BACKUP_VERSION = 1;
const STORES = ['sessions', 'plans', 'bodyweight', 'kv'];

export async function exportAll(db, now = Date.now()) {
  const out = { app: 'liftlog', version: BACKUP_VERSION, exportedAt: now };
  for (const s of STORES) out[s] = await db.all(s);
  return out;
}

/** null if valid, else a short reason. */
export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') return 'not a JSON object';
  if (obj.app !== 'liftlog') return 'not a LiftLog file';
  if (typeof obj.version !== 'number' || obj.version > BACKUP_VERSION) return `unsupported version ${obj.version}`;
  for (const s of STORES) {
    if (!Array.isArray(obj[s])) return `missing ${s}`;
    if (obj[s].some(x => !x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id)) return `${s} has an entry without an id`;
  }
  return null;
}

/** Replace all data with the backup. Throws without touching data if the file is invalid. */
export async function importAll(db, obj) {
  const problem = validateBackup(obj);
  if (problem) throw new Error(`Not a valid LiftLog backup (${problem})`);
  await db.clear();
  for (const s of STORES) for (const item of obj[s]) await db.put(s, item);
  return { sessions: obj.sessions.length, plans: obj.plans.length, bodyweight: obj.bodyweight.length };
}

export function backupFilename(now = Date.now()) {
  const d = new Date(now);
  const p = n => String(n).padStart(2, '0');
  return `liftlog-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}
