// Plans persistence + active-plan state. Custom plans live in the 'plans' store; built-ins in data/plans.js.
import { app } from './state.js';
import { PLANS, builtInPlan } from '../data/plans.js';
import { startPlan, skip, currentDay } from './plans.js';
import { startWorkout } from './repo.js';

export async function getPlan(id) { return builtInPlan(id) || app.db.get('plans', id); }
export async function customPlans() { return (await app.db.all('plans')).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); }
export async function allPlans() { return [...PLANS, ...(await customPlans())]; }
export async function savePlan(p) {
  p = { ...p, updatedAt: Date.now() };
  await app.db.atomic(['plans', 'kv'], tx => {
    const old = tx.get('plans', p.id);
    const active = tx.get('kv', 'activePlan')?.value;
    const draft = tx.get('kv', 'draft')?.value;
    if (old && (active?.planId === p.id || draft?.planRef?.planId === p.id) && JSON.stringify(old.weeks) !== JSON.stringify(p.weeks)) {
      p.id = p.id.replace(/-revision-[0-9a-f-]{36}$/, '') + '-revision-' + crypto.randomUUID();
    }
    tx.put('plans', p);
  }, { keys: { plans: [p.id], kv: ['activePlan', 'draft'] } });
  return p;
}
export async function deletePlan(id) {
  await app.db.atomic(['plans', 'kv'], tx => {
    tx.del('plans', id);
    if (tx.get('kv', 'activePlan')?.value?.planId === id) tx.put('kv', { id: 'activePlan', value: null });
  }, { keys: { plans: [], kv: ['activePlan'] } });
}

export const getActive = () => app.db.kvGet('activePlan', null);
export const setActive = a => app.db.kvSet('activePlan', a);

export async function activate(plan) { const a = startPlan(plan); await setActive(a); return a; }
export async function skipDay() {
  const a = await getActive(); if (!a) return;
  const plan = await getPlan(a.planId); if (!plan) return;
  await setActive(skip(plan, a));
}

/** Active plan + its plan + today's day, or null. */
export async function activeContext() {
  const active = await getActive();
  if (!active) return null;
  const plan = await getPlan(active.planId);
  if (!plan) return null;
  return { active, plan, today: currentDay(plan, active) };
}

export function startPlanDay(plan, week, day) {
  const d = plan.weeks[week].days[day];
  return startWorkout({ name: d.name, planRef: { planId: plan.id, week, day }, exercises: d.exercises });
}
