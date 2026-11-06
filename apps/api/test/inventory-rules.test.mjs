import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditActionFor,
  bucketDeltas,
  evaluateAvailability,
  evaluateProductAvailability,
  IN_STOCK_THRESHOLD,
  movementEffects,
  POSTING_TYPES,
  sellableQuantity,
} from '../dist/inventory/inventory.rules.js';

test('each inventory operation is expressed as ledger bucket movements', () => {
  assert.deepEqual(movementEffects('RECEIPT', 5), [{ bucket: 'ON_HAND', quantity: 5 }]);
  assert.deepEqual(movementEffects('TRANSFER_IN', 5), [{ bucket: 'ON_HAND', quantity: 5 }]);
  assert.deepEqual(movementEffects('ADJUSTMENT_INCREASE', 5), [{ bucket: 'ON_HAND', quantity: 5 }]);
  assert.deepEqual(movementEffects('ISSUE', 5), [{ bucket: 'ON_HAND', quantity: -5 }]);
  assert.deepEqual(movementEffects('TRANSFER_OUT', 5), [{ bucket: 'ON_HAND', quantity: -5 }]);
  assert.deepEqual(movementEffects('ADJUSTMENT_DECREASE', 5), [{ bucket: 'ON_HAND', quantity: -5 }]);
  assert.deepEqual(movementEffects('RESERVE', 5), [{ bucket: 'RESERVED', quantity: 5 }]);
  assert.deepEqual(movementEffects('RELEASE', 5), [{ bucket: 'RESERVED', quantity: -5 }]);
});

test('damage moves stock out of on-hand instead of inventing a subtraction', () => {
  const effects = movementEffects('DAMAGE', 3);
  assert.deepEqual(effects, [
    { bucket: 'ON_HAND', quantity: -3 },
    { bucket: 'DAMAGED', quantity: 3 },
  ]);
  assert.deepEqual(bucketDeltas(effects), { onHand: -3, reserved: 0, damaged: 3 });
  // The on-hand reduction is what removes sellability, so damaged units never
  // need a second subtraction at projection time.
  assert.equal(sellableQuantity(10, 0), 10);
  assert.equal(sellableQuantity(10 - 3, 0), 7);
});

test('movement quantities are always positive whole units', () => {
  for (const invalid of [0, -1, 1.5, Number.NaN]) {
    assert.throws(() => movementEffects('RECEIPT', invalid), RangeError);
  }
  assert.throws(() => movementEffects('UNKNOWN', 1), RangeError);
});

test('bucket deltas aggregate multi-effect movements', () => {
  assert.deepEqual(
    bucketDeltas([
      { bucket: 'ON_HAND', quantity: -2 },
      { bucket: 'DAMAGED', quantity: 2 },
      { bucket: 'RESERVED', quantity: -1 },
    ]),
    { onHand: -2, reserved: -1, damaged: 2 },
  );
  assert.deepEqual(bucketDeltas([]), { onHand: 0, reserved: 0, damaged: 0 });
});

test('sellable stock never goes negative and excludes reservations', () => {
  assert.equal(sellableQuantity(10, 0), 10);
  assert.equal(sellableQuantity(10, 4), 6);
  assert.equal(sellableQuantity(10, 10), 0);
  assert.equal(sellableQuantity(2, 5), 0);
});

test('availability policy is coarse and server-decided', () => {
  assert.equal(IN_STOCK_THRESHOLD, 1);
  assert.equal(evaluateAvailability(1, true), 'IN_STOCK');
  assert.equal(evaluateAvailability(25, false), 'IN_STOCK');
  assert.equal(evaluateAvailability(0, true), 'ENQUIRE');
  assert.equal(evaluateAvailability(0, false), 'UNAVAILABLE');
  assert.equal(evaluateAvailability(-3, true), 'ENQUIRE');
});

test('a product is in stock when any active variant is sellable', () => {
  assert.equal(evaluateProductAvailability([0, 2], false), 'IN_STOCK');
  assert.equal(evaluateProductAvailability([0, 0], true), 'ENQUIRE');
  assert.equal(evaluateProductAvailability([], true), 'ENQUIRE');
  assert.equal(evaluateProductAvailability([], false), 'UNAVAILABLE');
  assert.equal(evaluateProductAvailability(new Set([0, 0]), false), 'UNAVAILABLE');
});

test('posting types and audit actions stay in one place', () => {
  assert.equal(POSTING_TYPES.length, 9);
  assert.ok(POSTING_TYPES.includes('DAMAGE'));
  assert.equal(auditActionFor('RECEIPT'), 'inventory.receipt.posted');
  assert.equal(auditActionFor('TRANSFER_OUT'), 'inventory.transfer_out.posted');
});
