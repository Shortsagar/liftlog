// Plan progression (pure). Active plan state:
// { planId, week, day, startedAt, done: [{week, day, sessionId}], completedAt }
// week/day are 0-based pointers to the next workout.

export const posKey = p => `${p.week}:${p.day}`;

export function startPlan(plan, now = Date.now()) {
  return { planId: plan.id, week: 0, day: 0, startedAt: now, done: [], completedAt: null };
}

export function currentDay(plan, active) {
  if (!active || active.completedAt) return null;
  const dayDef = plan.weeks[active.week]?.days[active.day];
  return dayDef ? { week: active.week, day: active.day, dayDef } : null;
}

const cmp = (a, b) => a.week - b.week || a.day - b.day;

function nextPos(plan, pos) {
  if (pos.day + 1 < plan.weeks[pos.week].days.length) return { week: pos.week, day: pos.day + 1 };
  if (pos.week + 1 < plan.weeks.length) return { week: pos.week + 1, day: 0 };
  return null; // finished
}

function moveTo(active, next, now) {
  return next ? { ...active, ...next } : { ...active, completedAt: now };
}

/** Record that `ref` (a {week, day}) was trained. Moves the pointer past ref if ref is at/after it. */
export function complete(plan, active, ref, sessionId, now = Date.now()) {
  const done = active.done.some(d => posKey(d) === posKey(ref))
    ? active.done
    : [...active.done, { week: ref.week, day: ref.day, sessionId }];
  const a = { ...active, done };
  if (a.completedAt || cmp(ref, active) < 0) return a;
  return moveTo(a, nextPos(plan, ref), now);
}

export function skip(plan, active, now = Date.now()) {
  if (active.completedAt) return active;
  return moveTo(active, nextPos(plan, active), now);
}

export function progress(plan, active) {
  const total = plan.weeks.reduce((a, w) => a + w.days.length, 0);
  const done = active.done.length;
  return { week: Math.min(active.week + 1, plan.weeks.length), totalWeeks: plan.weeks.length, done, total, pct: total ? done / total : 0 };
}

/** Form → plan. A custom plan is one week of template days repeated `weeks` times. */
export function buildCustomPlan({ id, name, weeks, days, summary = '' }) {
  const tmpl = days.map((d, i) => ({
    name: (d.name || '').trim() || `Day ${i + 1}`,
    exercises: d.exercises.map(e => ({ exId: e.exId, sets: Math.max(1, Number(e.sets) || 1), reps: String(e.reps || '').trim() || '8-12' })),
  }));
  return {
    id, name: name.trim(), summary, builtIn: false, daysPerWeek: tmpl.length,
    weeks: Array.from({ length: weeks }, () => ({ days: tmpl.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e })) })) })),
  };
}

export function validatePlanForm({ name, weeks, days }) {
  const errs = [];
  if (!name || !name.trim()) errs.push('Give the plan a name');
  if (!(weeks >= 1 && weeks <= 52)) errs.push('Weeks must be between 1 and 52');
  if (!days.length) errs.push('Add at least one day');
  days.forEach((d, i) => { if (!d.exercises.length) errs.push(`"${d.name || `Day ${i + 1}`}" has no exercises`); });
  return errs;
}
