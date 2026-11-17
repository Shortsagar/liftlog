import { byId } from '../data/exercises.js';
export const finite = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
export const integer = (v, min, max) => Number.isInteger(v) && finite(v, min, max);
export const record = v => !!v && typeof v === 'object' && !Array.isArray(v);
export const text = v => typeof v === 'string' && v.length <= 100000;
export const timestamp = v => finite(v, 0, 8640000000000000);
// Display-only text such as "8-12", "30s", "AMRAP" or "10+"; earlier versions stored free text, so stay permissive.
export const repTarget = v => (typeof v === 'number' && integer(v, 1, 9999)) || (typeof v === 'string' && v.trim().length > 0 && v.length <= 40);
export const validExerciseTarget = e => record(e) && !!byId(e.exId) && integer(e.sets, 1, 100) && repTarget(e.reps);
export const validPlan = p => record(p) && text(p.name) && p.name.trim().length > 0 && Array.isArray(p.weeks) && p.weeks.length >= 1 && p.weeks.length <= 52 &&
  p.weeks.every(w => record(w) && Array.isArray(w.days) && w.days.length >= 1 && w.days.length <= 14 && w.days.every(d => record(d) && text(d.name) && Array.isArray(d.exercises) && d.exercises.length >= 1 && d.exercises.length <= 100 && d.exercises.every(validExerciseTarget)));
export function localDate(value, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number), date = new Date(y, m - 1, d, 8);
  const today = new Date(now); today.setHours(23, 59, 59, 999);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d || !timestamp(date.getTime()) || date > today) return null;
  return date.getTime();
}
