import { byId } from '../data/exercises.js';
import { builtInPlan } from '../data/plans.js';
import { finite, integer, record, text, timestamp, repTarget, validPlan } from './validation.js';
// Backup: export every store to one JSON object; import validates fully BEFORE replacing anything.
export const BACKUP_VERSION = 1;
const STORES = ['sessions', 'plans', 'bodyweight', 'kv'];

export async function exportAll(db, now = Date.now()) {
  const out = { app: 'liftlog', version: BACKUP_VERSION, exportedAt: now };
  const data = await db.snapshot();
  for (const s of STORES) out[s] = data[s];
  out.kv = out.kv.filter(x => !x.id.startsWith('__'));
  return out;
}

const optional = (v, check) => v == null || check(v);
const validRef = r => r == null || (record(r) && text(r.planId) && integer(r.week, 0, 51) && integer(r.day, 0, 13));
const validSet = s => record(s) && optional(s.w, v => finite(v, 0, 1e6)) && optional(s.r, v => integer(v, 0, 1e6)) && typeof s.done === 'boolean';
const validSession = s => record(s) && timestamp(s.date) && text(s.name) && optional(s.notes, text) && validRef(s.planRef) &&
  optional(s.endedAt, timestamp) && optional(s.durationSec, v => finite(v)) && optional(s.sample, v => typeof v === 'boolean') &&
  Array.isArray(s.exercises) && s.exercises.length <= 100 && s.exercises.every(e => record(e) && !!byId(e.exId) && optional(e.notes, text) &&
    optional(e.target, t => record(t) && optional(t.sets, v => integer(v, 1, 100)) && optional(t.reps, repTarget)) &&
    Array.isArray(e.sets) && e.sets.length <= 100 && e.sets.every(validSet) && optional(e.last, v => Array.isArray(v) && v.length <= 100 && v.every(validSet))) &&
  optional(s.prs, ps => Array.isArray(ps) && ps.every(p => record(p) && !!byId(p.exId) && ['weight','e1rm','reps'].includes(p.type) && finite(p.value) && finite(p.prev)));
function validSettings(s) {
  if (!record(s)) return false;
  const checks = {
    unit: v => ['lb','kg'].includes(v), theme: v => ['dark','light','system'].includes(v),
    incLb: v => [2.5,5].includes(v), incKg: v => [1.25,2.5].includes(v), restSec: v => integer(v,15,600),
    autoRest: v => typeof v === 'boolean', sound: v => typeof v === 'boolean', vibrate: v => typeof v === 'boolean', showDemos: v => typeof v === 'boolean',
    lastBackupAt: v => v === null || timestamp(v),
  };
  return Object.entries(s).every(([k,v]) => Object.hasOwn(checks, k) && checks[k](v));
}
/** Validate all nested data before starting the replacement transaction. */
export function validateBackup(obj) {
  if (!record(obj)) return 'not a JSON object';
  if (obj.app !== 'liftlog') return 'not a LiftLog file';
  if (obj.version !== BACKUP_VERSION) return `unsupported version ${obj.version}`;
  for (const s of STORES) {
    if (!Array.isArray(obj[s]) || obj[s].length > 100000) return `missing or oversized ${s}`;
    if (obj[s].some(x => !record(x) || typeof x.id !== 'string' || !x.id || x.id.length > 200)) return `${s} has an entry without a valid id`;
    if (new Set(obj[s].map(x => x.id)).size !== obj[s].length) return `${s} has duplicate ids`;
  }
  if (!timestamp(obj.exportedAt)) return 'invalid export date';
  if (!obj.sessions.every(validSession)) return 'invalid session or set';
  if (!obj.plans.every(p => validPlan(p) && !builtInPlan(p.id))) return 'invalid custom plan';
  if (!obj.bodyweight.every(b => timestamp(b.date) && finite(b.kg, 1, 1000) && optional(b.sample, v => typeof v === 'boolean'))) return 'invalid weigh-in';
  for (const { id, value: v } of obj.kv) {
    if (id === 'settings') { if (!validSettings(v)) return 'invalid settings'; }
    else if (id === 'draft') { if (v !== null && (!validSession(v) || typeof v.id !== 'string' || !v.id)) return 'invalid draft'; }
    else if (id === 'rest') { if (v !== null && (!record(v) || !timestamp(v.endsAt) || !finite(v.total, 0, 86400))) return 'invalid timer'; }
    else if (id === 'activePlan') {
      if (v === null) continue;
      if (!validRef(v) || !record(v) || !Array.isArray(v.done) || !optional(v.startedAt, timestamp) || !optional(v.completedAt, timestamp)) return 'invalid active plan';
      const p = builtInPlan(v.planId) || obj.plans.find(p => p.id === v.planId);
      const inPlan = r => validRef({ ...r, planId: v.planId }) && !!p?.weeks[r.week]?.days[r.day];
      if (!inPlan(v) || !v.done.every(d => record(d) && inPlan(d) && typeof d.sessionId === 'string') || new Set(v.done.map(d => `${d.week}:${d.day}`)).size !== v.done.length) return 'invalid plan progress';
    } else return `unknown setting ${id}`;
  }
  return null;
}

/** Replace all data with the backup. Throws without touching data if the file is invalid. */
export async function importAll(db, obj) {
  const problem = validateBackup(obj);
  if (problem) throw new Error(`Not a valid LiftLog backup (${problem})`);
  await db.atomic(STORES, tx => {
    for (const s of STORES) {
      const internal = s === 'kv' ? tx.all('kv').filter(x => x.id.startsWith('__')) : [];
      tx.clear(s);
      for (const item of [...obj[s], ...internal]) tx.put(s, item);
    }
  });
  return { sessions: obj.sessions.length, plans: obj.plans.length, bodyweight: obj.bodyweight.length };
}

export function backupFilename(now = Date.now()) {
  const d = new Date(now);
  const p = n => String(n).padStart(2, '0');
  return `liftlog-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

// Reject oversized files before allocating their text or parsing JSON.
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export async function readBackupFile(file) {
  if (!Number.isFinite(file.size) || file.size < 0 || file.size > MAX_BACKUP_BYTES) throw new Error('Backup must be 20 MB or smaller');
  let obj;
  try { obj = JSON.parse(await file.text()); } catch { throw new Error('That file is not valid JSON'); }
  const problem = validateBackup(obj);
  if (problem) throw new Error(`Not a LiftLog backup (${problem})`);
  return obj;
}
