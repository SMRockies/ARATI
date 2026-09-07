import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schema = await readFile(new URL('../packages/db/prisma/schema.prisma', import.meta.url), 'utf8');
const migration = await readFile(new URL('../packages/db/prisma/migrations/20260906120000_initial_foundation/migration.sql', import.meta.url), 'utf8');

test('database foundation includes organization ownership and integration state', () => {
  for (const model of ['Organization', 'Branch', 'Warehouse', 'WarehouseLocation', 'IntegrationEvent']) {
    assert.match(schema, new RegExp(`model ${model}\\s`));
  }

  assert.match(schema, /enum IntegrationEventStatus/);
  assert.match(schema, /@@index\(\[status, availableAt\]\)/);
  assert.match(migration, /CREATE TABLE "integration_events"/);
  assert.match(migration, /CREATE TYPE "IntegrationEventStatus"/);
});
