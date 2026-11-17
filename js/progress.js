// Progress analytics (pure): per-exercise series, bests, weekly volume, trends, axis ticks, sample data.
import { epley, sessionVolume, weekStart, detectPRs, repsBased, LB } from './model.js';
import { builtInPlan } from '../data/plans.js';
import { targetLow } from './workout.js';

const done = sets => (sets || []).filter(s => s.done && s.r > 0);

/** One point per session that trained exId (oldest first): top weight, best e1RM, best reps. */
export function exerciseSeries(sessions, exId) {
  const out = [];
  for (const s of sessions) {
    const sets = (s.exercises || []).filter(e => e.exId === exId).flatMap(e => done(e.sets));
    if (!sets.length) continue;
    out.push({
      sessionId: s.id, date: s.date,
      topW: Math.max(...sets.map(x => x.w || 0)),
      e1rm: Math.max(...sets.map(x => epley(x.w || 0, x.r))),
      reps: Math.max(...sets.map(x => x.r)),
      sets: sets.length,
    });
  }
  return out.sort((a, b) => a.date - b.date);
}

export function bestEver(sessions, exId) {
  const s = exerciseSeries(sessions, exId);
  if (!s.length) return null;
  const pick = key => s.reduce((b, p) => (p[key] > b.value ? { value: p[key], date: p.date, sessionId: p.sessionId } : b), { value: -Infinity });
  return { weight: pick('topW'), e1rm: pick('e1rm'), reps: pick('reps'), sessions: s.length };
}

export function exercisesSummary(sessions) {
  const m = new Map();
  for (const s of sessions) for (const e of s.exercises || []) {
    if (!done(e.sets).length) continue;
    const cur = m.get(e.exId) || { exId: e.exId, count: 0, lastDate: 0 };
    cur.count++; cur.lastDate = Math.max(cur.lastDate, s.date);
    m.set(e.exId, cur);
  }
  return [...m.values()].sort((a, b) => b.lastDate - a.lastDate);
}

export function weeklyVolumes(sessions, now = Date.now(), weeks = 8) {
  const starts = [];
  let w = weekStart(now);
  for (let i = 0; i < weeks; i++) { starts.unshift(w); const d = new Date(w); d.setDate(d.getDate() - 7); w = d.getTime(); }
  return starts.map(ws => {
    const inWeek = sessions.filter(s => weekStart(s.date) === ws);
    return { weekStart: ws, volumeKg: inWeek.reduce((a, s) => a + sessionVolume(s), 0), workouts: inWeek.length };
  });
}

export function movingAverage(points, n = 7) {
  return points.map((p, i) => {
    const win = points.slice(Math.max(0, i - n + 1), i + 1);
    return { x: p.x, y: win.reduce((a, q) => a + q.y, 0) / win.length };
  });
}

/** Round tick values covering [min, max] with ~n intervals. */
export function niceTicks(min, max, n = 4, integer = false) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = [1, 2, 2.5, 5, 10].reduce((b, c) => (Math.abs(c - norm) < Math.abs(b - norm) ? c : b));
  const step = integer ? Math.max(1, Math.round(nice * mag)) : nice * mag;
  const dec = Math.max(0, -Math.floor(Math.log10(step)) + (nice === 2.5 ? 1 : 0));
  const ticks = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) ticks.push(Number(v.toFixed(dec)));
  return ticks;
}

// ── Sample data (for trying the app / demos) ──
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const START_KG = {
  'bench-press': 60, 'barbell-row': 55, 'overhead-press': 37.5, 'lat-pulldown': 50, 'triceps-pushdown': 20, 'db-curl': 10,
  'squat': 80, 'romanian-deadlift': 70, 'leg-press': 120, 'leg-curl': 35, 'calf-raise': 50,
  'incline-db-press': 22, 'pull-up': 0, 'db-shoulder-press': 18, 'seated-cable-row': 50, 'lateral-raise': 7, 'hammer-curl': 12,
  'deadlift': 100, 'bulgarian-split-squat': 14, 'hip-thrust': 80, 'leg-extension': 40, 'plank': 0,
};
const WEEKLY_KG = { 'squat': 2.5, 'deadlift': 2.5, 'bench-press': 1.25, 'barbell-row': 1.25, 'romanian-deadlift': 2.5, 'leg-press': 5, 'hip-thrust': 2.5, 'overhead-press': 0.6 };

/** ~8 weeks of Upper/Lower history ending before `now`, plus bodyweight entries. Deterministic. */
export function makeSampleHistory(now = Date.now()) {
  const rand = rng(42);
  const plan = builtInPlan('upper-lower');
  const weeks = 8;
  const first = new Date(weekStart(now)); first.setDate(first.getDate() - weeks * 7);
  const offsets = [0, 1, 3, 4]; // Mon Tue Thu Fri
  const sessions = [];
  for (let w = 0; w < weeks; w++) {
    plan.weeks[w].days.forEach((day, di) => {
      if (rand() < 0.08) return; // the odd missed day
      const d = new Date(first); d.setDate(d.getDate() + w * 7 + offsets[di]); d.setHours(18, 0, 0, 0);
      if (d.getTime() >= now) return;
      const exercises = day.exercises.map(e => {
        const reps = targetLow(e.reps);
        const stall = rand() < 0.15 ? -1 : 0;
        // progress in real plate jumps: whole 5 lb steps
        const lb = ((START_KG[e.exId] ?? 20) + (WEEKLY_KG[e.exId] ?? 0.5) * (w + stall)) / LB;
        const wkg = Math.round(lb / 5) * 5 * LB;
        const r0 = repsBased(e.exId) ? (e.exId === 'plank' ? 40 + w * 3 : 6 + Math.floor(w / 2)) : reps;
        const sets = Array.from({ length: e.sets }, (_, i) => ({
          w: repsBased(e.exId) ? 0 : wkg,
          r: Math.max(1, r0 - (i === e.sets - 1 && rand() < 0.4 ? 1 : 0)),
          done: true,
        }));
        return { exId: e.exId, notes: '', target: { sets: e.sets, reps: e.reps }, sets };
      });
      const dur = 50 * 60 + Math.round(rand() * 20 * 60);
      sessions.push({ id: `sample-${w}-${di}`, date: d.getTime(), endedAt: d.getTime() + dur * 1000, durationSec: dur,
        name: day.name, planRef: null, notes: '', sample: true, exercises });
    });
  }
  sessions.forEach((s, i) => { s.prs = detectPRs(s, sessions.slice(0, i)); });
  const bodyweight = [];
  for (let i = weeks * 7; i >= 1; i -= 2) {
    const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(7, 30, 0, 0);
    const kg = 82 - (weeks * 7 - i) * 0.03 + (rand() - 0.5) * 0.8;
    bodyweight.push({ id: `bw-sample-${i}`, date: d.getTime(), kg: Math.round(kg * 10) / 10, sample: true });
  }
  return { sessions, bodyweight };
}
