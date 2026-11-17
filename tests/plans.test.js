import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startPlan, currentDay, complete, skip, progress, posKey } from '../js/plans.js';
import { PLANS, repeatWeeks } from '../data/plans.js';
import { byId } from '../data/exercises.js';

const day = name => ({ name, exercises: [{ exId: 'squat', sets: 3, reps: 5 }] });
// 2 weeks × 3 days
const plan = { id: 'p', name: 'P', weeks: repeatWeeks(2, () => [day('A'), day('B'), day('C')]) };

test('startPlan begins at week 1 day 1', () => {
  const a = startPlan(plan, 1000);
  assert.deepEqual(a, { planId: 'p', week: 0, day: 0, startedAt: 1000, done: [], completedAt: null });
  const c = currentDay(plan, a);
  assert.equal(c.week, 0); assert.equal(c.day, 0); assert.equal(c.dayDef.name, 'A');
});

test('complete current day advances to the next day', () => {
  const a = complete(plan, startPlan(plan, 0), { week: 0, day: 0 }, 's1', 5);
  assert.deepEqual([a.week, a.day], [0, 1]);
  assert.deepEqual(a.done, [{ week: 0, day: 0, sessionId: 's1' }]);
});

test('completing the last day of a week wraps to next week', () => {
  let a = { ...startPlan(plan, 0), week: 0, day: 2 };
  a = complete(plan, a, { week: 0, day: 2 }, 's', 5);
  assert.deepEqual([a.week, a.day], [1, 0]);
});

test('completing the final day marks plan complete', () => {
  let a = { ...startPlan(plan, 0), week: 1, day: 2 };
  a = complete(plan, a, { week: 1, day: 2 }, 's', 77);
  assert.equal(a.completedAt, 77);
  assert.equal(currentDay(plan, a), null);
});

test('completing an earlier day records it without moving the pointer', () => {
  let a = { ...startPlan(plan, 0), week: 1, day: 1 };
  a = complete(plan, a, { week: 0, day: 1 }, 's', 5);
  assert.deepEqual([a.week, a.day], [1, 1]);
  assert.equal(a.done.length, 1);
});

test('completing a day ahead jumps the pointer past it', () => {
  let a = startPlan(plan, 0);
  a = complete(plan, a, { week: 0, day: 2 }, 's', 5);
  assert.deepEqual([a.week, a.day], [1, 0]);
});

test('completing the same day twice is counted once', () => {
  let a = startPlan(plan, 0);
  a = complete(plan, a, { week: 0, day: 0 }, 's1', 5);
  a = complete(plan, a, { week: 0, day: 0 }, 's2', 6);
  assert.equal(a.done.length, 1);
});

test('skip advances without recording done', () => {
  const a = skip(plan, startPlan(plan, 0), 9);
  assert.deepEqual([a.week, a.day, a.done.length], [0, 1, 0]);
});

test('progress: "Week 2 of 2, 4/6 done"', () => {
  let a = startPlan(plan, 0);
  for (let i = 0; i < 4; i++) { const c = currentDay(plan, a); a = complete(plan, a, c, 's' + i, i); }
  assert.deepEqual(progress(plan, a), { week: 2, totalWeeks: 2, done: 4, total: 6, pct: 4 / 6 });
});

test('posKey is stable', () => { assert.equal(posKey({ week: 1, day: 2 }), '1:2'); });

test('built-in plans: 7 plans, every exercise exists, every day has exercises', () => {
  assert.equal(PLANS.length, 7);
  for (const p of PLANS) {
    assert.ok(p.weeks.length >= 4, p.id);
    for (const w of p.weeks) for (const d of w.days) {
      assert.ok(d.exercises.length, `${p.id} ${d.name}`);
      for (const e of d.exercises) {
        assert.ok(byId(e.exId), `${p.id}: unknown ${e.exId}`);
        assert.ok(e.sets > 0 && e.reps, `${p.id}: ${e.exId} target`);
      }
    }
  }
});

test('5x5 alternates A/B/A then B/A/B', () => {
  const p = PLANS.find(x => x.id === 'stronglifts-5x5');
  assert.deepEqual(p.weeks[0].days.map(d => d.name), ['Workout A', 'Workout B', 'Workout A']);
  assert.deepEqual(p.weeks[1].days.map(d => d.name), ['Workout B', 'Workout A', 'Workout B']);
});

test('dumbbell-only plan uses only dumbbell/bodyweight exercises', () => {
  const p = PLANS.find(x => x.id === 'dumbbell-home');
  for (const d of p.weeks[0].days) for (const e of d.exercises)
    assert.ok(['dumbbell', 'bodyweight'].includes(byId(e.exId).equipment), e.exId);
});

import { buildCustomPlan, validatePlanForm } from '../js/plans.js';
test('buildCustomPlan repeats the template days across N weeks', () => {
  const p = buildCustomPlan({ id: 'c1', name: ' My Plan ', weeks: 4, days: [
    { name: 'Day A', exercises: [{ exId: 'squat', sets: 3, reps: '5' }] },
    { name: '', exercises: [{ exId: 'bench-press', sets: 3, reps: '8' }] },
  ] });
  assert.equal(p.name, 'My Plan');
  assert.equal(p.builtIn, false);
  assert.equal(p.weeks.length, 4);
  assert.deepEqual(p.weeks[3].days.map(d => d.name), ['Day A', 'Day 2']);
  assert.equal(p.daysPerWeek, 2);
});
test('validatePlanForm reports missing name, days, and empty days', () => {
  assert.deepEqual(validatePlanForm({ name: '', weeks: 4, days: [] }), ['Give the plan a name', 'Add at least one day']);
  assert.deepEqual(validatePlanForm({ name: 'x', weeks: 4, days: [{ name: 'A', exercises: [] }] }), ['"A" has no exercises']);
  assert.deepEqual(validatePlanForm({ name: 'x', weeks: 0, days: [{ name: 'A', exercises: [{ exId: 'squat', sets: 3, reps: 5 }] }] }), ['Weeks must be between 1 and 52']);
  assert.deepEqual(validatePlanForm({ name: 'x', weeks: 6, days: [{ name: 'A', exercises: [{ exId: 'squat', sets: 3, reps: 5 }] }] }), []);
});

test('gym plans use only gym-floor equipment (no free barbells)', () => {
  const gym = PLANS.filter(p => p.gym);
  assert.deepEqual(gym.map(p => p.id), ['gym-machine-circuit', 'gym-upper-lower']);
  for (const p of gym) for (const d of p.weeks[0].days) for (const e of d.exercises)
    assert.notEqual(byId(e.exId).equipment, 'barbell', `${p.id}: ${e.exId}`);
});
