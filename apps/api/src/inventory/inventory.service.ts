import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type InventoryMovementType } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import type { AuthorizationScope } from '../auth/auth.types.js';
import { resolvePagination } from '../catalog/catalog.rules.js';
import {
  AdjustmentDto,
  DamageDto,
  InventoryQueryDto,
  MovementQueryDto,
  TransferDto,
  ReceiptDto,
  ReceiptVariantQueryDto,
  WarehousePostingDto,
} from './inventory.dto.js';
import type { StoredProof } from './proof-storage.service.js';
import {
  auditActionFor,
  bucketDeltas,
  evaluateAvailability,
  evaluateProductAvailability,
  movementEffects,
  sellableQuantity,
  type BucketDeltas,
} from './inventory.rules.js';

interface PostingLine {
  warehouseId: string;
  variantId: string;
  type: InventoryMovementType;
  quantity: number;
}

interface PostingRequest {
  type: InventoryMovementType;
  lines: PostingLine[];
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  idempotencyKey?: string | null;
  proof?: StoredProof | null;
}

const postingSelect = {
  id: true,
  type: true,
  idempotencyKey: true,
  referenceType: true,
  referenceId: true,
  reason: true,
  createdAt: true,
  proofAttachment: {
    select: { id: true, fileName: true, mimeType: true, fileSizeBytes: true, sha256: true, createdAt: true },
  },
  movements: {
    select: {
      id: true,
      warehouseId: true,
      variantId: true,
      type: true,
      bucket: true,
      quantity: true,
      referenceType: true,
      referenceId: true,
      reason: true,
      occurredAt: true,
      warehouse: { select: { code: true, name: true } },
      variant: { select: { sku: true, name: true } },
    },
    orderBy: [{ occurredAt: 'asc' }, { bucket: 'asc' }],
  },
} satisfies Prisma.InventoryPostingSelect;

type PostingRow = Prisma.InventoryPostingGetPayload<{ select: typeof postingSelect }>;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------- postings

  postReceipt(userId: string, scope: AuthorizationScope, dto: ReceiptDto, proof: StoredProof) {
    return this.post(userId, scope, {
      type: 'RECEIPT',
      lines: [{ warehouseId: dto.warehouseId, variantId: dto.variantId, type: 'RECEIPT', quantity: dto.quantity }],
      referenceType: 'receipt',
      referenceId: dto.referenceId ?? null,
      reason: dto.reference?.trim() || null,
      idempotencyKey: dto.idempotencyKey ?? null,
      proof,
    });
  }

  postIssue(userId: string, scope: AuthorizationScope, dto: WarehousePostingDto) {
    return this.post(userId, scope, {
      type: 'ISSUE',
      lines: this.warehouseLines(dto, 'ISSUE'),
      ...this.postingMetadata(dto),
    });
  }

  postReservation(userId: string, scope: AuthorizationScope, dto: WarehousePostingDto) {
    return this.post(userId, scope, {
      type: 'RESERVE',
      lines: this.warehouseLines(dto, 'RESERVE'),
      ...this.postingMetadata(dto),
    });
  }

  postRelease(userId: string, scope: AuthorizationScope, dto: WarehousePostingDto) {
    return this.post(userId, scope, {
      type: 'RELEASE',
      lines: this.warehouseLines(dto, 'RELEASE'),
      ...this.postingMetadata(dto),
    });
  }

  postDamage(userId: string, scope: AuthorizationScope, dto: DamageDto) {
    return this.post(userId, scope, {
      type: 'DAMAGE',
      lines: dto.lines.map((line) => ({
        warehouseId: dto.warehouseId,
        variantId: line.variantId,
        type: 'DAMAGE' as const,
        quantity: line.quantity,
      })),
      reason: dto.reason,
      idempotencyKey: dto.idempotencyKey ?? null,
    });
  }

  /**
   * Adjustments are signed. Positive quantities increase on-hand stock and
   * negative quantities decrease it; the posting header records the direction
   * that dominates so an auditor can read the intent at a glance.
   */
  postAdjustment(userId: string, scope: AuthorizationScope, dto: AdjustmentDto) {
    const lines: PostingLine[] = dto.lines.map((line) => ({
      warehouseId: dto.warehouseId,
      variantId: line.variantId,
      type: line.quantity > 0 ? 'ADJUSTMENT_INCREASE' : 'ADJUSTMENT_DECREASE',
      quantity: Math.abs(line.quantity),
    }));
    return this.post(userId, scope, {
      type: lines.some((line) => line.type === 'ADJUSTMENT_INCREASE') ? 'ADJUSTMENT_INCREASE' : 'ADJUSTMENT_DECREASE',
      lines,
      reason: dto.reason,
      idempotencyKey: dto.idempotencyKey ?? null,
    });
  }

  /** A transfer posts paired out/in movements in one transaction. */
  postTransfer(userId: string, scope: AuthorizationScope, dto: TransferDto) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new ConflictException({
        code: 'SAME_WAREHOUSE_TRANSFER',
        message: 'A transfer needs two different warehouses.',
      });
    }
    const lines: PostingLine[] = dto.lines.flatMap((line) => [
      { warehouseId: dto.fromWarehouseId, variantId: line.variantId, type: 'TRANSFER_OUT' as const, quantity: line.quantity },
      { warehouseId: dto.toWarehouseId, variantId: line.variantId, type: 'TRANSFER_IN' as const, quantity: line.quantity },
    ]);
    return this.post(userId, scope, {
      type: 'TRANSFER_OUT',
      lines,
      ...this.postingMetadata(dto),
    });
  }

  // --------------------------------------------------------------------- reads

  async listBalances(scope: AuthorizationScope, query: InventoryQueryDto) {
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const where: Prisma.StockBalanceWhereInput = {
      organizationId: scope.organizationId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(scope.branchIds ? { warehouse: { branchId: { in: scope.branchIds } } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockBalance.findMany({
        where,
        select: {
          id: true,
          warehouseId: true,
          variantId: true,
          onHand: true,
          reserved: true,
          damaged: true,
          updatedAt: true,
          warehouse: { select: { code: true, name: true, countsForMarket: true } },
          variant: { select: { sku: true, name: true, product: { select: { name: true, slug: true } } } },
        },
        orderBy: [{ warehouseId: 'asc' }, { variantId: 'asc' }],
        skip,
        take,
      }),
      this.prisma.stockBalance.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({ ...row, sellable: sellableQuantity(row.onHand, row.reserved) })),
      page: { page, limit, total, hasMore: skip + rows.length < total },
    };
  }

  async listMovements(scope: AuthorizationScope, query: MovementQueryDto) {
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const where: Prisma.InventoryMovementWhereInput = {
      organizationId: scope.organizationId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.postingId ? { postingId: query.postingId } : {}),
      ...(query.bucket ? { bucket: query.bucket } : {}),
      ...(scope.branchIds ? { warehouse: { branchId: { in: scope.branchIds } } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        select: {
          id: true,
          postingId: true,
          warehouseId: true,
          variantId: true,
          type: true,
          bucket: true,
          quantity: true,
          referenceType: true,
          referenceId: true,
          reason: true,
          occurredAt: true,
          posting: {
            select: {
              proofAttachment: { select: { id: true, fileName: true, mimeType: true } },
            },
          },
          warehouse: { select: { code: true, name: true } },
          variant: { select: { sku: true, name: true } },
        },
        orderBy: [{ occurredAt: 'desc' }, { bucket: 'asc' }],
        skip,
        take,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    return { items: rows, page: { page, limit, total, hasMore: skip + rows.length < total } };
  }

  listWarehouses(scope: AuthorizationScope) {
    return this.prisma.warehouse.findMany({
      where: {
        branch: { organizationId: scope.organizationId },
        ...(scope.branchIds ? { branchId: { in: scope.branchIds } } : {}),
      },
      select: { id: true, code: true, name: true },
      orderBy: [{ code: 'asc' }],
    });
  }

  async listReceiptVariants(scope: AuthorizationScope, query: ReceiptVariantQueryDto) {
    const search = query.q?.trim();
    return this.prisma.productVariant.findMany({
      where: {
        organizationId: scope.organizationId,
        isActive: true,
        product: { lifecycleStatus: 'ACTIVE' },
        ...(search
          ? {
              OR: [
                { sku: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { product: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      select: { id: true, sku: true, name: true, product: { select: { name: true } } },
      orderBy: [{ sku: 'asc' }],
      take: Math.min(query.limit ?? 30, 100),
    });
  }

  async getProof(scope: AuthorizationScope, postingId: string) {
    const posting = await this.prisma.inventoryPosting.findFirst({
      where: {
        id: postingId,
        organizationId: scope.organizationId,
        type: 'RECEIPT',
        movements: scope.branchIds ? { some: { warehouse: { branchId: { in: scope.branchIds } } } } : undefined,
      },
      select: {
        proofAttachment: {
          select: { storageKey: true, fileName: true, mimeType: true, fileSizeBytes: true, sha256: true },
        },
      },
    });
    if (!posting?.proofAttachment) {
      throw new NotFoundException({ code: 'PROOF_NOT_FOUND', message: 'Receipt proof was not found in your access scope.' });
    }
    return posting.proofAttachment;
  }

  /**
   * Compares every stored balance with the ledger total that produced it. This
   * is the reconciliation check an operator can run after any suspect posting;
   * the service never repairs balances automatically.
   */
  async reconcile(scope: AuthorizationScope) {
    const balanceWhere: Prisma.StockBalanceWhereInput = {
      organizationId: scope.organizationId,
      ...(scope.branchIds ? { warehouse: { branchId: { in: scope.branchIds } } } : {}),
    };
    const movementWhere: Prisma.InventoryMovementWhereInput = {
      organizationId: scope.organizationId,
      ...(scope.branchIds ? { warehouse: { branchId: { in: scope.branchIds } } } : {}),
    };

    const [balances, ledger] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where: balanceWhere,
        select: {
          warehouseId: true,
          variantId: true,
          onHand: true,
          reserved: true,
          damaged: true,
          variant: { select: { sku: true } },
        },
      }),
      this.prisma.inventoryMovement.groupBy({
        by: ['warehouseId', 'variantId', 'bucket'],
        where: movementWhere,
        _sum: { quantity: true },
      }),
    ]);

    const expected = new Map<string, BucketDeltas>();
    for (const entry of ledger) {
      const key = `${entry.warehouseId}:${entry.variantId}`;
      const totals = expected.get(key) ?? { onHand: 0, reserved: 0, damaged: 0 };
      const quantity = entry._sum.quantity ?? 0;
      if (entry.bucket === 'ON_HAND') totals.onHand += quantity;
      if (entry.bucket === 'RESERVED') totals.reserved += quantity;
      if (entry.bucket === 'DAMAGED') totals.damaged += quantity;
      expected.set(key, totals);
    }

    const mismatches: Array<{
      warehouseId: string;
      variantId: string;
      variantSku: string | null;
      bucket: 'ON_HAND' | 'RESERVED' | 'DAMAGED';
      ledger: number;
      balance: number;
    }> = [];

    const seen = new Set<string>();
    for (const balance of balances) {
      const key = `${balance.warehouseId}:${balance.variantId}`;
      seen.add(key);
      const totals = expected.get(key) ?? { onHand: 0, reserved: 0, damaged: 0 };
      for (const [bucket, stored] of [
        ['ON_HAND', balance.onHand],
        ['RESERVED', balance.reserved],
        ['DAMAGED', balance.damaged],
      ] as const) {
        const ledgerTotal = bucket === 'ON_HAND' ? totals.onHand : bucket === 'RESERVED' ? totals.reserved : totals.damaged;
        if (ledgerTotal !== stored) {
          mismatches.push({
            warehouseId: balance.warehouseId,
            variantId: balance.variantId,
            variantSku: balance.variant.sku,
            bucket,
            ledger: ledgerTotal,
            balance: stored,
          });
        }
      }
    }

    for (const [key, totals] of expected) {
      if (seen.has(key)) continue;
      const [warehouseId, variantId] = key.split(':');
      for (const [bucket, ledgerTotal] of [
        ['ON_HAND', totals.onHand],
        ['RESERVED', totals.reserved],
        ['DAMAGED', totals.damaged],
      ] as const) {
        if (ledgerTotal === 0) continue;
        mismatches.push({ warehouseId, variantId, variantSku: null, bucket, ledger: ledgerTotal, balance: 0 });
      }
    }

    return {
      consistent: mismatches.length === 0,
      checked: { balances: balances.length, ledgerTotals: expected.size },
      mismatches,
    };
  }

  /**
   * Operator-facing explanation of the market availability label. It shows the
   * per-warehouse contribution that produced the public label, but is only
   * available through the authenticated inventory permission.
   */
  async availabilityForProduct(scope: AuthorizationScope, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: scope.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        isPublished: true,
        lifecycleStatus: true,
        isEnquiryAllowed: true,
        variants: { where: { isActive: true }, select: { id: true, sku: true, name: true }, orderBy: { sku: 'asc' } },
      },
    });
    if (!product) {
      throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product was not found in this organization.' });
    }

    const balances = await this.prisma.stockBalance.findMany({
      where: {
        organizationId: scope.organizationId,
        variantId: { in: product.variants.map((variant) => variant.id) },
        ...(scope.branchIds ? { warehouse: { branchId: { in: scope.branchIds } } } : {}),
      },
      select: {
        variantId: true,
        onHand: true,
        reserved: true,
        damaged: true,
        warehouse: { select: { id: true, code: true, name: true, countsForMarket: true } },
      },
    });

    const variants = product.variants.map((variant) => {
      const rows = balances.filter((balance) => balance.variantId === variant.id);
      const counted = rows.filter((row) => row.warehouse.countsForMarket);
      const sellable = counted.reduce(
        (total, row) => total + sellableQuantity(row.onHand, row.reserved),
        0,
      );
      return {
        variantId: variant.id,
        sku: variant.sku,
        name: variant.name,
        sellableQuantity: sellable,
        availability: evaluateAvailability(sellable, product.isEnquiryAllowed),
        warehouses: rows.map((row) => ({
          code: row.warehouse.code,
          name: row.warehouse.name,
          countedForMarket: row.warehouse.countsForMarket,
          onHand: row.onHand,
          reserved: row.reserved,
          damaged: row.damaged,
          sellable: sellableQuantity(row.onHand, row.reserved),
        })),
      };
    });

    return {
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        isPublished: product.isPublished,
        lifecycleStatus: product.lifecycleStatus,
        isEnquiryAllowed: product.isEnquiryAllowed,
      },
      availability: evaluateProductAvailability(
        variants.map((variant) => variant.sellableQuantity),
        product.isEnquiryAllowed,
      ),
      sellableQuantity: variants.reduce((total, variant) => total + variant.sellableQuantity, 0),
      variants,
    };
  }

  // ------------------------------------------------------------------ internals

  private warehouseLines(
    dto: WarehousePostingDto,
    type: InventoryMovementType,
  ): PostingLine[] {
    return dto.lines.map((line) => ({
      warehouseId: dto.warehouseId,
      variantId: line.variantId,
      type,
      quantity: line.quantity,
    }));
  }

  private postingMetadata(dto: {
    referenceType?: string;
    referenceId?: string;
    reason?: string;
    idempotencyKey?: string;
  }) {
    return {
      referenceType: dto.referenceType ?? null,
      referenceId: dto.referenceId ?? null,
      reason: dto.reason ?? null,
      idempotencyKey: dto.idempotencyKey ?? null,
    };
  }

  private async post(userId: string, scope: AuthorizationScope, request: PostingRequest) {
    const warehouseIds = [...new Set(request.lines.map((line) => line.warehouseId))];
    for (const warehouseId of warehouseIds) {
      await this.requireWarehouse(scope, warehouseId);
    }
    const variants = await this.requireVariants(scope, [
      ...new Set(request.lines.map((line) => line.variantId)),
    ]);

    if (request.idempotencyKey) {
      const replayed = await this.findPostingByKey(scope.organizationId, request.idempotencyKey);
      if (replayed) return this.replayPosting(replayed, request);
    }

    try {
      const posting = await this.prisma.$transaction(async (transaction) => {
        const header = await transaction.inventoryPosting.create({
          data: {
            organizationId: scope.organizationId,
            type: request.type,
            idempotencyKey: request.idempotencyKey ?? null,
            referenceType: request.referenceType ?? null,
            referenceId: request.referenceId ?? null,
            reason: request.reason ?? null,
            createdByUserId: userId,
          },
        });

        const proofAttachment = request.proof
          ? await transaction.proofAttachment.create({
            data: {
              organizationId: scope.organizationId,
              postingId: header.id,
              storageKey: request.proof.storageKey,
              fileName: request.proof.fileName,
              mimeType: request.proof.mimeType,
              fileSizeBytes: request.proof.fileSizeBytes,
              sha256: request.proof.sha256,
              uploadedByUserId: userId,
            },
          })
          : null;

        for (const line of request.lines) {
          const variant = variants.get(line.variantId)!;
          const effects = movementEffects(line.type, line.quantity);
          await this.applyBalanceDeltas(transaction, {
            organizationId: scope.organizationId,
            warehouseId: line.warehouseId,
            variantId: line.variantId,
            variantSku: variant.sku,
            deltas: bucketDeltas(effects),
          });

          await transaction.inventoryMovement.createMany({
            data: effects.map((effect) => ({
              postingId: header.id,
              organizationId: scope.organizationId,
              warehouseId: line.warehouseId,
              variantId: line.variantId,
              type: line.type,
              bucket: effect.bucket,
              quantity: effect.quantity,
              referenceType: request.referenceType ?? null,
              referenceId: request.referenceId ?? null,
              reason: request.reason ?? null,
              createdByUserId: userId,
            })),
          });
        }

        await transaction.auditEvent.create({
          data: {
            userId,
            organizationId: scope.organizationId,
            action: auditActionFor(request.type),
            metadata: {
              postingId: header.id,
              warehouses: warehouseIds,
              lineCount: request.lines.length,
              referenceType: request.referenceType ?? null,
              referenceId: request.referenceId ?? null,
              reason: request.reason ?? null,
              proofAttachmentId: proofAttachment?.id ?? null,
            },
          },
        });

        return this.loadPosting(transaction, header.id);
      });

      return { ...posting, replayed: false };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        request.idempotencyKey
      ) {
        const replayed = await this.findPostingByKey(scope.organizationId, request.idempotencyKey);
        if (replayed) return this.replayPosting(replayed, request);
      }
      throw error;
    }
  }

  private loadPosting(client: PrismaService | Prisma.TransactionClient, postingId: string): Promise<PostingRow> {
    return client.inventoryPosting.findUniqueOrThrow({
      where: { id: postingId },
      select: postingSelect,
    });
  }

  private async findPostingByKey(organizationId: string, idempotencyKey: string): Promise<PostingRow | null> {
    const header = await this.prisma.inventoryPosting.findFirst({
      where: { organizationId, idempotencyKey },
      select: { id: true },
    });
    return header ? this.loadPosting(this.prisma, header.id) : null;
  }

  private replayPosting(posting: PostingRow, request: PostingRequest) {
    if (request.type === 'RECEIPT') {
      const matches = posting.type === 'RECEIPT'
        && posting.proofAttachment !== null
        && posting.referenceType === (request.referenceType ?? null)
        && posting.referenceId === (request.referenceId ?? null)
        && posting.reason === (request.reason ?? null)
        && posting.movements.length === request.lines.length
        && request.lines.every((line) =>
          posting.movements.some((movement) =>
            movement.warehouseId === line.warehouseId
            && movement.variantId === line.variantId
            && movement.type === line.type
            && movement.quantity === line.quantity,
          ),
        );
      if (!matches) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'This idempotency key already belongs to a different inventory receipt.',
        });
      }
    }
    return { ...posting, replayed: true };
  }

  /**
   * Applies bucket deltas atomically with the guards in the WHERE clause, so
   * concurrent postings cannot oversell or over-reserve: a failed guard updates
   * zero rows and the whole posting rolls back.
   */
  private async applyBalanceDeltas(
    transaction: Prisma.TransactionClient,
    input: {
      organizationId: string;
      warehouseId: string;
      variantId: string;
      variantSku: string;
      deltas: BucketDeltas;
    },
  ): Promise<void> {
    const { onHand, reserved, damaged } = input.deltas;
    if (onHand === 0 && reserved === 0 && damaged === 0) return;

    await transaction.stockBalance.createMany({
      data: [
        {
          organizationId: input.organizationId,
          warehouseId: input.warehouseId,
          variantId: input.variantId,
        },
      ],
      skipDuplicates: true,
    });

    const updated = await transaction.$queryRaw<Array<{ onHand: number; reserved: number; damaged: number }>>`
      UPDATE "stock_balances"
         SET "onHand" = "onHand" + CAST(${onHand} AS integer),
             "reserved" = "reserved" + CAST(${reserved} AS integer),
             "damaged" = "damaged" + CAST(${damaged} AS integer),
             "version" = "version" + 1,
             "updatedAt" = CURRENT_TIMESTAMP
       WHERE "warehouseId" = CAST(${input.warehouseId} AS uuid)
         AND "variantId" = CAST(${input.variantId} AS uuid)
         AND "onHand" + CAST(${onHand} AS integer) >= 0
         AND "reserved" + CAST(${reserved} AS integer) >= 0
         AND "damaged" + CAST(${damaged} AS integer) >= 0
         AND "reserved" + CAST(${reserved} AS integer)
             <= "onHand" + CAST(${onHand} AS integer)
      RETURNING "onHand", "reserved", "damaged"
    `;

    if (updated.length === 0) {
      throw new ConflictException({
        code: 'INSUFFICIENT_STOCK',
        message: `Posting would leave ${input.variantSku} with negative or over-committed stock in this warehouse.`,
      });
    }
  }

  private async requireWarehouse(scope: AuthorizationScope, warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id: warehouseId,
        branch: { organizationId: scope.organizationId },
        ...(scope.branchIds ? { branchId: { in: scope.branchIds } } : {}),
      },
      select: { id: true, code: true, branchId: true, countsForMarket: true },
    });
    if (!warehouse) {
      throw new NotFoundException({
        code: 'WAREHOUSE_NOT_FOUND',
        message: 'Warehouse was not found in your access scope.',
      });
    }
    return warehouse;
  }

  private async requireVariants(scope: AuthorizationScope, variantIds: string[]) {
    const rows = await this.prisma.productVariant.findMany({
      where: { organizationId: scope.organizationId, id: { in: variantIds } },
      select: { id: true, sku: true, name: true },
    });
    if (rows.length !== variantIds.length) {
      throw new NotFoundException({
        code: 'VARIANT_NOT_FOUND',
        message: 'One or more variants were not found in this organization.',
      });
    }
    return new Map(rows.map((row) => [row.id, row]));
  }
}
