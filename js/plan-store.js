// Plans persistence + active-plan state. Custom plans live in the 'plans' store; built-ins in data/plans.js.
import { app } from './state.js';
import { PLANS, builtInPlan } from '../data/plans.js';
import { startPlan, complete, skip, currentDay } from './plans.js';
import { onSessionSaved, startWorkout } from './repo.js';

export async function getPlan(id) { return builtInPlan(id) || app.db.get('plans', id); }
export async function customPlans() { return (await app.db.all('plans')).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); }
export async function allPlans() { return [...PLANS, ...(await customPlans())]; }
export async function savePlan(p) { p.updatedAt = Date.now(); await app.db.put('plans', p); return p; }
export async function deletePlan(id) {
  await app.db.del('plans', id);
  const a = await getActive();
  if (a?.planId === id) await setActive(null);
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

// When a workout that belongs to the active plan is saved, mark that day done and advance.
onSessionSaved(async session => {
  const ref = session.planRef;
  if (!ref) return;
  const a = await getActive();
  if (!a || a.planId !== ref.planId) return;
  const plan = await getPlan(a.planId);
  if (plan) await setActive(complete(plan, a, ref, session.id));
});
