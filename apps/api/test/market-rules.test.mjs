import test from 'node:test';
import assert from 'node:assert/strict';
import {
  marketMasterWhere,
  marketProductsWhere,
  MARKET_CACHE_CONTROL,
  MARKET_PRODUCT_KEYS,
  resolveMarketOrganization,
} from '../dist/market/market.rules.js';

const ORG = 'org-market-1';

test('the market organization is configured explicitly or derived only when unambiguous', () => {
  assert.deepEqual(resolveMarketOrganization('org-1', ['org-1', 'org-2']), { ok: true, organizationId: 'org-1' });
  assert.deepEqual(resolveMarketOrganization('org-missing', ['org-1']), { ok: false, reason: 'NOT_FOUND' });
  assert.deepEqual(resolveMarketOrganization(null, ['org-1']), { ok: true, organizationId: 'org-1' });
  assert.deepEqual(resolveMarketOrganization(undefined, []), { ok: false, reason: 'UNCONFIGURED' });
  assert.deepEqual(resolveMarketOrganization(null, ['org-1', 'org-2']), { ok: false, reason: 'AMBIGUOUS' });
  assert.deepEqual(resolveMarketOrganization('', ['org-1', 'org-2']), { ok: false, reason: 'AMBIGUOUS' });
});

test('the public product query always keeps publication and master-activity visibility', () => {
  const plain = marketProductsWhere(ORG);
  assert.equal(plain.organizationId, ORG);
  assert.equal(plain.isPublished, true);
  assert.equal(plain.lifecycleStatus, 'ACTIVE');
  assert.deepEqual(plain.category, { isActive: true });
  assert.deepEqual(plain.OR, [{ brandId: null }, { brand: { isActive: true } }]);
  assert.equal(plain.AND, undefined);

  const searched = marketProductsWhere(ORG, { q: '  visi  ' });
  assert.equal(searched.isPublished, true, 'search must not relax publication');
  assert.deepEqual(searched.AND, [
    {
      OR: [
        { name: { contains: 'visi', mode: 'insensitive' } },
        { summary: { contains: 'visi', mode: 'insensitive' } },
        { description: { contains: 'visi', mode: 'insensitive' } },
      ],
    },
  ]);

  const branded = marketProductsWhere(ORG, { brand: 'arati' });
  assert.deepEqual(branded.brand, { slug: 'arati', isActive: true });
  assert.equal(branded.OR, undefined, 'a brand filter replaces the nullable-brand clause');
  assert.equal(branded.isPublished, true, 'brand filtering must not relax publication');

  const categorized = marketProductsWhere(ORG, { category: 'coolers' });
  assert.deepEqual(categorized.category, { isActive: true, slug: 'coolers' });
  assert.equal(categorized.isPublished, true);

  const combined = marketProductsWhere(ORG, { q: 'x', brand: 'b', category: 'c' });
  assert.equal(combined.isPublished, true);
  assert.equal(combined.OR, undefined);
  assert.deepEqual(combined.category, { isActive: true, slug: 'c' });
  assert.ok(combined.AND?.length === 1);
});

test('public masters are active, tenant-scoped, and only listed while a visible product exists', () => {
  const where = marketMasterWhere(ORG);
  assert.equal(where.organizationId, ORG);
  assert.equal(where.isActive, true);
  assert.equal(where.products.some.organizationId, ORG);
  assert.equal(where.products.some.isPublished, true);
  assert.equal(where.products.some.lifecycleStatus, 'ACTIVE');
});

test('the public product contract is a fixed key allow list', () => {
  assert.deepEqual(MARKET_PRODUCT_KEYS, [
    'availability',
    'brand',
    'category',
    'description',
    'image',
    'name',
    'slug',
    'specifications',
    'summary',
  ]);
  for (const forbidden of ['id', 'organizationId', 'code', 'lifecycleStatus', 'isPublished', 'variants']) {
    assert.ok(!MARKET_PRODUCT_KEYS.includes(forbidden), `${forbidden} must not be part of the public contract`);
  }
});

test('market responses declare an explicit public cache policy', () => {
  assert.match(MARKET_CACHE_CONTROL, /^public, max-age=\d+/);
});
