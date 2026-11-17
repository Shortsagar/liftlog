// App-level data access on top of the store (sessions cache, draft, starting workouts).
import { app, go } from './state.js';
import { newSession } from './workout.js';
import { confirmDialog } from './ui.js';

let cache = null;
const hooks = [];

export async function allSessions() {
  if (!cache) cache = (await app.db.all('sessions')).sort((a, b) => b.date - a.date);
  return cache;
}
export const invalidate = () => { cache = null; };
export async function getSession(id) { return app.db.get('sessions', id); }

export async function saveSession(s) {
  await app.db.put('sessions', s);
  cache = null;
  for (const fn of hooks) await fn(s);
}
export async function deleteSession(id) { await app.db.del('sessions', id); cache = null; }

/** Register a callback run after a finished session is saved (e.g. plan advancement). */
export const onSessionSaved = fn => hooks.push(fn);

export const getDraft = () => app.db.kvGet('draft', null);
export const setDraft = d => app.db.kvSet('draft', d);

/** spec = { name, planRef?, exercises:[{exId, sets, reps}] } */
export async function startWorkout(spec) {
  const existing = await getDraft();
  if (existing) {
    const ok = await confirmDialog(`"${existing.name}" is still in progress. Discard it and start "${spec.name}"?`, { ok: 'Discard & start', danger: true });
    if (!ok) { go('#/log'); return; }
    await app.db.kvSet('rest', null);
  }
  await setDraft(newSession(spec, await allSessions()));
  go('#/log');
}
