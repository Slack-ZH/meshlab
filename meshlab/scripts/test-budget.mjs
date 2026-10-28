import test from 'node:test';
import assert from 'node:assert/strict';
import { BudgetLedger, DAILY_LIMIT, usageCost, reserveCost, budgetDay, UsageTracker } from '../server/budget.mjs';
import { MemoryStorage } from './test-storage.mjs';
test('concurrent reservations cannot overspend a shared account', async () => {
  const ledger = new BudgetLedger(new MemoryStorage());
  const results = await Promise.allSettled([ledger.reserve(1_200_000_000), ledger.reserve(1_200_000_000)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await ledger.status()).usedCny, 1.2);
});
test('reservation, actual usage settlement and duplicate completion', async () => {
  const ledger = new BudgetLedger(new MemoryStorage());
  const t = await ledger.reserve(500_000_000);
  assert.equal((await ledger.status()).remainingCny, 1.5);
  await ledger.settle(t, 100_000_000); await ledger.settle(t, 0);
  assert.equal((await ledger.status()).remainingCny, 1.9);
});
test('unknown usage and process restart retain reserved money', async () => {
  let time = Date.parse('2026-10-28T10:00:00+08:00');
  const storage = new MemoryStorage(), ledger = new BudgetLedger(storage, () => time);
  const t = await ledger.reserve(800_000_000); time += 120000;
  const restarted = new BudgetLedger(storage, () => time);
  assert.equal((await restarted.status()).usedCny, 0.8);
  await restarted.settle(t); assert.equal((await restarted.status()).usedCny, 0.8);
});
test('accounts are isolated and day resets at Shanghai midnight', async () => {
  let time = Date.parse('2026-10-28T23:59:59+08:00');
  const alice = new BudgetLedger(new MemoryStorage(), () => time), bob = new BudgetLedger(new MemoryStorage(), () => time);
  const t = await alice.reserve(DAILY_LIMIT);
  assert.equal((await bob.status()).remainingCny, 2); assert.equal((await alice.status()).remainingCny, 0);
  time += 1000;
  assert.equal(budgetDay(time), '2026-10-29'); assert.equal((await alice.status()).remainingCny, 2);
  await alice.settle(t, 1_000_000_000); assert.equal((await alice.status()).remainingCny, 2);
});
test('unpriced model and missing or invalid usage are handled conservatively', () => {
  assert.throws(() => reserveCost([], 'unpriced-model'));
  assert.equal(usageCost(null), null); assert.equal(usageCost({ prompt_tokens: -1, completion_tokens: 0 }), null);
  assert.equal(usageCost({ prompt_tokens: 1000000, completion_tokens: 0 }), 2_000_000_000);
  const tracker = new UsageTracker(), text = 'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":100,"completion_tokens":10}}\r\n\r\ndata: [DONE]\r\n\r\n';
  for (const byte of new TextEncoder().encode(text)) tracker.push(new Uint8Array([byte]));
  assert.equal(tracker.cost, 280000); assert.equal(tracker.done, true);
  const separateUsage = new UsageTracker();
  separateUsage.push(new TextEncoder().encode('data: {"choices":[],"usage":{"prompt_tokens":100,"completion_tokens":10}}\n\ndata: [DONE]\n\n'));
  assert.equal(separateUsage.cost, 280000); assert.equal(separateUsage.done, true);
});
