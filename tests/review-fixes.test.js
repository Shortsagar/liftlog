// Regression tests for the review findings on the reliability changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore, memoryBackend, localBackend, migrateLegacy } from '../js/db.js';
import { exportAll, validateBackup } from '../js/backup.js';
import { makeEntry } from '../js/workout.js';
import { buildCustomPlan, editableWeeks } from '../js/plans.js';
import { PLANS } from '../data/plans.js';
import { app, initState } from '../js/state.js';
import { savePlan } from '../js/plan-store.js';
import { saveQueue } from '../js/save-queue.js';
import { revertDelta } from '../js/lifecycle.js';

function storage() {
  const data = new Map();
  return { data, getItem: k => data.get(k) ?? null, removeItem: k => data.delete(k), setItem: (k, v) => data.set(k, v) };
}

test('free-form rep targets saved by the previous version still start and still back up', async () => {
  for (const reps of ['AMRAP', '10+', '8–12', '12 each side']) {
    assert.doesNotThrow(() => makeEntry('squat', { sets: 3, reps }, []), reps);
  }
  const db = await openStore(memoryBackend());
  await db.put('plans', { id: 'custom-old', name: 'Old', builtIn: false, weeks: [{ days: [{ name: 'A', exercises: [{ exId: 'pull-up', sets: 3, reps: 'AMRAP' }] }] }] });
  assert.equal(validateBackup(await exportAll(db)), null);
});

test('revising an active plan many times keeps the id bounded and the backup importable', async () => {
  await initState(memoryBackend());
  let plan = buildCustomPlan({ id: 'custom-abc', name: 'Mine', weeks: 4, days: [{ name: 'A', exercises: [{ exId: 'squat', sets: 3, reps: '5' }] }] });
  plan = await savePlan(plan);
  for (let i = 0; i < 8; i++) {
    await app.db.kvSet('activePlan', { planId: plan.id, week: 0, day: 0, done: [] });
    plan = await savePlan({ ...plan, weeks: plan.weeks.slice(0, 3 + (i % 2)) });
  }
  assert.ok(plan.id.length < 80, `id grew to ${plan.id.length} chars`);
  assert.equal(validateBackup(await exportAll(app.db)), null);
});

test('editableWeeks gives every week its own day objects (built-ins share them)', () => {
  const src = PLANS.find(p => p.id === 'full-body-beginner');
  assert.equal(src.weeks[0].days[0], src.weeks[1].days[0], 'precondition: built-in weeks share day objects');
  const weeks = editableWeeks(src.weeks);
  weeks[0].days[0].exercises.pop();
  weeks[0].days[0].name = 'Changed';
  assert.equal(weeks[1].days[0].name, 'Full Body A');
  assert.equal(weeks[1].days[0].exercises.length, src.weeks[1].days[0].exercises.length);
});

test('migrateLegacy only opens the legacy database when it still needs migrating, and closes it', async () => {
  const scoped = memoryBackend();
  let opened = 0, closed = 0;
  const open = async () => { opened++; const l = memoryBackend(); l.close = () => closed++; return l; };
  await migrateLegacy(scoped, open, '/app/');
  assert.deepEqual([opened, closed], [1, 1]);
  await migrateLegacy(scoped, open, '/app/');
  assert.deepEqual([opened, closed], [1, 1], 'already migrated: legacy must not be opened again');
});

test('localStorage backend removes the old per-store keys once the combined snapshot is written', async () => {
  const ls = storage();
  ls.data.set('liftlog:sessions', '{"a":{"id":"a"}}');
  ls.data.set('liftlog:kv', '{}');
  const db = await openStore(localBackend(ls));
  await db.put('sessions', { id: 'b' });
  assert.deepEqual((await db.all('sessions')).map(s => s.id).sort(), ['a', 'b']);
  assert.equal(ls.data.has('liftlog:sessions'), false);
  assert.equal(ls.data.has('liftlog:kv'), false);
  assert.ok(ls.data.has('liftlog:database'));
});

test('save queue coalesces rapid edits into one write of the latest value', async () => {
  const writes = [];
  const q = saveQueue(async v => { writes.push(v); }, () => {}, { delay: 20 });
  const a = q.save({ w: 1 }); q.save({ w: 13 }); const c = q.save({ w: 135 });
  assert.equal(a, c, 'edits in one window share a single pending write');
  await new Promise(r => setTimeout(r, 60));
  assert.deepEqual(writes, [{ w: 135 }]);
});

test('save queue flush writes a pending edit immediately', async () => {
  const writes = [];
  const q = saveQueue(async v => { writes.push(v); }, () => {}, { delay: 10_000 });
  q.save({ w: 60 });
  await q.flush();
  assert.deepEqual(writes, [{ w: 60 }]);
});

test('revertDelta steps back over a freshly pushed entry or across a back/forward jump', () => {
  assert.equal(revertDelta(null, 4), -1);          // new entry pushed by a tab tap / go()
  assert.equal(revertDelta({ idx: 2 }, 4), 2);     // user pressed Back twice
  assert.equal(revertDelta({ idx: 5 }, 4), -1);    // user pressed Forward once
});
