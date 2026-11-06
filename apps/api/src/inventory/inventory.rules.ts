import type { InventoryBucket, InventoryMovementType } from '@prisma/client';

/**
 * Market availability is deliberately coarse. The storefront never receives a
 * stock count, a warehouse name, or a reservation figure; it receives one of
 * these three labels decided on the server.
 */
export type AvailabilityLabel = 'IN_STOCK' | 'ENQUIRE' | 'UNAVAILABLE';

/** A variant counts as in stock once at least this many units are sellable. */
export const IN_STOCK_THRESHOLD = 1;

export interface LedgerEffect {
  bucket: InventoryBucket;
  quantity: number;
}

export interface BucketDeltas {
  onHand: number;
  reserved: number;
  damaged: number;
}

/**
 * Every inventory operation is expressed as signed movements on a bucket, so a
 * posting can never edit a stored count directly.
 *
 * Damaged stock moves ON_HAND -> DAMAGED; because the on-hand quantity is
 * reduced by the same posting, damaged units never inflate sellable stock and
 * never need a separate subtraction.
 */
export function movementEffects(type: InventoryMovementType, quantity: number): LedgerEffect[] {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError('Inventory movement quantity must be a positive integer.');
  }

  switch (type) {
    case 'RECEIPT':
    case 'TRANSFER_IN':
    case 'ADJUSTMENT_INCREASE':
      return [{ bucket: 'ON_HAND', quantity }];
    case 'ISSUE':
    case 'TRANSFER_OUT':
    case 'ADJUSTMENT_DECREASE':
      return [{ bucket: 'ON_HAND', quantity: -quantity }];
    case 'RESERVE':
      return [{ bucket: 'RESERVED', quantity }];
    case 'RELEASE':
      return [{ bucket: 'RESERVED', quantity: -quantity }];
    case 'DAMAGE':
      return [
        { bucket: 'ON_HAND', quantity: -quantity },
        { bucket: 'DAMAGED', quantity },
      ];
    default:
      throw new RangeError(`Unsupported inventory movement type: ${String(type)}`);
  }
}

export function bucketDeltas(effects: LedgerEffect[]): BucketDeltas {
  const deltas: BucketDeltas = { onHand: 0, reserved: 0, damaged: 0 };
  for (const effect of effects) {
    if (effect.bucket === 'ON_HAND') deltas.onHand += effect.quantity;
    if (effect.bucket === 'RESERVED') deltas.reserved += effect.quantity;
    if (effect.bucket === 'DAMAGED') deltas.damaged += effect.quantity;
  }
  return deltas;
}

/** Sellable stock excludes quantities already committed to a customer. */
export function sellableQuantity(onHand: number, reserved: number): number {
  return Math.max(0, onHand - reserved);
}

/**
 * Availability policy: any sellable unit means IN_STOCK. With nothing sellable,
 * the product falls back to ENQUIRE when the business still wants enquiries, or
 * UNAVAILABLE when it does not.
 */
export function evaluateAvailability(sellable: number, isEnquiryAllowed: boolean): AvailabilityLabel {
  if (sellable >= IN_STOCK_THRESHOLD) return 'IN_STOCK';
  return isEnquiryAllowed ? 'ENQUIRE' : 'UNAVAILABLE';
}

/** A product is in stock when any one of its active variants is sellable. */
export function evaluateProductAvailability(
  variantSellables: Iterable<number>,
  isEnquiryAllowed: boolean,
): AvailabilityLabel {
  for (const sellable of variantSellables) {
    if (sellable >= IN_STOCK_THRESHOLD) return 'IN_STOCK';
  }
  return isEnquiryAllowed ? 'ENQUIRE' : 'UNAVAILABLE';
}

/**
 * Movement types that mutate availability must run as a controlled posting;
 * this list keeps request validation and service wiring in one place.
 */
export const POSTING_TYPES: readonly InventoryMovementType[] = [
  'RECEIPT',
  'ISSUE',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'ADJUSTMENT_INCREASE',
  'ADJUSTMENT_DECREASE',
  'RESERVE',
  'RELEASE',
  'DAMAGE',
];

export function auditActionFor(type: InventoryMovementType): string {
  return `inventory.${type.toLowerCase()}.posted`;
}
