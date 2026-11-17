// ─────────────────────────────────────────────────────────────────────────────
// STARTER PLANS — plain data, edit freely.
// Plan  = { id, name, summary, level, daysPerWeek, builtIn, weeks: [ { days: [ Day ] } ] }
// Day   = { name, exercises: [ { exId, sets, reps } ] }   reps: number or "8-12" or "30s"
// ─────────────────────────────────────────────────────────────────────────────

/** Build `n` weeks; weekFn(weekIndex) returns that week's days. */
export const repeatWeeks = (n, weekFn) => Array.from({ length: n }, (_, i) => ({ days: weekFn(i) }));
const E = (exId, sets, reps) => ({ exId, sets, reps });
const D = (name, ...exercises) => ({ name, exercises });

// ── Full Body Beginner ──
const fbA = D('Full Body A', E('squat', 3, '8'), E('bench-press', 3, '8'), E('barbell-row', 3, '8'), E('plank', 3, '30s'));
const fbB = D('Full Body B', E('romanian-deadlift', 3, '8'), E('overhead-press', 3, '8'), E('lat-pulldown', 3, '10'), E('db-curl', 2, '12'), E('plank', 3, '30s'));
const fbC = D('Full Body C', E('leg-press', 3, '10'), E('incline-db-press', 3, '10'), E('seated-cable-row', 3, '10'), E('lateral-raise', 2, '12'), E('triceps-pushdown', 2, '12'));

// ── Push / Pull / Legs ──
const push1 = D('Push 1', E('bench-press', 4, '6-8'), E('overhead-press', 3, '8-10'), E('incline-db-press', 3, '10'), E('lateral-raise', 3, '12-15'), E('triceps-pushdown', 3, '10-12'));
const pull1 = D('Pull 1', E('deadlift', 3, '5'), E('pull-up', 3, '6-10'), E('barbell-row', 3, '8-10'), E('face-pull', 3, '15'), E('db-curl', 3, '10-12'));
const legs1 = D('Legs 1', E('squat', 4, '6-8'), E('romanian-deadlift', 3, '8-10'), E('leg-press', 3, '10-12'), E('leg-curl', 3, '12'), E('calf-raise', 4, '12-15'));
const push2 = D('Push 2', E('overhead-press', 4, '6-8'), E('incline-db-press', 3, '8-10'), E('db-bench-press', 3, '10'), E('lateral-raise', 3, '15'), E('overhead-triceps-ext', 3, '12'));
const pull2 = D('Pull 2', E('barbell-row', 4, '6-8'), E('lat-pulldown', 3, '10'), E('seated-cable-row', 3, '10'), E('face-pull', 3, '15'), E('hammer-curl', 3, '10-12'));
const legs2 = D('Legs 2', E('squat', 3, '8-10'), E('bulgarian-split-squat', 3, '10'), E('hip-thrust', 3, '10'), E('leg-extension', 3, '12'), E('calf-raise', 4, '15'));

// ── Upper / Lower ──
const upA = D('Upper A', E('bench-press', 4, '5'), E('barbell-row', 4, '6'), E('overhead-press', 3, '8'), E('lat-pulldown', 3, '10'), E('triceps-pushdown', 2, '12'), E('db-curl', 2, '12'));
const loA = D('Lower A', E('squat', 4, '5'), E('romanian-deadlift', 3, '8'), E('leg-press', 3, '10'), E('leg-curl', 3, '12'), E('calf-raise', 3, '15'));
const upB = D('Upper B', E('incline-db-press', 4, '8-10'), E('pull-up', 4, '6-10'), E('db-shoulder-press', 3, '10'), E('seated-cable-row', 3, '10'), E('lateral-raise', 3, '15'), E('hammer-curl', 2, '12'));
const loB = D('Lower B', E('deadlift', 3, '5'), E('bulgarian-split-squat', 3, '10'), E('hip-thrust', 3, '10'), E('leg-extension', 3, '12'), E('plank', 3, '45s'));

// ── 5×5 ──
const slA = D('Workout A', E('squat', 5, '5'), E('bench-press', 5, '5'), E('barbell-row', 5, '5'));
const slB = D('Workout B', E('squat', 5, '5'), E('overhead-press', 5, '5'), E('deadlift', 1, '5'));

// ── Dumbbell-only Home ──
const dbA = D('Home A', E('goblet-squat', 3, '12'), E('db-bench-press', 3, '10'), E('db-row', 3, '10'), E('db-shoulder-press', 3, '10'), E('plank', 3, '30s'));
const dbB = D('Home B', E('db-rdl', 3, '10'), E('push-up', 3, '8-15'), E('lunge', 3, '10'), E('lateral-raise', 3, '12'), E('db-curl', 3, '12'), E('overhead-triceps-ext', 3, '12'));
const dbC = D('Home C', E('bulgarian-split-squat', 3, '10'), E('incline-db-press', 3, '10'), E('db-row', 3, '12'), E('hammer-curl', 3, '12'), E('plank', 3, '45s'));

export const PLANS = [
  { id: 'full-body-beginner', name: 'Full Body Beginner', level: 'Beginner', daysPerWeek: 3, builtIn: true,
    summary: 'Three full-body sessions a week. Learn the main lifts and build a base. Add weight when you hit all reps.',
    weeks: repeatWeeks(8, () => [fbA, fbB, fbC]) },
  { id: 'push-pull-legs', name: 'Push / Pull / Legs', level: 'Intermediate', daysPerWeek: 6, builtIn: true,
    summary: 'Six days: push, pull, legs, twice a week with different exercises. High volume for muscle growth.',
    weeks: repeatWeeks(8, () => [push1, pull1, legs1, push2, pull2, legs2]) },
  { id: 'upper-lower', name: 'Upper / Lower 4-Day', level: 'Intermediate', daysPerWeek: 4, builtIn: true,
    summary: 'Four days split upper and lower. One heavier day and one volume day for each half.',
    weeks: repeatWeeks(8, () => [upA, loA, upB, loB]) },
  { id: 'stronglifts-5x5', name: '5×5 Strength', level: 'Beginner', daysPerWeek: 3, builtIn: true,
    summary: 'Classic linear progression: alternate workouts A and B three times a week. Add 5 lb each session you complete 5×5.',
    weeks: repeatWeeks(12, i => (i % 2 === 0 ? [slA, slB, slA] : [slB, slA, slB])) },
  { id: 'dumbbell-home', name: 'Dumbbell-only Home', level: 'Beginner', daysPerWeek: 3, builtIn: true,
    summary: 'Three home sessions using just a pair of dumbbells (and a bench if you have one).',
    weeks: repeatWeeks(8, () => [dbA, dbB, dbC]) },
];

export const builtInPlan = id => PLANS.find(p => p.id === id);
