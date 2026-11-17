// Transactional workout persistence and fresh history snapshots.
import { app, go } from './state.js';
import * as rest from './timer.js';
import { newSession } from './workout.js';
import { complete } from './plans.js';
import { builtInPlan } from '../data/plans.js';
import { confirmDialog } from './ui.js';


export async function allSessions() {
  return (await app.db.all('sessions')).sort((a, b) => b.date - a.date);
}
export async function getSession(id) { return app.db.get('sessions', id); }

export async function saveSession(s) {
  // Read only the records this commit depends on; never load the whole history.
  const planId = (await app.db.kvGet('activePlan', null))?.planId;
  const keys = { sessions: [], kv: ['draft', 'activePlan'], plans: planId && !builtInPlan(planId) ? [planId] : [] };
  await app.db.atomic(['sessions', 'kv', 'plans'], tx => {
    const current = tx.get('kv', 'draft')?.value;
    if (!current || current.id !== s.id) throw new Error('This workout changed in another window. Reload before saving.');
    const active = tx.get('kv', 'activePlan')?.value, ref = s.planRef;
    if (active && active.planId !== planId) throw new Error('Your plan changed in another window. Please retry.');
    if (active && ref && active.planId === ref.planId) {
      const plan = builtInPlan(active.planId) || tx.get('plans', active.planId);
      if (plan?.weeks[ref.week]?.days[ref.day]) tx.put('kv', { id: 'activePlan', value: complete(plan, active, ref, s.id) });
    }
    tx.put('sessions', s);
    tx.put('kv', { id: 'draft', value: null });
    tx.put('kv', { id: 'rest', value: null });
  }, { keys });
}
export async function deleteSession(id) { await app.db.del('sessions', id); }

export const getDraft = () => app.db.kvGet('draft', null);
export const setDraft = d => app.db.atomic(['kv'], tx => {
  const current = tx.get('kv', 'draft')?.value;
  if (d && current?.id !== d.id) throw new Error('This workout changed in another window. Export your changes before reloading.');
  tx.put('kv', { id: 'draft', value: d });
}, { keys: { kv: ['draft'] } });

/** spec = { name, planRef?, exercises:[{exId, sets, reps}] } */
export async function startWorkout(spec) {
  const existing = await getDraft();
  if (existing) {
    const ok = await confirmDialog(`"${existing.name}" is still in progress. Discard it and start "${spec.name}"?`, { ok: 'Discard & start', danger: true });
    if (!ok) { go('#/log'); return; }
  }
  const draft = newSession(spec, await allSessions());
  await app.db.atomic(['kv'], tx => {
    const current = tx.get('kv', 'draft')?.value;
    if ((current?.id || null) !== (existing?.id || null)) throw new Error('Another window changed the workout. Please retry.');
    tx.put('kv', { id: 'draft', value: draft });
    tx.put('kv', { id: 'rest', value: null });
  }, { keys: { kv: ['draft'] } });
  rest.stop({ persist: false });
  go('#/log');
}
