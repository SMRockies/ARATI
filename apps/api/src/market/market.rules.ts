import type { Prisma } from '@prisma/client';
import { marketProductWhere } from '../catalog/catalog.rules.js';

/**
 * Cache policy for public market responses. The storefront may serve slightly
 * stale catalogue data (published products, availability labels) in exchange for
 * absorbing storefront traffic; operators see live data through the
 * authenticated ERP routes, which are always `private, no-store`.
 */
export const MARKET_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';

/** Public rate limit for the unauthenticated market API, per client IP. */
export const MARKET_RATE_LIMIT = 300;
export const MARKET_RATE_WINDOW_MS = 60_000;

export interface MarketProductFilters {
  /** Free-text search over name, summary and description. */
  q?: string;
  /** Public category slug. */
  category?: string;
  /** Public brand slug. */
  brand?: string;
}

/**
 * The public product query: always the Phase 3 market-visibility filter
 * (published, active product in active masters), optionally narrowed by the
 * storefront's search box or category/brand navigation. Stock never widens the
 * filter, and a filter never has to be trusted to hide unpublished records —
 * the visibility conditions are always present.
 */
export function marketProductsWhere(organizationId: string, filters: MarketProductFilters = {}): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { ...marketProductWhere(organizationId) };

  if (filters.brand) {
    // A brand filter replaces the "no brand or active brand" clause: only
    // products actually attached to the requested active brand may match.
    where.brand = { slug: filters.brand, isActive: true };
    delete where.OR;
  }

  if (filters.category) {
    where.category = { isActive: true, slug: filters.category };
  }

  const term = filters.q?.trim();
  if (term) {
    where.AND = [
      {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { summary: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
        ],
      },
    ];
  }

  return where;
}

/**
 * Public masters (brands/categories): active, belonging to the market
 * organization, and currently carrying at least one product the storefront may
 * show. Empty or inactive masters stay out of the storefront navigation.
 */
export function marketMasterWhere(organizationId: string): Prisma.ProductCategoryWhereInput & Prisma.ProductBrandWhereInput {
  return {
    organizationId,
    isActive: true,
    products: { some: marketProductWhere(organizationId) },
  };
}

export type MarketOrganizationResolution =
  | { ok: true; organizationId: string }
  | { ok: false; reason: 'UNCONFIGURED' | 'AMBIGUOUS' | 'NOT_FOUND' };

/**
 * The public API is single-tenant by configuration: the business decides which
 * organization's catalogue the storefront serves. Operators set
 * `MARKET_ORGANIZATION_ID`; a single-organization deployment (local seed) works
 * with no configuration at all. Fail closed instead of guessing when the answer
 * is ambiguous or the configured organization does not exist.
 */
export function resolveMarketOrganization(
  configuredId: string | null | undefined,
  organizationIds: string[],
): MarketOrganizationResolution {
  if (configuredId) {
    return organizationIds.includes(configuredId)
      ? { ok: true, organizationId: configuredId }
      : { ok: false, reason: 'NOT_FOUND' };
  }
  if (organizationIds.length === 1) return { ok: true, organizationId: organizationIds[0] };
  return { ok: false, reason: organizationIds.length === 0 ? 'UNCONFIGURED' : 'AMBIGUOUS' };
}

/**
 * The exact public product shape. Kept as an explicit key list so tests can
 * prove the response never grows an internal field by accident.
 */
export const MARKET_PRODUCT_KEYS = Object.keys({
  slug: true,
  name: true,
  brand: true,
  category: true,
  summary: true,
  description: true,
  specifications: true,
  image: true,
  availability: true,
}).sort();
