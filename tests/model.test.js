import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toDisplay, fromDisplay, fmtW, parseNum, epley, bestSet, lastPerformance,
  sessionVolume, detectPRs, weeklySummary,
} from '../js/model.js';

const S = (w, r, done = true) => ({ w, r, done });
const sess = (id, date, exercises) => ({ id, date, endedAt: date + 3600e3, exercises });
const DAY = 86400e3;

test('epley: 100x10 ≈ 133.33, 1 rep = weight, 0 reps = 0', () => {
  assert.ok(Math.abs(epley(100, 10) - 133.333) < 0.01);
  assert.equal(epley(100, 1), 100);
  assert.equal(epley(100, 0), 0);
});

test('unit conversion round-trips and formats', () => {
  const kg = fromDisplay(135, 'lb');
  assert.ok(Math.abs(kg - 61.235) < 0.001);
  assert.equal(toDisplay(kg, 'lb'), 135);
  assert.equal(toDisplay(60, 'kg'), 60);
  assert.equal(fmtW(fromDisplay(135, 'lb'), 'lb'), '135');
  assert.equal(fmtW(fromDisplay(62.5, 'kg'), 'kg'), '62.5');
  assert.equal(fmtW(fromDisplay(1.25, 'kg'), 'kg'), '1.25');
});

test('parseNum: comma decimal, blank → null, junk → null', () => {
  assert.equal(parseNum('62,5'), 62.5);
  assert.equal(parseNum(' 135 '), 135);
  assert.equal(parseNum(''), null);
  assert.equal(parseNum('abc'), null);
  assert.equal(parseNum('-5'), null);
});

test('bestSet: null when nothing done; ties on e1RM go to the heavier set', () => {
  assert.equal(bestSet([S(100, 5, false)]), null);
  // 100x1 = 100 and 75x10 = 100 → tie → heavier wins
  const b = bestSet([S(75, 10), S(100, 1)]);
  assert.equal(b.w, 100);
});

test('bestSet chooses 110x3 (121) over 100x5 (116.7)', () => {
  const b = bestSet([S(100, 5), S(110, 3)]);
  assert.equal(b.w, 110);
  assert.equal(b.r, 3);
});

test('lastPerformance picks most recent session with done sets for that exercise', () => {
  const sessions = [
    sess('a', 1 * DAY, [{ exId: 'bench-press', sets: [S(60, 8)] }]),
    sess('b', 3 * DAY, [{ exId: 'bench-press', sets: [S(65, 8), S(65, 7)] }]),
    sess('c', 4 * DAY, [{ exId: 'bench-press', sets: [S(70, 8, false)] }]), // nothing done
    sess('d', 5 * DAY, [{ exId: 'squat', sets: [S(100, 5)] }]),
  ];
  assert.deepEqual(lastPerformance(sessions, 'bench-press'), [S(65, 8), S(65, 7)]);
  assert.equal(lastPerformance(sessions, 'deadlift'), null);
});

test('sessionVolume ignores undone sets and blanks', () => {
  const s = sess('a', 0, [{ exId: 'bench-press', sets: [S(100, 5), S(100, 5, false), S(null, 5), S(100, null)] }]);
  assert.equal(sessionVolume(s), 500);
});

test('detectPRs: first-ever session is not a PR', () => {
  const s = sess('a', DAY, [{ exId: 'bench-press', sets: [S(100, 5)] }]);
  assert.deepEqual(detectPRs(s, []), []);
});

test('detectPRs: heavier weight → weight + e1rm PR', () => {
  const prior = [sess('a', DAY, [{ exId: 'bench-press', sets: [S(100, 5)] }])];
  const s = sess('b', 2 * DAY, [{ exId: 'bench-press', sets: [S(102.5, 5)] }]);
  const types = detectPRs(s, prior).map(p => p.type).sort();
  assert.deepEqual(types, ['e1rm', 'weight']);
});

test('detectPRs: more reps at same weight → e1rm PR only', () => {
  const prior = [sess('a', DAY, [{ exId: 'bench-press', sets: [S(100, 5)] }])];
  const s = sess('b', 2 * DAY, [{ exId: 'bench-press', sets: [S(100, 6)] }]);
  assert.deepEqual(detectPRs(s, prior).map(p => p.type), ['e1rm']);
});

test('detectPRs: no PR from unit round-trip', () => {
  const w = fromDisplay(135, 'lb');
  const prior = [sess('a', DAY, [{ exId: 'bench-press', sets: [S(w, 8)] }])];
  const again = fromDisplay(toDisplay(w, 'lb'), 'lb');
  const s = sess('b', 2 * DAY, [{ exId: 'bench-press', sets: [S(again, 8)] }]);
  assert.deepEqual(detectPRs(s, prior), []);
});

test('detectPRs: bodyweight PR on reps; timed PR on seconds', () => {
  const prior = [sess('a', DAY, [
    { exId: 'pull-up', sets: [S(0, 8)] },
    { exId: 'plank', sets: [S(0, 60)] },
  ])];
  const s = sess('b', 2 * DAY, [
    { exId: 'pull-up', sets: [S(0, 9)] },
    { exId: 'plank', sets: [S(0, 75)] },
  ]);
  const prs = detectPRs(s, prior);
  assert.deepEqual(prs.map(p => [p.exId, p.type, p.value]), [['pull-up', 'reps', 9], ['plank', 'reps', 75]]);
});

test('detectPRs ignores undone sets', () => {
  const prior = [sess('a', DAY, [{ exId: 'bench-press', sets: [S(100, 5)] }])];
  const s = sess('b', 2 * DAY, [{ exId: 'bench-press', sets: [S(200, 5, false)] }]);
  assert.deepEqual(detectPRs(s, prior), []);
});

test('weeklySummary: this week counts/volume and 3-week streak', () => {
  // Wednesday 2026-11-18 12:00 local
  const now = new Date(2026, 10, 18, 12).getTime();
  const at = (y, m, d) => new Date(y, m, d, 9).getTime();
  const sessions = [
    sess('a', at(2026, 10, 3), [{ exId: 'squat', sets: [S(100, 5)] }]),   // Tue 3 Nov (week of 2 Nov)
    sess('b', at(2026, 10, 10), [{ exId: 'squat', sets: [S(100, 5)] }]),  // Tue 10 Nov
    sess('c', at(2026, 10, 16), [{ exId: 'squat', sets: [S(100, 5)] }]),  // Mon 16 Nov (this week)
    sess('d', at(2026, 10, 17), [{ exId: 'squat', sets: [S(50, 10)] }]),  // Tue 17 Nov
  ];
  const w = weeklySummary(sessions, now);
  assert.equal(w.workouts, 2);
  assert.equal(w.volumeKg, 1000);
  assert.equal(w.streakWeeks, 3);
});

test('weeklySummary: streak survives an empty current week, breaks on a gap', () => {
  const now = new Date(2026, 10, 16, 8).getTime(); // Monday morning, nothing yet
  const at = (d) => new Date(2026, 10, d, 9).getTime();
  const sessions = [
    sess('a', at(3), [{ exId: 'squat', sets: [S(100, 5)] }]),   // week of 2 Nov
    sess('b', at(12), [{ exId: 'squat', sets: [S(100, 5)] }]),  // week of 9 Nov
    sess('x', new Date(2026, 9, 20).getTime(), [{ exId: 'squat', sets: [S(100, 5)] }]), // Oct 20 — gap before
  ];
  const w = weeklySummary(sessions, now);
  assert.equal(w.workouts, 0);
  assert.equal(w.streakWeeks, 2);
});

import { prLabel, setLabel } from '../js/model.js';
test('prLabel formats weight, e1rm, reps and seconds PRs', () => {
  assert.equal(prLabel({ exId: 'bench-press', type: 'weight', value: fromDisplay(225, 'lb') }, 'lb'), 'Barbell Bench Press: 225 lb');
  assert.equal(prLabel({ exId: 'bench-press', type: 'e1rm', value: 100 }, 'kg'), 'Barbell Bench Press: est. 1RM 100 kg');
  assert.equal(prLabel({ exId: 'pull-up', type: 'reps', value: 9 }, 'lb'), 'Pull-up: 9 reps');
  assert.equal(prLabel({ exId: 'plank', type: 'reps', value: 75 }, 'lb'), 'Plank: 75 s');
});
test('setLabel formats weighted, bodyweight and timed sets', () => {
  assert.equal(setLabel('bench-press', { w: fromDisplay(135, 'lb'), r: 8 }, 'lb'), '135 × 8');
  assert.equal(setLabel('pull-up', { w: 0, r: 10 }, 'lb'), 'BW × 10');
  assert.equal(setLabel('pull-up', { w: fromDisplay(25, 'lb'), r: 6 }, 'lb'), 'BW+25 × 6');
  assert.equal(setLabel('plank', { w: 0, r: 60 }, 'lb'), '60 s');
});

test('toDisplay shows lb to one decimal and kg to two (for 1.25 kg plates)', () => {
  assert.equal(toDisplay(61.25, 'lb'), 135);
  assert.equal(toDisplay(1.25, 'kg'), 1.25);
});
