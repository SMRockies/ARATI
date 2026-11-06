import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schema = await readFile(new URL('../packages/db/prisma/schema.prisma', import.meta.url), 'utf8');
const migration = await readFile(
  new URL('../packages/db/prisma/migrations/20261030100000_catalog_masters/migration.sql', import.meta.url),
  'utf8',
);

test('catalogue masters define stable market identifiers and publication state', () => {
  const tables = {
    ProductCategory: 'product_categories',
    ProductBrand: 'product_brands',
    Product: 'products',
    ProductVariant: 'product_variants',
  };
  for (const [model, table] of Object.entries(tables)) {
    assert.ok(schema.includes(`model ${model} `), `schema should declare ${model}`);
    assert.ok(schema.includes(`@@map("${table}")`), `schema should map ${model} to ${table}`);
    assert.ok(migration.includes(`CREATE TABLE "${table}"`), `migration should create ${table}`);
  }

  for (const marker of ['enum ProductLifecycleStatus', 'enum ProductTrackingMode']) {
    assert.ok(schema.includes(marker), `schema should declare ${marker}`);
  }
  for (const marker of ['CREATE TYPE "ProductLifecycleStatus"', 'CREATE TYPE "ProductTrackingMode"']) {
    assert.ok(migration.includes(marker), `migration should declare ${marker}`);
  }

  for (const pattern of [
    /@@unique\(\[organizationId, slug\]\)/u,
    /isPublished\s+Boolean\s+@default\(false\)/u,
    /publishedAt\s+DateTime\?\s+@db\.Timestamptz\(6\)/u,
    /lifecycleStatus\s+ProductLifecycleStatus\s+@default\(DRAFT\)/u,
    /trackingMode\s+ProductTrackingMode\s+@default\(QUANTITY\)/u,
  ]) {
    assert.match(schema, pattern);
  }
  for (const marker of [
    'CREATE UNIQUE INDEX "products_organizationId_slug_key"',
    'CREATE UNIQUE INDEX "product_variants_organizationId_sku_key"',
    '"isPublished" BOOLEAN NOT NULL DEFAULT false',
    '"publishedAt" TIMESTAMPTZ(6)',
    `"specifications" JSONB NOT NULL DEFAULT '[]'::jsonb`,
  ]) {
    assert.ok(migration.includes(marker), `migration should contain ${marker}`);
  }
});

test('catalogue rows are organization-owned and cannot be deleted by reference mistakes', () => {
  for (const table of ['product_categories', 'product_brands', 'products', 'product_variants']) {
    assert.ok(migration.includes(`CREATE TABLE "${table}"`), `migration should create ${table}`);
    assert.ok(
      migration.includes(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${table}_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT`,
      ),
      `${table} must belong to an organization with a restrictive delete`,
    );
  }
  for (const reference of [
    `"products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT`,
    `"products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "product_brands"("id") ON DELETE RESTRICT`,
    `"product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT`,
  ]) {
    assert.ok(migration.includes(reference), `migration should declare ${reference}`);
  }
});
