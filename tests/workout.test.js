import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSession, addSet, targetLow, finalizeSession } from '../src/workout.js';
import { openStore, memoryBackend } from '../src/db.js';

const S = (w, r, done = true) => ({ w, r, done });
const hist = [{ id: 'old', date: 1000, endedAt: 2000, exercises: [
  { exId: 'bench-press', sets: [S(60, 8), S(60, 7)] },
] }];

test('targetLow parses numbers, ranges and seconds', () => {
  assert.equal(targetLow(5), 5);
  assert.equal(targetLow('8-12'), 8);
  assert.equal(targetLow('30s'), 30);
  assert.equal(targetLow(undefined), null);
});

test('newSession prefills weight/reps from last performance, sets undone', () => {
  const s = newSession({ name: 'Push', exercises: [{ exId: 'bench-press', sets: 2, reps: '8-12' }] }, hist, 5000);
  assert.equal(s.date, 5000);
  assert.equal(s.endedAt, null);
  const e = s.exercises[0];
  assert.deepEqual(e.sets, [S(60, 8, false), S(60, 7, false)]);
  assert.deepEqual(e.last, [S(60, 8), S(60, 7)]);
  assert.deepEqual(e.target, { sets: 2, reps: '8-12' });
});

test('newSession uses target reps and blank weight when no history', () => {
  const s = newSession({ name: 'Legs', exercises: [{ exId: 'squat', sets: 3, reps: 5 }] }, hist, 0);
  assert.deepEqual(s.exercises[0].sets, [S(null, 5, false), S(null, 5, false), S(null, 5, false)]);
  assert.equal(s.exercises[0].last, null);
});

test('extra target sets beyond last session copy the last set', () => {
  const s = newSession({ name: 'x', exercises: [{ exId: 'bench-press', sets: 4, reps: 8 }] }, hist, 0);
  assert.deepEqual(s.exercises[0].sets.map(x => [x.w, x.r]), [[60, 8], [60, 7], [60, 7], [60, 7]]);
});

test('addSet copies the previous set, undone', () => {
  const e = { exId: 'bench-press', sets: [S(80, 5, true)] };
  addSet(e);
  assert.deepEqual(e.sets[1], S(80, 5, false));
});

test('finalizeSession keeps only done sets, drops empty exercises, sets duration', () => {
  const draft = { id: 'd', date: 0, endedAt: null, exercises: [
    { exId: 'bench-press', sets: [S(60, 8), S(60, 8, false)] },
    { exId: 'squat', sets: [S(100, 5, false)] },
  ] };
  const s = finalizeSession(draft, 125000);
  assert.equal(s.endedAt, 125000);
  assert.equal(s.durationSec, 125);
  assert.equal(s.exercises.length, 1);
  assert.deepEqual(s.exercises[0].sets, [S(60, 8)]);
});

test('draft survives reload (re-opened store returns identical draft)', async () => {
  const backend = memoryBackend();
  const db1 = await openStore(backend);
  const draft = newSession({ name: 'x', exercises: [{ exId: 'bench-press', sets: 3, reps: 8 }] }, hist, 42);
  draft.exercises[0].sets[0].done = true;
  await db1.kvSet('draft', draft);
  const db2 = await openStore(backend);
  assert.deepEqual(await db2.kvGet('draft', null), draft);
});

import { propagate, stepBase } from '../src/workout.js';
test('propagate copies a new value down to later undone sets that matched the old value', () => {
  const sets = [S(null, 8, false), S(null, 8, false), S(50, 8, false), S(null, 8, true)];
  const changed = propagate(sets, 0, 'w', null, 60);
  assert.deepEqual(changed, [1]);              // stops at set 2 (user-specific 50); done set untouched
  assert.deepEqual(sets.map(s => s.w), [null, 60, 50, null]);
});
test('propagate continues through all matching sets', () => {
  const sets = [S(60, 8, false), S(60, 8, false), S(60, 8, false)];
  assert.deepEqual(propagate(sets, 0, 'r', 8, 10), [1, 2]);
  assert.deepEqual(sets.map(s => s.r), [8, 10, 10]);
});
test('stepBase uses own value, else nearest earlier value, else 0', () => {
  const sets = [S(60, 8), S(null, null), S(null, 5)];
  assert.equal(stepBase(sets, 1, 'w'), 60);
  assert.equal(stepBase(sets, 0, 'w'), 60);
  assert.equal(stepBase([S(null, 1)], 0, 'w'), 0);
});
