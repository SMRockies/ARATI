import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schema = await readFile(new URL('../packages/db/prisma/schema.prisma', import.meta.url), 'utf8');
const migration = await readFile(
  new URL('../packages/db/prisma/migrations/20261030120000_inventory_ledger/migration.sql', import.meta.url),
  'utf8',
);
const proofMigration = await readFile(
  new URL('../packages/db/prisma/migrations/20261106150000_inventory_receipt_proofs/migration.sql', import.meta.url),
  'utf8',
);

test('inventory ledger and derived balances are declared and migrated', () => {
  const tables = {
    InventoryPosting: 'inventory_postings',
    InventoryMovement: 'inventory_movements',
    StockBalance: 'stock_balances',
  };
  for (const [model, table] of Object.entries(tables)) {
    assert.ok(schema.includes(`model ${model} `), `schema should declare ${model}`);
    assert.ok(schema.includes(`@@map("${table}")`), `schema should map ${model} to ${table}`);
    assert.ok(migration.includes(`CREATE TABLE "${table}"`), `migration should create ${table}`);
  }

  for (const marker of ['enum InventoryMovementType', 'enum InventoryBucket']) {
    assert.ok(schema.includes(marker), `schema should declare ${marker}`);
  }
  for (const marker of ['CREATE TYPE "InventoryMovementType"', 'CREATE TYPE "InventoryBucket"']) {
    assert.ok(migration.includes(marker), `migration should declare ${marker}`);
  }

  assert.match(schema, /countsForMarket\s+Boolean\s+@default\(true\)/u);
  assert.match(migration, /ALTER TABLE "warehouses" ADD COLUMN "countsForMarket" BOOLEAN NOT NULL DEFAULT true/u);
  assert.match(schema, /isEnquiryAllowed\s+Boolean\s+@default\(true\)/u);
  assert.match(migration, /ALTER TABLE "products" ADD COLUMN "isEnquiryAllowed" BOOLEAN NOT NULL DEFAULT true/u);

  assert.match(migration, /CREATE UNIQUE INDEX "stock_balances_warehouseId_variantId_key"/u);
  assert.match(migration, /CREATE UNIQUE INDEX "inventory_postings_organizationId_idempotencyKey_key"/u);
});

test('balances cannot go negative and reservations cannot exceed on-hand stock', () => {
  assert.match(migration, /"stock_balances_non_negative_check" CHECK \(/u);
  assert.match(migration, /"onHand" >= 0 AND "reserved" >= 0 AND "damaged" >= 0 AND "reserved" <= "onHand"/u);
  assert.match(migration, /"inventory_movements_quantity_nonzero_check" CHECK \("quantity" <> 0\)/u);
});

test('the ledger is append-only in the database, not only in application code', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION arati_reject_inventory_ledger_mutation/u);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON "inventory_movements"/u);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON "inventory_postings"/u);
  assert.match(migration, /RAISE EXCEPTION 'inventory ledger is append-only/u);
});

test('inventory rows are organization-owned and reference-scoped', () => {
  for (const table of ['inventory_postings', 'inventory_movements', 'stock_balances']) {
    assert.ok(
      migration.includes(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${table}_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT`,
      ),
      `${table} must belong to an organization with a restrictive delete`,
    );
  }
  for (const table of ['inventory_movements', 'stock_balances']) {
    assert.ok(
      migration.includes(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${table}_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT`,
      ),
      `${table} must reference a warehouse with a restrictive delete`,
    );
    assert.ok(
      migration.includes(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${table}_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT`,
      ),
      `${table} must reference a variant with a restrictive delete`,
    );
  }
  assert.match(
    migration,
    /"inventory_movements_postingId_fkey" FOREIGN KEY \("postingId"\) REFERENCES "inventory_postings"\("id"\) ON DELETE RESTRICT/u,
  );
});

test('receipt proof metadata is immutable and required before a receipt movement', () => {
  assert.match(schema, /model ProofAttachment\s+\{/u);
  assert.match(schema, /@@map\("proof_attachments"\)/u);
  assert.match(proofMigration, /"fileSizeBytes" <= 10485760/u);
  assert.match(proofMigration, /"mimeType" IN \('image\/jpeg', 'image\/png', 'application\/pdf'\)/u);
  assert.match(proofMigration, /CREATE TRIGGER "inventory_movements_receipt_proof_required"/u);
  assert.match(proofMigration, /receipt inventory movements require a proof attachment/u);
  assert.match(proofMigration, /CREATE TRIGGER "proof_attachments_append_only"/u);
  assert.match(proofMigration, /CREATE TRIGGER "proof_attachments_receipt_only"/u);
});
