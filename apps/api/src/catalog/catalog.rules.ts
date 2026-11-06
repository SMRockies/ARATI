import type { Prisma } from '@prisma/client';
import type { AvailabilityLabel } from '../inventory/inventory.rules.js';

export const DEFAULT_PAGE_LIMIT = 24;
export const MAX_PAGE_LIMIT = 100;

export interface MarketProduct {
  slug: string;
  name: string;
  brand: { slug: string; name: string } | null;
  category: { slug: string; name: string };
  summary: string | null;
  description: string | null;
  specifications: Array<{ name: string; value: string }>;
  image: { url: string; alt: string } | null;
  /** Coarse, server-decided availability. No quantities are ever exposed. */
  availability: AvailabilityLabel;
}

/**
 * Explicit allow list for the market projection. Only fields in this select can
 * reach the public view model; internal columns (organization, lifecycle flags,
 * codes, audit fields) are deliberately absent.
 */
export const MARKET_PRODUCT_SELECT = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  description: true,
  specifications: true,
  imageUrl: true,
  imageAlt: true,
  isEnquiryAllowed: true,
  category: { select: { slug: true, name: true } },
  brand: { select: { slug: true, name: true } },
  // Variant ids are needed only to aggregate stock into the availability label;
  // they are never serialized into the market response.
  variants: { where: { isActive: true }, select: { id: true } },
} satisfies Prisma.ProductSelect;

export type MarketProductRow = Prisma.ProductGetPayload<{ select: typeof MARKET_PRODUCT_SELECT }>;

/**
 * Market visibility is decided on the server: a product must be published and
 * active, its category must be active, and any attached brand must be active.
 * Stock levels never widen this filter, and they never silently remove a
 * published product either: out-of-stock products stay visible with an
 * ENQUIRE or UNAVAILABLE label so the operator's publication decision and the
 * product's stable URL both hold.
 */
export function marketProductWhere(organizationId: string): Prisma.ProductWhereInput {
  return {
    organizationId,
    isPublished: true,
    lifecycleStatus: 'ACTIVE',
    category: { isActive: true },
    OR: [{ brandId: null }, { brand: { isActive: true } }],
  };
}

export function readSpecifications(value: Prisma.JsonValue | null | undefined): Array<{ name: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
    const name = 'name' in entry ? entry.name : undefined;
    const specificationValue = 'value' in entry ? entry.value : undefined;
    if (typeof name !== 'string' || typeof specificationValue !== 'string') return [];
    return [{ name, value: specificationValue }];
  });
}

export function toMarketProduct(row: MarketProductRow, availability: AvailabilityLabel): MarketProduct {
  return {
    slug: row.slug,
    name: row.name,
    brand: row.brand ? { slug: row.brand.slug, name: row.brand.name } : null,
    category: { slug: row.category.slug, name: row.category.name },
    summary: row.summary,
    description: row.description,
    specifications: readSpecifications(row.specifications),
    image: row.imageUrl ? { url: row.imageUrl, alt: row.imageAlt ?? row.name } : null,
    availability,
  };
}

export type CatalogueRuleFailure = { code: string; message: string };
export type CatalogueRuleResult = { ok: true } | { ok: false; failure: CatalogueRuleFailure };

function failure(code: string, message: string): CatalogueRuleResult {
  return { ok: false, failure: { code, message } };
}

/**
 * Products can only be activated once they have at least one active variant, so
 * an operator cannot publish a catalogue entry that has no sellable SKU.
 */
export function evaluateActivation(lifecycleStatus: string, activeVariantCount: number): CatalogueRuleResult {
  if (lifecycleStatus === 'ACTIVE') return { ok: true };
  if (activeVariantCount < 1) {
    return failure('PRODUCT_REQUIRES_ACTIVE_VARIANT', 'A product needs at least one active variant before it can be activated.');
  }
  return { ok: true };
}

/**
 * Publication is only allowed for active products with a sellable variant.
 * Deactivation and unpublishing are always allowed and always take a product
 * out of the market projection.
 */
export function evaluatePublish(lifecycleStatus: string, activeVariantCount: number): CatalogueRuleResult {
  if (lifecycleStatus !== 'ACTIVE') {
    return failure('PRODUCT_NOT_ACTIVE', 'Only active products can be published to the market.');
  }
  if (activeVariantCount < 1) {
    return failure('PRODUCT_REQUIRES_ACTIVE_VARIANT', 'A product needs at least one active variant before it can be published.');
  }
  return { ok: true };
}

/** Deactivation hides the product everywhere and clears its publication state. */
export function deactivationPatch(): { lifecycleStatus: 'INACTIVE'; isPublished: false; publishedAt: null } {
  return { lifecycleStatus: 'INACTIVE', isPublished: false, publishedAt: null };
}

export function resolvePagination(page?: number, limit?: number): { page: number; limit: number; skip: number; take: number } {
  const safePage = Number.isInteger(page) && page && page > 0 ? page : 1;
  const requestedLimit = Number.isInteger(limit) && limit && limit > 0 ? limit : DEFAULT_PAGE_LIMIT;
  const safeLimit = Math.min(requestedLimit, MAX_PAGE_LIMIT);
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit, take: safeLimit };
}
