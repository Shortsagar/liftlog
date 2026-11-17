import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore, memoryBackend } from '../src/db.js';

test('put/get/all/del roundtrip', async () => {
  const db = await openStore(memoryBackend());
  await db.put('sessions', { id: 's1', name: 'A' });
  await db.put('sessions', { id: 's2', name: 'B' });
  assert.deepEqual(await db.get('sessions', 's1'), { id: 's1', name: 'A' });
  assert.equal((await db.all('sessions')).length, 2);
  await db.del('sessions', 's1');
  assert.equal(await db.get('sessions', 's1'), undefined);
  assert.deepEqual((await db.all('sessions')).map(s => s.id), ['s2']);
});

test('stored objects are copies, not live references', async () => {
  const db = await openStore(memoryBackend());
  const obj = { id: 'x', n: 1 };
  await db.put('plans', obj);
  obj.n = 2;
  assert.equal((await db.get('plans', 'x')).n, 1);
});

test('kvGet returns default when missing, value when set', async () => {
  const db = await openStore(memoryBackend());
  assert.equal(await db.kvGet('settings', 'dflt'), 'dflt');
  await db.kvSet('settings', { unit: 'kg' });
  assert.deepEqual(await db.kvGet('settings', null), { unit: 'kg' });
});

test('clear empties every store', async () => {
  const db = await openStore(memoryBackend());
  await db.put('sessions', { id: 'a' });
  await db.kvSet('k', 1);
  await db.clear();
  assert.equal((await db.all('sessions')).length, 0);
  assert.equal(await db.kvGet('k', 'none'), 'none');
});
