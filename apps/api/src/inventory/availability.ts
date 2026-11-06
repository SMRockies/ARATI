import { PrismaService } from '../prisma.service.js';
import { evaluateProductAvailability, sellableQuantity, type AvailabilityLabel } from './inventory.rules.js';

/**
 * Sums sellable quantity per variant across the warehouses the business allows
 * the market to see. Warehouses with `countsForMarket = false` (for example a
 * quarantine or transit location) are ignored entirely.
 */
export async function loadSellableByVariant(
  prisma: PrismaService,
  organizationId: string,
  variantIds: string[],
): Promise<Map<string, number>> {
  const sellable = new Map<string, number>();
  if (variantIds.length === 0) return sellable;

  const balances = await prisma.stockBalance.findMany({
    where: {
      organizationId,
      variantId: { in: variantIds },
      warehouse: { countsForMarket: true },
    },
    select: { variantId: true, onHand: true, reserved: true },
  });

  for (const balance of balances) {
    const current = sellable.get(balance.variantId) ?? 0;
    sellable.set(balance.variantId, current + sellableQuantity(balance.onHand, balance.reserved));
  }
  return sellable;
}

/** Resolves the public availability label for one product from its active variants. */
export async function loadProductAvailability(
  prisma: PrismaService,
  organizationId: string,
  product: { id: string; isEnquiryAllowed: boolean; variants: Array<{ id: string }> },
): Promise<AvailabilityLabel> {
  const sellable = await loadSellableByVariant(
    prisma,
    organizationId,
    product.variants.map((variant) => variant.id),
  );
  return evaluateProductAvailability(
    product.variants.map((variant) => sellable.get(variant.id) ?? 0),
    product.isEnquiryAllowed,
  );
}
