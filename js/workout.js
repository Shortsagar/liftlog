// Building and finalizing workout sessions (pure).
import { lastPerformance } from './model.js';
import { byId } from '../data/exercises.js';

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Lower bound of a rep target: 5 → 5, "8-12" → 8, "30s" → 30. */
export function targetLow(reps) {
  if (reps == null) return null;
  const m = String(reps).match(/\d+/);
  return m ? Number(m[0]) : null;
}

export function defaultTarget(exId) {
  return byId(exId)?.metric === 'seconds' ? { sets: 3, reps: '30s' } : { sets: 3, reps: '8-12' };
}

/** One exercise entry, prefilled from history (else target reps, blank weight). */
export function makeEntry(exId, target, sessions) {
  target = target || defaultTarget(exId);
  const last = lastPerformance(sessions, exId);
  const n = target.sets || last?.length || 3;
  const sets = [];
  for (let i = 0; i < n; i++) {
    const src = last ? (last[i] || last[last.length - 1]) : null;
    sets.push(src ? { w: src.w, r: src.r, done: false } : { w: null, r: targetLow(target.reps), done: false });
  }
  return { exId, target: { sets: target.sets, reps: target.reps }, notes: '', last, sets };
}

/** spec = { name, planRef?, exercises: [{exId, sets, reps}] } */
export function newSession(spec, sessions, now = Date.now()) {
  return {
    id: newId(),
    date: now,
    endedAt: null,
    name: spec.name || 'Workout',
    planRef: spec.planRef || null,
    notes: '',
    exercises: (spec.exercises || []).map(e => makeEntry(e.exId, { sets: e.sets, reps: e.reps }, sessions)),
  };
}

export function addSet(entry) {
  const prev = entry.sets[entry.sets.length - 1];
  entry.sets.push(prev ? { w: prev.w, r: prev.r, done: false } : { w: null, r: targetLow(entry.target?.reps), done: false });
  return entry;
}

/** Saved session: done sets only, exercises with nothing done are dropped. */
export function finalizeSession(draft, now = Date.now()) {
  const exercises = draft.exercises
    .map(e => ({ exId: e.exId, notes: e.notes || '', target: e.target, sets: e.sets.filter(s => s.done && s.r > 0).map(s => ({ w: s.w, r: s.r, done: true })) }))
    .filter(e => e.sets.length);
  return {
    id: draft.id, date: draft.date, endedAt: now,
    durationSec: Math.round((now - draft.date) / 1000),
    name: draft.name, planRef: draft.planRef || null, notes: draft.notes || '',
    exercises,
  };
}

const same = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 1e-6);

/** After set j's `field` changes old→new, copy new into following undone sets that still held old.
 *  Stops at the first set that differs (the user set it on purpose) or is already done. Returns changed indices. */
export function propagate(sets, j, field, oldVal, newVal) {
  const changed = [];
  for (let k = j + 1; k < sets.length; k++) {
    if (sets[k].done || !same(sets[k][field], oldVal)) break;
    sets[k][field] = newVal;
    changed.push(k);
  }
  return changed;
}

/** Starting value for a +/- tap on a blank field: own value, else nearest earlier set's, else 0. */
export function stepBase(sets, j, field) {
  for (let k = j; k >= 0; k--) if (sets[k][field] != null) return sets[k][field];
  return 0;
}
