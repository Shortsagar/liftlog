import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore, memoryBackend } from '../js/db.js';
import { exportAll, importAll, validateBackup } from '../js/backup.js';

async function seeded() {
  const db = await openStore(memoryBackend());
  await db.put('sessions', { id: 's1', date: 1, name: 'A', exercises: [] });
  await db.put('plans', { id: 'custom-1', name: 'Mine', weeks: [] });
  await db.put('bodyweight', { id: 'b1', date: 2, kg: 80 });
  await db.kvSet('settings', { unit: 'kg' });
  await db.kvSet('activePlan', { planId: 'upper-lower', week: 2, day: 1, done: [] });
  return db;
}

test('export → import round-trips every store into a fresh device', async () => {
  const src = await seeded();
  const backup = await exportAll(src, 1234);
  assert.equal(backup.app, 'liftlog');
  assert.equal(backup.version, 1);
  assert.equal(backup.exportedAt, 1234);
  const json = JSON.parse(JSON.stringify(backup)); // through a file
  const dst = await openStore(memoryBackend());
  const counts = await importAll(dst, json);
  assert.deepEqual(counts, { sessions: 1, plans: 1, bodyweight: 1 });
  for (const s of ['sessions', 'plans', 'bodyweight', 'kv']) assert.deepEqual(await dst.all(s), await src.all(s));
});

test('importAll rejects invalid files and leaves existing data untouched', async () => {
  const db = await seeded();
  const before = await db.all('sessions');
  for (const bad of [null, 'text', {}, { app: 'other', version: 1 }, { app: 'liftlog', version: 99, sessions: [] },
    { app: 'liftlog', version: 1, sessions: 'x', plans: [], bodyweight: [], kv: [] },
    { app: 'liftlog', version: 1, sessions: [{ name: 'no id' }], plans: [], bodyweight: [], kv: [] }]) {
    await assert.rejects(() => importAll(db, bad), /Not a valid LiftLog backup/);
  }
  assert.deepEqual(await db.all('sessions'), before);
});

test('validateBackup accepts an export and names the problem otherwise', async () => {
  const ok = await exportAll(await seeded(), 1);
  assert.equal(validateBackup(ok), null);
  assert.match(validateBackup({ app: 'liftlog', version: 1, sessions: [], plans: [], bodyweight: [] }), /kv/);
});
