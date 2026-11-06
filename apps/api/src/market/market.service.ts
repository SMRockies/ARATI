import { HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { AppConfig } from '../config.js';
import { MARKET_PRODUCT_SELECT, resolvePagination, toMarketProduct, type MarketProductRow } from '../catalog/catalog.rules.js';
import { isValidSlug } from '../catalog/slug.js';
import { loadSellableByVariant } from '../inventory/availability.js';
import { evaluateProductAvailability } from '../inventory/inventory.rules.js';
import type { MarketProductQueryDto } from './market.dto.js';
import { marketMasterWhere, marketProductsWhere, resolveMarketOrganization } from './market.rules.js';

/**
 * Read-only public market API. Every method resolves the single market
 * organization first (fail closed when unconfigured or ambiguous), queries
 * through the allow-listed `MARKET_PRODUCT_SELECT` projection, and derives the
 * coarse availability label from the same Phase 3 policy the ERP uses. No route
 * in this service writes anything, and no response carries an internal id,
 * lifecycle flag, code, or stock quantity.
 */
@Injectable()
export class MarketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async listProducts(query: MarketProductQueryDto) {
    const organizationId = await this.resolveOrganization();
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const where = marketProductsWhere(organizationId, {
      q: query.q,
      category: query.category,
      brand: query.brand,
    });

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: MARKET_PRODUCT_SELECT,
        orderBy: [{ name: 'asc' }, { slug: 'asc' }],
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
    ]);

    const items = await this.toMarketItems(organizationId, rows);
    return { items, page: { page, limit, total, hasMore: skip + rows.length < total } };
  }

  async getProduct(slug: string) {
    if (!isValidSlug(slug)) {
      throw new HttpException({ code: 'MARKET_PRODUCT_NOT_FOUND', message: 'No published product matches that address.' }, HttpStatus.NOT_FOUND);
    }
    const organizationId = await this.resolveOrganization();
    const row = await this.prisma.product.findFirst({
      where: { ...marketProductsWhere(organizationId), slug },
      select: MARKET_PRODUCT_SELECT,
    });
    if (!row) {
      throw new HttpException({ code: 'MARKET_PRODUCT_NOT_FOUND', message: 'No published product matches that address.' }, HttpStatus.NOT_FOUND);
    }
    const [item] = await this.toMarketItems(organizationId, [row]);
    return item;
  }

  async listBrands(query: MarketProductQueryDto) {
    const organizationId = await this.resolveOrganization();
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const where: Prisma.ProductBrandWhereInput = {
      ...marketMasterWhere(organizationId),
      ...(query.brand ? { slug: query.brand } : {}),
      ...(query.q
        ? { name: { contains: query.q.trim(), mode: 'insensitive' as const } }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.productBrand.findMany({
        where,
        select: { slug: true, name: true },
        orderBy: [{ name: 'asc' }, { slug: 'asc' }],
        skip,
        take,
      }),
      this.prisma.productBrand.count({ where }),
    ]);
    return { items: rows, page: { page, limit, total, hasMore: skip + rows.length < total } };
  }

  async listCategories(query: MarketProductQueryDto) {
    const organizationId = await this.resolveOrganization();
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const where: Prisma.ProductCategoryWhereInput = {
      ...marketMasterWhere(organizationId),
      ...(query.category ? { slug: query.category } : {}),
      ...(query.q
        ? { name: { contains: query.q.trim(), mode: 'insensitive' as const } }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.productCategory.findMany({
        where,
        select: { slug: true, name: true },
        orderBy: [{ name: 'asc' }, { slug: 'asc' }],
        skip,
        take,
      }),
      this.prisma.productCategory.count({ where }),
    ]);
    return { items: rows, page: { page, limit, total, hasMore: skip + rows.length < total } };
  }

  // ------------------------------------------------------------------ helpers

  private async resolveOrganization(): Promise<string> {
    const organizationIds = (await this.prisma.organization.findMany({ select: { id: true } })).map((row) => row.id);
    const resolution = resolveMarketOrganization(this.config.marketOrganizationId, organizationIds);
    if (resolution.ok) return resolution.organizationId;
    // Fail closed: never guess which tenant's catalogue to publish.
    throw new ServiceUnavailableException({
      code: 'MARKET_NOT_CONFIGURED',
      message:
        resolution.reason === 'AMBIGUOUS'
          ? 'The public market API needs MARKET_ORGANIZATION_ID to be configured for this deployment.'
          : 'The public market API is not configured for this deployment.',
    });
  }

  private async toMarketItems(organizationId: string, rows: MarketProductRow[]) {
    const variantIds = rows.flatMap((row) => row.variants.map((variant) => variant.id));
    const sellable = await loadSellableByVariant(this.prisma, organizationId, variantIds);
    return rows.map((row) =>
      toMarketProduct(
        row,
        evaluateProductAvailability(
          row.variants.map((variant) => sellable.get(variant.id) ?? 0),
          row.isEnquiryAllowed,
        ),
      ),
    );
  }
}
