import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exerciseSeries, bestEver, exercisesSummary, weeklyVolumes, movingAverage, niceTicks, makeSampleHistory } from '../src/progress.js';
import { weekStart, detectPRs } from '../src/model.js';

const S = (w, r, done = true) => ({ w, r, done });
const DAY = 86400e3;
const sess = (id, date, exercises) => ({ id, date, endedAt: date + 3600e3, exercises });

const history = [
  sess('c', 10 * DAY, [{ exId: 'bench-press', sets: [S(105, 3), S(100, 5)] }]),
  sess('a', 1 * DAY, [{ exId: 'bench-press', sets: [S(100, 5), S(100, 4)] }, { exId: 'squat', sets: [S(140, 5)] }]),
  sess('b', 5 * DAY, [{ exId: 'bench-press', sets: [S(102.5, 5), S(120, 1, false)] }]),
];

test('exerciseSeries: one point per session, oldest first, done sets only', () => {
  const s = exerciseSeries(history, 'bench-press');
  assert.deepEqual(s.map(p => p.sessionId), ['a', 'b', 'c']);
  assert.deepEqual(s.map(p => p.topW), [100, 102.5, 105]);
  assert.ok(Math.abs(s[2].e1rm - 116.667) < 0.01); // 100x5 beats 105x3 (115.5)
  assert.equal(s[0].reps, 5);
});

test('bestEver returns the all-time best weight, e1RM and reps with dates', () => {
  const b = bestEver(history, 'bench-press');
  assert.equal(b.weight.value, 105); assert.equal(b.weight.date, 10 * DAY);
  assert.ok(Math.abs(b.e1rm.value - 119.583) < 0.01); // 102.5x5
  assert.equal(b.e1rm.date, 5 * DAY);
  assert.equal(bestEver(history, 'deadlift'), null);
});

test('exercisesSummary lists exercises by most recently trained', () => {
  const list = exercisesSummary(history);
  assert.deepEqual(list.map(x => [x.exId, x.count]), [['bench-press', 3], ['squat', 1]]);
});

test('weeklyVolumes returns N weeks oldest→newest including empty weeks', () => {
  const now = new Date(2026, 10, 18, 12).getTime();
  const at = d => new Date(2026, 10, d, 9).getTime();
  const sessions = [sess('x', at(17), [{ exId: 'squat', sets: [S(100, 5)] }]), sess('y', at(4), [{ exId: 'squat', sets: [S(100, 10)] }])];
  const w = weeklyVolumes(sessions, now, 4);
  assert.equal(w.length, 4);
  assert.equal(w[3].weekStart, weekStart(now));
  assert.deepEqual(w.map(x => x.volumeKg), [0, 1000, 0, 500]);
  assert.deepEqual(w.map(x => x.workouts), [0, 1, 0, 1]);
});

test('movingAverage is a trailing mean over the last n points', () => {
  const pts = [1, 2, 3, 4, 5].map((y, i) => ({ x: i, y }));
  assert.deepEqual(movingAverage(pts, 3).map(p => p.y), [1, 1.5, 2, 3, 4]);
});

test('niceTicks spans the data with round steps', () => {
  assert.deepEqual(niceTicks(97, 143, 4), [90, 100, 110, 120, 130, 140, 150]);
  assert.deepEqual(niceTicks(0, 1, 4), [0, 0.25, 0.5, 0.75, 1]);
  assert.deepEqual(niceTicks(5, 5, 4), [4, 4.5, 5, 5.5, 6]);
});

test('makeSampleHistory: ~8 weeks of plan workouts with progressing lifts and PRs', () => {
  const now = new Date(2026, 10, 16, 18).getTime();
  const { sessions, bodyweight } = makeSampleHistory(now);
  assert.ok(sessions.length >= 20, `got ${sessions.length}`);
  assert.ok(sessions.every(s => s.date < now));
  const bench = exerciseSeries(sessions, 'bench-press');
  assert.ok(bench.at(-1).topW > bench[0].topW, 'bench should progress');
  assert.ok(sessions.some(s => s.prs && s.prs.length), 'some PRs');
  // stored PRs match what detection would say
  const sorted = [...sessions].sort((a, b) => a.date - b.date);
  sorted.forEach((s, i) => assert.deepEqual(s.prs, detectPRs(s, sorted.slice(0, i))));
  assert.ok(bodyweight.length >= 20 && bodyweight.every(b => b.kg > 50 && b.kg < 150));
  // deterministic
  assert.deepEqual(makeSampleHistory(now).sessions.map(s => s.id), sessions.map(s => s.id));
});

test('niceTicks with integer=true never uses fractional steps', () => {
  assert.deepEqual(niceTicks(6, 9, 4, true), [6, 7, 8, 9]);
});
