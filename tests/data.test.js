import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, MUSCLES, byId } from '../data/exercises.js';

const REQUIRED = ['bench-press', 'incline-db-press', 'overhead-press', 'squat', 'deadlift',
  'romanian-deadlift', 'barbell-row', 'lat-pulldown', 'pull-up', 'db-curl', 'triceps-pushdown',
  'lateral-raise', 'lunge', 'leg-press', 'plank'];

test('library contains every required exercise', () => {
  for (const id of REQUIRED) assert.ok(byId(id), `missing ${id}`);
});

test('exercise ids are unique', () => {
  const ids = EXERCISES.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every exercise has valid muscles, 3-4 cues and a metric', () => {
  for (const e of EXERCISES) {
    assert.ok(e.name, e.id);
    assert.ok(e.primary.length >= 1, `${e.id} primary`);
    for (const m of [...e.primary, ...e.secondary]) assert.ok(MUSCLES[m], `${e.id}: unknown muscle ${m}`);
    assert.ok(e.cues.length >= 3 && e.cues.length <= 4, `${e.id} cues`);
    assert.ok(['reps', 'seconds'].includes(e.metric), `${e.id} metric`);
  }
});

test('plank is timed, pull-up is bodyweight', () => {
  assert.equal(byId('plank').metric, 'seconds');
  assert.equal(byId('pull-up').bodyweight, true);
});

import { normalizeKeyframes, posedJoints, fitBox } from '../js/rig.js';
test('every exercise animation stays inside its fitted, square frame', () => {
  for (const e of EXERCISES) {
    assert.ok(e.anim && e.anim.keyframes.length >= 1, `${e.id} has no animation`);
    const box = fitBox(e.anim);
    assert.equal(box.w, box.h, `${e.id} frame must be square`);
    if (!e.anim.noFloor) assert.ok(box.y + box.h >= 184, `${e.id} floor must be visible`);
    if (e.anim.view === 'front') continue;
    const kfs = normalizeKeyframes(e.anim.keyframes);
    for (let t = 0; t < 1; t += 0.05) {
      const j = posedJoints(e.anim, kfs, t);
      for (const [name, p] of Object.entries(j)) {
        assert.ok(p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h,
          `${e.id} ${name} out of frame at t=${t.toFixed(2)}: ${p.x.toFixed(0)},${p.y.toFixed(0)}`);
      }
    }
  }
});

test('fitBox crops tightly around a standing figure', () => {
  const b = fitBox(byId('db-curl').anim);
  assert.ok(b.w < 200, `expected a tight crop, got ${b.w}`);
});

test('fitBox includes static props such as benches and pulleys', () => {
  const b = fitBox(byId('lat-pulldown').anim); // pulley at y=6
  assert.ok(b.y <= 6);
});
