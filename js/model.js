// Pure workout logic — no DOM, no storage. Weights are kg internally.
import { byId } from '../data/exercises.js';

export const LB = 0.45359237; // kg per lb
const round = (n, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

export const toDisplay = (kg, unit) => (kg == null ? null : unit === 'lb' ? round(kg / LB, 1) : round(kg, 2));
export const fromDisplay = (val, unit) => (val == null ? null : (unit === 'lb' ? val * LB : val));
export function fmtW(kg, unit) {
  const v = toDisplay(kg, unit);
  return v == null ? '–' : String(v);
}

/** "62,5" → 62.5, "" → null, negatives/junk → null */
export function parseNum(str) {
  if (str == null) return null;
  const t = String(str).trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Epley estimated 1RM. */
export function epley(w, r) {
  if (!r) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
}

const isDone = s => s.done && s.r != null && s.r > 0;
const doneSets = sets => (sets || []).filter(isDone);

/** Best completed set by e1RM (ties → heavier). */
export function bestSet(sets) {
  let best = null;
  for (const s of doneSets(sets)) {
    const w = s.w || 0, e = epley(w, s.r);
    if (!best || e > best.e1rm + 1e-9 || (Math.abs(e - best.e1rm) < 1e-9 && w > best.w)) best = { w, r: s.r, e1rm: e };
  }
  return best;
}

const byDateDesc = (a, b) => b.date - a.date;

/** Completed sets from the most recent session containing exId. */
export function lastPerformance(sessions, exId) {
  for (const s of [...sessions].sort(byDateDesc)) {
    for (const e of s.exercises || []) {
      if (e.exId !== exId) continue;
      const d = doneSets(e.sets);
      if (d.length) return d;
    }
  }
  return null;
}

/** Σ weight × reps over completed sets (kg). */
export function sessionVolume(session) {
  let v = 0;
  for (const e of session.exercises || []) for (const s of doneSets(e.sets)) if (s.w != null) v += s.w * s.r;
  return v;
}

/** Whether PRs for an exercise are measured in reps/seconds rather than load. */
export const repsBased = exId => { const x = byId(exId); return !!x && (x.bodyweight || x.metric === 'seconds'); };

function exStats(sets, exId) {
  const d = doneSets(sets);
  if (!d.length) return null;
  if (repsBased(exId)) return { reps: Math.max(...d.map(s => s.r)) };
  return { weight: Math.max(...d.map(s => s.w || 0)), e1rm: Math.max(...d.map(s => epley(s.w || 0, s.r))) };
}

const TOL = 0.01;

/** PRs set in `session` versus all `priorSessions`. First-ever performance is not a PR. */
export function detectPRs(session, priorSessions) {
  const prs = [];
  for (const e of session.exercises || []) {
    const cur = exStats(e.sets, e.exId);
    if (!cur) continue;
    let prev = null;
    for (const p of priorSessions) {
      if (p.id === session.id) continue;
      for (const pe of p.exercises || []) {
        if (pe.exId !== e.exId) continue;
        const st = exStats(pe.sets, e.exId);
        if (!st) continue;
        prev = prev ? Object.fromEntries(Object.keys(st).map(k => [k, Math.max(prev[k], st[k])])) : st;
      }
    }
    if (!prev) continue;
    for (const k of Object.keys(cur)) {
      if (cur[k] > prev[k] + TOL) prs.push({ exId: e.exId, type: k, value: cur[k], prev: prev[k] });
    }
  }
  return prs;
}

/** Local Monday 00:00 of the week containing `ms`. */
export function weekStart(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
const prevWeek = ws => { const d = new Date(ws); d.setDate(d.getDate() - 7); return d.getTime(); };

export function weeklySummary(sessions, now = Date.now()) {
  const thisWeek = weekStart(now);
  const weeks = new Set(sessions.map(s => weekStart(s.date)));
  const cur = sessions.filter(s => weekStart(s.date) === thisWeek);
  let streak = 0;
  let w = weeks.has(thisWeek) ? thisWeek : prevWeek(thisWeek);
  while (weeks.has(w)) { streak++; w = prevWeek(w); }
  return {
    workouts: cur.length,
    volumeKg: cur.reduce((a, s) => a + sessionVolume(s), 0),
    streakWeeks: streak,
  };
}

/** "135 × 8", "BW × 10", "BW+25 × 6", "60 s" */
export function setLabel(exId, s, unit) {
  const x = byId(exId);
  if (x?.metric === 'seconds') return `${s.r} s`;
  if (x?.bodyweight) return s.w ? `BW+${fmtW(s.w, unit)} × ${s.r}` : `BW × ${s.r}`;
  return `${fmtW(s.w, unit)} × ${s.r}`;
}

export function prLabel(pr, unit) {
  const x = byId(pr.exId);
  const name = x?.name || pr.exId;
  if (pr.type === 'weight') return `${name}: ${fmtW(pr.value, unit)} ${unit}`;
  if (pr.type === 'e1rm') return `${name}: est. 1RM ${Math.round(toDisplay(pr.value, unit))} ${unit}`;
  return `${name}: ${pr.value} ${x?.metric === 'seconds' ? 's' : 'reps'}`;
}
