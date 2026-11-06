import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import type {
  CatalogListQueryDto,
  CreateBrandDto,
  CreateCategoryDto,
  CreateProductDto,
  CreateVariantDto,
  PaginationQueryDto,
  ProductListQueryDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './catalog.dto.js';
import {
  deactivationPatch,
  evaluateActivation,
  evaluatePublish,
  MARKET_PRODUCT_SELECT,
  marketProductWhere,
  readSpecifications,
  resolvePagination,
  toMarketProduct,
} from './catalog.rules.js';
import { isValidSlug, slugify } from './slug.js';
import { loadSellableByVariant } from '../inventory/availability.js';
import { evaluateProductAvailability } from '../inventory/inventory.rules.js';

const categorySelect = {
  id: true,
  code: true,
  name: true,
  slug: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductCategorySelect;

const brandSelect = {
  id: true,
  code: true,
  name: true,
  slug: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductBrandSelect;

const variantSelect = {
  id: true,
  sku: true,
  name: true,
  unitOfMeasure: true,
  attributes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductVariantSelect;

const productSelect = {
  id: true,
  code: true,
  name: true,
  slug: true,
  lifecycleStatus: true,
  isPublished: true,
  publishedAt: true,
  isEnquiryAllowed: true,
  trackingMode: true,
  summary: true,
  description: true,
  specifications: true,
  imageUrl: true,
  imageAlt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, code: true, name: true, slug: true, isActive: true } },
  brand: { select: { id: true, code: true, name: true, slug: true, isActive: true } },
  variants: { select: variantSelect, orderBy: { sku: 'asc' } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- categories

  async listCategories(organizationId: string, query: CatalogListQueryDto) {
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const where: Prisma.ProductCategoryWhereInput = {
      organizationId,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q.trim(), mode: 'insensitive' as const } },
              { slug: { contains: query.q.trim().toLowerCase(), mode: 'insensitive' as const } },
              { code: { contains: query.q.trim().toUpperCase() } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.productCategory.findMany({ where, select: categorySelect, orderBy: { code: 'asc' }, skip, take }),
      this.prisma.productCategory.count({ where }),
    ]);
    return { items, page: { page, limit, total, hasMore: skip + items.length < total } };
  }

  async createCategory(userId: string, organizationId: string, dto: CreateCategoryDto) {
    const slug = this.resolveSlug(dto.slug, dto.name);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const category = await transaction.productCategory.create({
          data: {
            organizationId,
            code: dto.code,
            name: dto.name.trim(),
            slug,
            description: dto.description ?? null,
          },
          select: categorySelect,
        });
        await transaction.auditEvent.create({
          data: {
            userId,
            organizationId,
            action: 'catalog.category.created',
            metadata: { categoryId: category.id, code: category.code, slug: category.slug },
          },
        });
        return category;
      });
    } catch (error) {
      this.translateUniqueViolation(error, 'CATEGORY_EXISTS', 'A category with that code or slug already exists in this organization.');
    }
  }

  async updateCategory(
    userId: string,
    organizationId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ) {
    this.assertHasChanges(dto, 'category');
    await this.requireCategoryRow(organizationId, categoryId);
    const data: Prisma.ProductCategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.$transaction(async (transaction) => {
      const category = await transaction.productCategory.update({ where: { id: categoryId }, data, select: categorySelect });
      await transaction.auditEvent.create({
        data: {
          userId,
          organizationId,
          action: 'catalog.category.updated',
          metadata: { categoryId, changedFields: Object.keys(dto) },
        },
      });
      return category;
    });
  }

  // -------------------------------------------------------------------- brands

  async listBrands(organizationId: string, query: CatalogListQueryDto) {
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const where: Prisma.ProductBrandWhereInput = {
      organizationId,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q.trim(), mode: 'insensitive' as const } },
              { slug: { contains: query.q.trim().toLowerCase(), mode: 'insensitive' as const } },
              { code: { contains: query.q.trim().toUpperCase() } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.productBrand.findMany({ where, select: brandSelect, orderBy: { code: 'asc' }, skip, take }),
      this.prisma.productBrand.count({ where }),
    ]);
    return { items, page: { page, limit, total, hasMore: skip + items.length < total } };
  }

  async createBrand(userId: string, organizationId: string, dto: CreateBrandDto) {
    const slug = this.resolveSlug(dto.slug, dto.name);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const brand = await transaction.productBrand.create({
          data: {
            organizationId,
            code: dto.code,
            name: dto.name.trim(),
            slug,
            description: dto.description ?? null,
          },
          select: brandSelect,
        });
        await transaction.auditEvent.create({
          data: {
            userId,
            organizationId,
            action: 'catalog.brand.created',
            metadata: { brandId: brand.id, code: brand.code, slug: brand.slug },
          },
        });
        return brand;
      });
    } catch (error) {
      this.translateUniqueViolation(error, 'BRAND_EXISTS', 'A brand with that code or slug already exists in this organization.');
    }
  }

  async updateBrand(userId: string, organizationId: string, brandId: string, dto: UpdateBrandDto) {
    this.assertHasChanges(dto, 'brand');
    await this.requireBrandRow(organizationId, brandId);
    const data: Prisma.ProductBrandUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.$transaction(async (transaction) => {
      const brand = await transaction.productBrand.update({ where: { id: brandId }, data, select: brandSelect });
      await transaction.auditEvent.create({
        data: {
          userId,
          organizationId,
          action: 'catalog.brand.updated',
          metadata: { brandId, changedFields: Object.keys(dto) },
        },
      });
      return brand;
    });
  }

  // ------------------------------------------------------------------ products

  async listProducts(organizationId: string, query: ProductListQueryDto) {
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const where: Prisma.ProductWhereInput = {
      organizationId,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.lifecycleStatus ? { lifecycleStatus: query.lifecycleStatus } : {}),
      ...(query.isPublished === undefined ? {} : { isPublished: query.isPublished }),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q.trim(), mode: 'insensitive' as const } },
              { slug: { contains: query.q.trim().toLowerCase(), mode: 'insensitive' as const } },
              { summary: { contains: query.q.trim(), mode: 'insensitive' as const } },
              { code: { contains: query.q.trim().toUpperCase() } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, select: productSelect, orderBy: [{ code: 'asc' }], skip, take }),
      this.prisma.product.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.presentProduct(row)),
      page: { page, limit, total, hasMore: skip + rows.length < total },
    };
  }

  async getProduct(organizationId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
      select: productSelect,
    });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product was not found in this organization.' });
    return this.presentProduct(product);
  }

  async createProduct(userId: string, organizationId: string, dto: CreateProductDto) {
    await this.requireCategoryRow(organizationId, dto.categoryId);
    if (dto.brandId) await this.requireBrandRow(organizationId, dto.brandId);
    const slug = this.resolveSlug(dto.slug, dto.name);

    try {
      const product = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.product.create({
          data: {
            organizationId,
            categoryId: dto.categoryId,
            brandId: dto.brandId ?? null,
            code: dto.code,
            name: dto.name.trim(),
            slug,
            trackingMode: dto.trackingMode,
            ...(dto.isEnquiryAllowed === undefined ? {} : { isEnquiryAllowed: dto.isEnquiryAllowed }),
            summary: dto.summary ?? null,
            description: dto.description ?? null,
            specifications: (dto.specifications ?? []) as unknown as Prisma.InputJsonValue,
            imageUrl: dto.imageUrl ?? null,
            imageAlt: dto.imageAlt ?? null,
          },
          select: productSelect,
        });
        await transaction.auditEvent.create({
          data: {
            userId,
            organizationId,
            action: 'catalog.product.created',
            metadata: { productId: created.id, code: created.code, slug: created.slug },
          },
        });
        return created;
      });
      return this.presentProduct(product);
    } catch (error) {
      this.translateUniqueViolation(error, 'PRODUCT_EXISTS', 'A product with that code or slug already exists in this organization.');
    }
  }

  async updateProduct(userId: string, organizationId: string, productId: string, dto: UpdateProductDto) {
    this.assertHasChanges(dto, 'product');
    await this.requireProductRow(organizationId, productId);
    if (dto.categoryId !== undefined) await this.requireCategoryRow(organizationId, dto.categoryId);
    if (dto.brandId) await this.requireBrandRow(organizationId, dto.brandId);

    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.categoryId !== undefined) data.category = { connect: { id: dto.categoryId } };
    if (dto.brandId !== undefined) data.brand = dto.brandId === null ? { disconnect: true } : { connect: { id: dto.brandId } };
    if (dto.trackingMode !== undefined) data.trackingMode = dto.trackingMode;
    if (dto.isEnquiryAllowed !== undefined) data.isEnquiryAllowed = dto.isEnquiryAllowed;
    if (dto.summary !== undefined) data.summary = dto.summary;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.specifications !== undefined) {
      data.specifications = dto.specifications as unknown as Prisma.InputJsonValue;
    }
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.imageAlt !== undefined) data.imageAlt = dto.imageAlt;

    const product = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.product.update({ where: { id: productId }, data, select: productSelect });
      await transaction.auditEvent.create({
        data: {
          userId,
          organizationId,
          action: 'catalog.product.updated',
          metadata: { productId, changedFields: Object.keys(dto) },
        },
      });
      return updated;
    });
    return this.presentProduct(product);
  }

  async activateProduct(userId: string, organizationId: string, productId: string) {
    const product = await this.requireProductRow(organizationId, productId);
    if (product.lifecycleStatus === 'ACTIVE') return this.getProduct(organizationId, productId);

    const activeVariantCount = await this.prisma.productVariant.count({ where: { productId, isActive: true } });
    const rule = evaluateActivation(product.lifecycleStatus, activeVariantCount);
    if (!rule.ok) throw new ConflictException(rule.failure);

    const updated = await this.prisma.$transaction(async (transaction) => {
      const next = await transaction.product.update({
        where: { id: productId },
        data: { lifecycleStatus: 'ACTIVE' },
        select: productSelect,
      });
      await transaction.auditEvent.create({
        data: { userId, organizationId, action: 'catalog.product.activated', metadata: { productId } },
      });
      return next;
    });
    return this.presentProduct(updated);
  }

  async deactivateProduct(userId: string, organizationId: string, productId: string) {
    const product = await this.requireProductRow(organizationId, productId);
    const update = deactivationPatch();
    if (product.lifecycleStatus === update.lifecycleStatus && !product.isPublished) {
      return this.getProduct(organizationId, productId);
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      const next = await transaction.product.update({ where: { id: productId }, data: update, select: productSelect });
      await transaction.auditEvent.create({
        data: {
          userId,
          organizationId,
          action: 'catalog.product.deactivated',
          metadata: { productId, wasPublished: product.isPublished },
        },
      });
      return next;
    });
    return this.presentProduct(updated);
  }

  async publishProduct(userId: string, organizationId: string, productId: string) {
    const product = await this.requireProductRow(organizationId, productId);
    if (product.isPublished) return this.getProduct(organizationId, productId);

    const activeVariantCount = await this.prisma.productVariant.count({ where: { productId, isActive: true } });
    const rule = evaluatePublish(product.lifecycleStatus, activeVariantCount);
    if (!rule.ok) throw new ConflictException(rule.failure);

    const now = new Date();
    const updated = await this.prisma.$transaction(async (transaction) => {
      const next = await transaction.product.update({
        where: { id: productId },
        data: { isPublished: true, publishedAt: now },
        select: productSelect,
      });
      await transaction.auditEvent.create({
        data: { userId, organizationId, action: 'catalog.product.published', metadata: { productId } },
      });
      return next;
    });
    return this.presentProduct(updated);
  }

  async unpublishProduct(userId: string, organizationId: string, productId: string) {
    const product = await this.requireProductRow(organizationId, productId);
    if (!product.isPublished) return this.getProduct(organizationId, productId);

    const updated = await this.prisma.$transaction(async (transaction) => {
      const next = await transaction.product.update({
        where: { id: productId },
        data: { isPublished: false, publishedAt: null },
        select: productSelect,
      });
      await transaction.auditEvent.create({
        data: { userId, organizationId, action: 'catalog.product.unpublished', metadata: { productId } },
      });
      return next;
    });
    return this.presentProduct(updated);
  }

  // ------------------------------------------------------------------ variants

  async createVariant(
    userId: string,
    organizationId: string,
    productId: string,
    dto: CreateVariantDto,
  ) {
    await this.requireProductRow(organizationId, productId);
    const attributes = this.normalizeAttributes(dto.attributes);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const variant = await transaction.productVariant.create({
          data: {
            organizationId,
            productId,
            sku: dto.sku,
            name: dto.name.trim(),
            unitOfMeasure: (dto.unitOfMeasure ?? 'PCS').toUpperCase(),
            attributes: attributes as Prisma.InputJsonValue,
          },
          select: variantSelect,
        });
        await transaction.auditEvent.create({
          data: {
            userId,
            organizationId,
            action: 'catalog.variant.created',
            metadata: { productId, sku: variant.sku },
          },
        });
        return variant;
      });
    } catch (error) {
      this.translateUniqueViolation(error, 'VARIANT_SKU_EXISTS', 'A variant with that SKU already exists in this organization.');
    }
  }

  async updateVariant(
    userId: string,
    organizationId: string,
    variantId: string,
    dto: UpdateVariantDto,
  ) {
    this.assertHasChanges(dto, 'variant');
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, organizationId },
      select: { id: true, sku: true, productId: true, isActive: true },
    });
    if (!variant) throw new NotFoundException({ code: 'VARIANT_NOT_FOUND', message: 'Variant was not found in this organization.' });

    if (dto.isActive === false && variant.isActive) {
      const product = await this.requireProductRow(organizationId, variant.productId);
      if (product.isPublished) {
        const remaining = await this.prisma.productVariant.count({
          where: { productId: variant.productId, isActive: true, id: { not: variantId } },
        });
        if (remaining === 0) {
          throw new ConflictException({
            code: 'PUBLISHED_PRODUCT_REQUIRES_ACTIVE_VARIANT',
            message: 'Unpublish or deactivate the product before removing its last sellable variant.',
          });
        }
      }
    }

    const data: Prisma.ProductVariantUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.unitOfMeasure !== undefined) data.unitOfMeasure = dto.unitOfMeasure.toUpperCase();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.productVariant.update({ where: { id: variantId }, data, select: variantSelect });
      await transaction.auditEvent.create({
        data: {
          userId,
          organizationId,
          action: 'catalog.variant.updated',
          metadata: { productId: variant.productId, sku: variant.sku, changedFields: Object.keys(dto) },
        },
      });
      return updated;
    });
  }

  // ----------------------------------------------------------- market projection

  /** Authenticated preview of exactly what the public market projection will serve. */
  async marketPreview(organizationId: string, query: PaginationQueryDto) {
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const where = marketProductWhere(organizationId);
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
    const sellable = await loadSellableByVariant(
      this.prisma,
      organizationId,
      rows.flatMap((row) => row.variants.map((variant) => variant.id)),
    );

    return {
      items: rows.map((row) =>
        toMarketProduct(
          row,
          evaluateProductAvailability(
            row.variants.map((variant) => sellable.get(variant.id) ?? 0),
            row.isEnquiryAllowed,
          ),
        ),
      ),
      page: { page, limit, total, hasMore: skip + rows.length < total },
    };
  }

  // -------------------------------------------------------------------- helpers

  private presentProduct(product: ProductRow) {
    return { ...product, specifications: readSpecifications(product.specifications) };
  }

  private resolveSlug(explicitSlug: string | undefined, name: string): string {
    const slug = explicitSlug ?? slugify(name);
    if (!isValidSlug(slug)) {
      throw new BadRequestException({
        code: 'INVALID_SLUG',
        message: 'A valid slug could not be derived from the name; provide a lowercase hyphenated slug.',
      });
    }
    return slug;
  }

  private async requireCategoryRow(organizationId: string, categoryId: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id: categoryId, organizationId },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Category was not found in this organization.' });
    }
    return category;
  }

  private async requireBrandRow(organizationId: string, brandId: string) {
    const brand = await this.prisma.productBrand.findFirst({
      where: { id: brandId, organizationId },
      select: { id: true },
    });
    if (!brand) {
      throw new NotFoundException({ code: 'BRAND_NOT_FOUND', message: 'Brand was not found in this organization.' });
    }
    return brand;
  }

  private async requireProductRow(organizationId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
      select: { id: true, lifecycleStatus: true, isPublished: true },
    });
    if (!product) {
      throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product was not found in this organization.' });
    }
    return product;
  }

  private assertHasChanges(dto: object, subject: string): void {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException({ code: 'EMPTY_UPDATE', message: `No ${subject} fields were provided to update.` });
    }
  }

  private normalizeAttributes(attributes?: Record<string, unknown>): Record<string, string | number | boolean> {
    if (!attributes) return {};
    const entries = Object.entries(attributes);
    if (entries.length > 20) {
      throw new BadRequestException({ code: 'INVALID_ATTRIBUTES', message: 'At most 20 variant attributes are allowed.' });
    }
    const normalized: Record<string, string | number | boolean> = {};
    for (const [key, value] of entries) {
      if (key.length === 0 || key.length > 60) {
        throw new BadRequestException({ code: 'INVALID_ATTRIBUTES', message: 'Attribute names must be 1-60 characters.' });
      }
      if (!['string', 'number', 'boolean'].includes(typeof value)) {
        throw new BadRequestException({ code: 'INVALID_ATTRIBUTES', message: 'Attribute values must be strings, numbers, or booleans.' });
      }
      if (typeof value === 'string' && value.length > 200) {
        throw new BadRequestException({ code: 'INVALID_ATTRIBUTES', message: 'Attribute values must be at most 200 characters.' });
      }
      normalized[key] = value as string | number | boolean;
    }
    if (JSON.stringify(normalized).length > 2000) {
      throw new BadRequestException({ code: 'INVALID_ATTRIBUTES', message: 'Variant attributes must serialize to at most 2000 characters.' });
    }
    return normalized;
  }

  private translateUniqueViolation(error: unknown, code: string, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({ code, message });
    }
    throw error;
  }
}
