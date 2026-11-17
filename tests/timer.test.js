import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remainingSec, adjustEnd } from '../src/timer-core.js';

test('remainingSec rounds up and never goes negative', () => {
  assert.equal(remainingSec({ endsAt: 10_500 }, 10_000), 1);
  assert.equal(remainingSec({ endsAt: 100_000 }, 10_000), 90);
  assert.equal(remainingSec({ endsAt: 5_000 }, 10_000), 0);
  assert.equal(remainingSec(null, 10_000), 0);
});

test('adjustEnd adds/subtracts but not below now', () => {
  assert.deepEqual(adjustEnd({ endsAt: 50_000, total: 90 }, 15, 10_000), { endsAt: 65_000, total: 105 });
  assert.deepEqual(adjustEnd({ endsAt: 15_000, total: 90 }, -15, 10_000), { endsAt: 10_000, total: 75 });
});
