import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deactivationPatch,
  evaluateActivation,
  evaluatePublish,
  MARKET_PRODUCT_SELECT,
  marketProductWhere,
  readSpecifications,
  resolvePagination,
  toMarketProduct,
} from '../dist/catalog/catalog.rules.js';
import { isValidSlug, slugify } from '../dist/catalog/slug.js';

test('slugs are derived from names and rejected when not stable market identifiers', () => {
  assert.equal(slugify('Arati Visi 500L Display Cooler'), 'arati-visi-500l-display-cooler');
  assert.equal(slugify('  Cold   Room — 1000 cu ft  '), 'cold-room-1000-cu-ft');
  assert.equal(slugify('Ünïcode Çooler'), 'unicode-cooler');
  assert.equal(slugify('!!!'), '');
  assert.equal(isValidSlug('arati-visi-500l'), true);
  assert.equal(isValidSlug('arati--visi'), false);
  assert.equal(isValidSlug('Arati-Visi'), false);
  assert.equal(isValidSlug('arati visi'), false);
  assert.equal(isValidSlug(''), false);
  assert.equal(isValidSlug('a'.repeat(161)), false);
});

test('products can only be activated and published with a sellable variant', () => {
  assert.deepEqual(evaluateActivation('DRAFT', 0), {
    ok: false,
    failure: {
      code: 'PRODUCT_REQUIRES_ACTIVE_VARIANT',
      message: 'A product needs at least one active variant before it can be activated.',
    },
  });
  assert.deepEqual(evaluateActivation('DRAFT', 1), { ok: true });
  assert.deepEqual(evaluateActivation('INACTIVE', 1), { ok: true });
  assert.deepEqual(evaluateActivation('ACTIVE', 0), { ok: true });

  assert.equal(evaluatePublish('DRAFT', 1).ok, false);
  assert.equal(evaluatePublish('INACTIVE', 1).failure.code, 'PRODUCT_NOT_ACTIVE');
  assert.equal(evaluatePublish('ACTIVE', 0).failure.code, 'PRODUCT_REQUIRES_ACTIVE_VARIANT');
  assert.deepEqual(evaluatePublish('ACTIVE', 2), { ok: true });
});

test('deactivation clears publication instead of leaving a hidden published record', () => {
  assert.deepEqual(deactivationPatch(), {
    lifecycleStatus: 'INACTIVE',
    isPublished: false,
    publishedAt: null,
  });
});

test('market visibility requires an active, published product in active masters', () => {
  const where = marketProductWhere('org-1');
  assert.equal(where.organizationId, 'org-1');
  assert.equal(where.isPublished, true);
  assert.equal(where.lifecycleStatus, 'ACTIVE');
  assert.deepEqual(where.category, { isActive: true });
  assert.deepEqual(where.OR, [{ brandId: null }, { brand: { isActive: true } }]);
});

test('the market projection selects only public fields and maps a stable shape', () => {
  assert.deepEqual(Object.keys(MARKET_PRODUCT_SELECT).sort(), [
    'brand',
    'category',
    'description',
    'id',
    'imageAlt',
    'imageUrl',
    'isEnquiryAllowed',
    'name',
    'slug',
    'specifications',
    'summary',
    'variants',
  ]);

  const product = toMarketProduct({
    id: 'product-1',
    isEnquiryAllowed: true,
    variants: [{ id: 'variant-1' }],
    slug: 'arati-visi-500l',
    name: 'Arati Visi 500L Display Cooler',
    summary: 'Display cooler',
    description: null,
    specifications: [
      { name: 'Capacity', value: '500 L' },
      { name: 'Broken', value: 42 },
      'not-a-spec',
    ],
    imageUrl: '/images/demo/visi-500.jpg',
    imageAlt: null,
    category: { slug: 'refrigeration-equipment', name: 'Refrigeration Equipment' },
    brand: { slug: 'arati-refrigeration', name: 'Arati Refrigeration' },
  }, 'IN_STOCK');

  assert.deepEqual(product, {
    slug: 'arati-visi-500l',
    name: 'Arati Visi 500L Display Cooler',
    brand: { slug: 'arati-refrigeration', name: 'Arati Refrigeration' },
    category: { slug: 'refrigeration-equipment', name: 'Refrigeration Equipment' },
    summary: 'Display cooler',
    description: null,
    specifications: [{ name: 'Capacity', value: '500 L' }],
    image: { url: '/images/demo/visi-500.jpg', alt: 'Arati Visi 500L Display Cooler' },
    availability: 'IN_STOCK',
  });

  assert.equal(toMarketProduct({ ...productRowBase, imageUrl: null }, 'ENQUIRE').image, null);
  assert.equal(toMarketProduct({ ...productRowBase, brand: null }, 'UNAVAILABLE').availability, 'UNAVAILABLE');
  assert.deepEqual(Object.keys(product).sort(), [
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
});

const productRowBase = {
  id: 'product-2',
  isEnquiryAllowed: false,
  variants: [],
  slug: 'arati-gasket',
  name: 'Gasket',
  summary: null,
  description: null,
  specifications: [],
  imageUrl: null,
  imageAlt: null,
  category: { slug: 'spare-parts', name: 'Spare Parts' },
  brand: null,
};

test('specification payloads are normalised defensively', () => {
  assert.deepEqual(readSpecifications(null), []);
  assert.deepEqual(readSpecifications({ name: 'x' }), []);
  assert.deepEqual(readSpecifications([{ name: 'Type', value: 'Display cooler' }]), [{ name: 'Type', value: 'Display cooler' }]);
});

test('pagination is bounded server-side regardless of request values', () => {
  assert.deepEqual(resolvePagination(), { page: 1, limit: 24, skip: 0, take: 24 });
  assert.deepEqual(resolvePagination(2, 10), { page: 2, limit: 10, skip: 10, take: 10 });
  assert.deepEqual(resolvePagination(0, 0), { page: 1, limit: 24, skip: 0, take: 24 });
  assert.deepEqual(resolvePagination(1, 500), { page: 1, limit: 100, skip: 0, take: 100 });
  assert.deepEqual(resolvePagination(1.5, 10.5), { page: 1, limit: 24, skip: 0, take: 24 });
});
