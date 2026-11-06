-- Phase 3 inventory authority: append-only ledger, derived balances, and the
-- warehouse flag that decides whether a location contributes to market
-- availability.
CREATE TYPE "InventoryMovementType" AS ENUM (
    'RECEIPT',
    'ISSUE',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'ADJUSTMENT_INCREASE',
    'ADJUSTMENT_DECREASE',
    'RESERVE',
    'RELEASE',
    'DAMAGE'
);

CREATE TYPE "InventoryBucket" AS ENUM ('ON_HAND', 'RESERVED', 'DAMAGED');

ALTER TABLE "warehouses" ADD COLUMN "countsForMarket" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "products" ADD COLUMN "isEnquiryAllowed" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "inventory_postings" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "idempotencyKey" VARCHAR(200),
    "referenceType" VARCHAR(40),
    "referenceId" VARCHAR(120),
    "reason" VARCHAR(500),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_postings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "postingId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "bucket" "InventoryBucket" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" VARCHAR(40),
    "referenceId" VARCHAR(120),
    "reason" VARCHAR(500),
    "createdByUserId" UUID,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_movements_quantity_nonzero_check" CHECK ("quantity" <> 0)
);

CREATE TABLE "stock_balances" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "damaged" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_balances_non_negative_check" CHECK (
        "onHand" >= 0 AND "reserved" >= 0 AND "damaged" >= 0 AND "reserved" <= "onHand"
    )
);

CREATE UNIQUE INDEX "inventory_postings_organizationId_idempotencyKey_key" ON "inventory_postings"("organizationId", "idempotencyKey");
CREATE INDEX "inventory_postings_organizationId_createdAt_idx" ON "inventory_postings"("organizationId", "createdAt");
CREATE INDEX "inventory_movements_organizationId_variantId_occurredAt_idx" ON "inventory_movements"("organizationId", "variantId", "occurredAt");
CREATE INDEX "inventory_movements_warehouseId_variantId_idx" ON "inventory_movements"("warehouseId", "variantId");
CREATE INDEX "inventory_movements_postingId_idx" ON "inventory_movements"("postingId");
CREATE UNIQUE INDEX "stock_balances_warehouseId_variantId_key" ON "stock_balances"("warehouseId", "variantId");
CREATE INDEX "stock_balances_organizationId_variantId_idx" ON "stock_balances"("organizationId", "variantId");

ALTER TABLE "inventory_postings" ADD CONSTRAINT "inventory_postings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_postings" ADD CONSTRAINT "inventory_postings_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "inventory_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The ledger is append-only at the database level, not just in application code:
-- a mistaken UPDATE or DELETE cannot rewrite inventory history.
CREATE OR REPLACE FUNCTION arati_reject_inventory_ledger_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'inventory ledger is append-only: % on % is not allowed', TG_OP, TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "inventory_movements_append_only"
    BEFORE UPDATE OR DELETE ON "inventory_movements"
    FOR EACH ROW EXECUTE FUNCTION arati_reject_inventory_ledger_mutation();

CREATE TRIGGER "inventory_postings_append_only"
    BEFORE UPDATE OR DELETE ON "inventory_postings"
    FOR EACH ROW EXECUTE FUNCTION arati_reject_inventory_ledger_mutation();
