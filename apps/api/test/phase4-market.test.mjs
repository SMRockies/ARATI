import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { loadEnvironment } from '@arati/config/load-env.mjs';
import { MARKET_PRODUCT_KEYS, MARKET_RATE_LIMIT } from '../dist/market/market.rules.js';

await loadEnvironment();

const mainPort = 3106;
const unconfiguredPort = 3107;
const notFoundPort = 3108;
const allowedOrigin = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim();

const prisma = new PrismaClient();
const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const suffix = runId.toUpperCase();
const slugSuffix = suffix.toLowerCase();

const created = {
  organizationIds: [],
  categoryIds: [],
  brandIds: [],
  productIds: [],
  branchIds: [],
  warehouseIds: [],
};

function marketUrl(port, path) {
  return `http://127.0.0.1:${port}/api/v1/market${path}`;
}

function startServer(port, envOverrides = {}) {
  const mainFile = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  const env = { ...process.env, API_PORT: String(port), ...envOverrides };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete env[key];
  }
  const child = spawn(process.execPath, [mainFile], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env,
    stdio: 'pipe',
  });
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return child;
}

async function waitForServer(port) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API on port ${port} did not start within 10 seconds.`);
}

function get(port, path, headers = {}) {
  return fetch(marketUrl(port, path), { headers });
}

async function getJson(port, path, headers = {}) {
  const response = await get(port, path, headers);
  return { response, body: await response.json() };
}

async function createProduct({
  organizationId,
  categoryId,
  brandId = null,
  code,
  name,
  slug,
  lifecycleStatus = 'ACTIVE',
  isPublished = true,
  isEnquiryAllowed = true,
}) {
  const product = await prisma.product.create({
    data: {
      organizationId,
      categoryId,
      brandId,
      code,
      name,
      slug,
      lifecycleStatus,
      isPublished,
      publishedAt: isPublished ? new Date() : null,
      isEnquiryAllowed,
      summary: `${name} summary.`,
      specifications: [{ name: 'Type', value: 'Refrigeration' }],
      variants: {
        create: { organizationId, sku: code, name: `${name} standard` },
      },
    },
    include: { variants: true },
  });
  created.productIds.push(product.id);
  return product;
}

async function setupFixture() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;

  const organizationA = await prisma.organization.create({
    data: { code: `P4A${suffix}`, name: 'Phase 4 Market Organization A', timezone: 'Asia/Kolkata' },
  });
  const organizationB = await prisma.organization.create({
    data: { code: `P4B${suffix}`, name: 'Phase 4 Market Organization B', timezone: 'Asia/Kolkata' },
  });
  created.organizationIds.push(organizationA.id, organizationB.id);

  const categoryActive = await prisma.productCategory.create({
    data: {
      organizationId: organizationA.id,
      code: `REFRIG-${suffix}`,
      name: 'Refrigeration Equipment',
      slug: `refrigeration-equipment-${slugSuffix}`,
    },
  });
  const categoryHidden = await prisma.productCategory.create({
    data: {
      organizationId: organizationA.id,
      code: `HIDDEN-${suffix}`,
      name: 'Hidden Equipment',
      slug: `hidden-equipment-${slugSuffix}`,
      isActive: false,
    },
  });
  created.categoryIds.push(categoryActive.id, categoryHidden.id);

  const brandActive = await prisma.productBrand.create({
    data: {
      organizationId: organizationA.id,
      code: `ARATI-${suffix}`,
      name: 'Arati Refrigeration',
      slug: `arati-refrigeration-${slugSuffix}`,
    },
  });
  const brandHidden = await prisma.productBrand.create({
    data: {
      organizationId: organizationA.id,
      code: `LEGACY-${suffix}`,
      name: 'Legacy Brand',
      slug: `legacy-brand-${slugSuffix}`,
      isActive: false,
    },
  });
  created.brandIds.push(brandActive.id, brandHidden.id);

  const categoryB = await prisma.productCategory.create({
    data: {
      organizationId: organizationB.id,
      code: `BCAT-${suffix}`,
      name: 'Foreign Category',
      slug: `foreign-category-${slugSuffix}`,
    },
  });
  created.categoryIds.push(categoryB.id);

  // Published and visible --------------------------------------------------
  const visi = await createProduct({
    organizationId: organizationA.id,
    categoryId: categoryActive.id,
    brandId: brandActive.id,
    code: `VISI-${suffix}`,
    name: 'Arati Visi Cooler',
    slug: `arati-visi-cooler-${slugSuffix}`,
    isEnquiryAllowed: false,
  });
  const chiller = await createProduct({
    organizationId: organizationA.id,
    categoryId: categoryActive.id,
    brandId: null,
    code: `CHILLER-${suffix}`,
    name: 'Arati Chiller',
    slug: `arati-chiller-${slugSuffix}`,
    isEnquiryAllowed: true,
  });
  const freezer = await createProduct({
    organizationId: organizationA.id,
    categoryId: categoryActive.id,
    brandId: brandActive.id,
    code: `FREEZER-${suffix}`,
    name: 'Arati Deep Freezer',
    slug: `arati-deep-freezer-${slugSuffix}`,
    isEnquiryAllowed: false,
  });

  // Must stay hidden -------------------------------------------------------
  const draft = await createProduct({
    organizationId: organizationA.id,
    categoryId: categoryActive.id,
    code: `DRAFT-${suffix}`,
    name: 'Unreleased Draft Product',
    slug: `unreleased-draft-${slugSuffix}`,
    lifecycleStatus: 'DRAFT',
    isPublished: false,
  });
  const inactiveBrandProduct = await createProduct({
    organizationId: organizationA.id,
    categoryId: categoryActive.id,
    brandId: brandHidden.id,
    code: `OLDBRAND-${suffix}`,
    name: 'Product Of Hidden Brand',
    slug: `product-of-hidden-brand-${slugSuffix}`,
  });
  const inactiveCategoryProduct = await createProduct({
    organizationId: organizationA.id,
    categoryId: categoryHidden.id,
    brandId: brandActive.id,
    code: `OLDCAT-${suffix}`,
    name: 'Product In Hidden Category',
    slug: `product-in-hidden-category-${slugSuffix}`,
  });
  const forcedInactive = await createProduct({
    organizationId: organizationA.id,
    categoryId: categoryActive.id,
    code: `INACTIVE-${suffix}`,
    name: 'Forced Inactive Product',
    slug: `forced-inactive-${slugSuffix}`,
    lifecycleStatus: 'INACTIVE',
    isPublished: true,
  });
  const foreign = await createProduct({
    organizationId: organizationB.id,
    categoryId: categoryB.id,
    code: `FOREIGN-${suffix}`,
    name: 'Foreign Market Product',
    slug: `foreign-market-product-${slugSuffix}`,
  });

  // Stock for the visi cooler: posted as a balance projection so the label
  // resolves to IN_STOCK (the ledger itself is Phase 3's own concern).
  const branch = await prisma.branch.create({
    data: { organizationId: organizationA.id, code: `MAIN-${suffix}`, name: 'Phase 4 Main Branch' },
  });
  const warehouse = await prisma.warehouse.create({
    data: { branchId: branch.id, code: `MAIN-${suffix}`, name: 'Phase 4 Main Warehouse' },
  });
  created.branchIds.push(branch.id);
  created.warehouseIds.push(warehouse.id);
  await prisma.stockBalance.create({
    data: {
      organizationId: organizationA.id,
      warehouseId: warehouse.id,
      variantId: visi.variants[0].id,
      onHand: 5,
    },
  });

  return {
    organizationA,
    organizationB,
    categoryActive,
    categoryHidden,
    brandActive,
    brandHidden,
    visible: { visi, chiller, freezer },
    hidden: { draft, inactiveBrandProduct, inactiveCategoryProduct, forcedInactive, foreign },
  };
}

test('Phase 4: public market API visibility, contract, filtering, and protections', async (t) => {
  let fixture;
  try {
    fixture = await setupFixture();
  } catch (error) {
    t.diagnostic(`Database unavailable (${error.message}). Run "pnpm db:deploy && pnpm db:seed" first.`);
    throw error;
  }

  const { organizationA, categoryActive, brandActive, visible, hidden } = fixture;
  const mainServer = startServer(mainPort, { MARKET_ORGANIZATION_ID: organizationA.id });
  await waitForServer(mainPort);

  t.after(async () => {
    mainServer.kill();
    await prisma.stockBalance.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
    await prisma.productVariant.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
    await prisma.product.deleteMany({ where: { id: { in: created.productIds } } });
    await prisma.productCategory.deleteMany({ where: { id: { in: created.categoryIds } } });
    await prisma.productBrand.deleteMany({ where: { id: { in: created.brandIds } } });
    await prisma.warehouse.deleteMany({ where: { id: { in: created.warehouseIds } } });
    await prisma.branch.deleteMany({ where: { id: { in: created.branchIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: created.organizationIds } } });
    await prisma.$disconnect();
  });

  const expectedSlugs = [visible.chiller.slug, visible.freezer.slug, visible.visi.slug];

  await t.test('the market API serves without a session and declares a public cache policy', async () => {
    const { response, body } = await getJson(mainPort, '/products');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('set-cookie'), null, 'public routes must not set a session cookie');
    assert.match(response.headers.get('cache-control') ?? '', /^public, max-age=60/);
    assert.deepEqual(body.items.map((item) => item.slug), expectedSlugs);
    assert.equal(body.page.total, 3);
    assert.equal(body.page.hasMore, false);
  });

  await t.test('only published, active products of the market organization are listed', async () => {
    const { response, body } = await getJson(mainPort, '/products?limit=100');
    const slugs = body.items.map((item) => item.slug);
    for (const product of Object.values(hidden)) {
      assert.ok(!slugs.includes(product.slug), `${product.slug} must stay out of the public list`);
    }
    const raw = JSON.stringify(body);
    assert.ok(!raw.includes('"id"'), 'no internal id may appear in the response');
    assert.ok(!raw.includes('organizationId'));
    assert.ok(!raw.includes('lifecycleStatus'));
    assert.ok(!raw.includes('isPublished'));
    assert.ok(!raw.includes('onHand'));
    assert.equal(response.status, 200);
  });

  await t.test('every product row matches the public field allow list', async () => {
    const { body } = await getJson(mainPort, '/products');
    for (const item of body.items) {
      assert.deepEqual(Object.keys(item).sort(), MARKET_PRODUCT_KEYS);
      if (item.brand) assert.deepEqual(Object.keys(item.brand).sort(), ['name', 'slug']);
      assert.deepEqual(Object.keys(item.category).sort(), ['name', 'slug']);
      if (item.image) assert.deepEqual(Object.keys(item.image).sort(), ['alt', 'url']);
    }
  });

  await t.test('availability labels are derived from stock, not declared by the client', async () => {
    const bySlug = new Map((await getJson(mainPort, '/products?limit=100')).body.items.map((item) => [item.slug, item]));
    assert.equal(bySlug.get(visible.visi.slug).availability, 'IN_STOCK');
    assert.equal(bySlug.get(visible.chiller.slug).availability, 'ENQUIRE');
    assert.equal(bySlug.get(visible.freezer.slug).availability, 'UNAVAILABLE');

    const detail = await getJson(mainPort, `/products/${visible.visi.slug}`);
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.availability, 'IN_STOCK');
    const raw = JSON.stringify(detail.body);
    for (const forbidden of ['onHand', 'reserved', 'quantity', 'stockBalance', 'variantId']) {
      assert.ok(!raw.includes(forbidden), `${forbidden} must never be exposed publicly`);
    }
  });

  await t.test('pagination is bounded server-side and rejects invalid values', async () => {
    const first = (await getJson(mainPort, '/products?limit=2&page=1')).body;
    assert.equal(first.items.length, 2);
    assert.equal(first.page.hasMore, true);
    const second = (await getJson(mainPort, '/products?limit=2&page=2')).body;
    assert.equal(second.items.length, 1);
    assert.equal(second.page.hasMore, false);
    const union = new Set([...first.items, ...second.items].map((item) => item.slug));
    assert.deepEqual([...union].sort(), [...expectedSlugs].sort());

    for (const query of ['limit=0', 'limit=500', 'page=0', 'page=nope', 'isPublished=true', 'category=NOT-A-SLUG']) {
      const { response, body } = await getJson(mainPort, `/products?${query}`);
      assert.equal(response.status, 400, `${query} must be rejected`);
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    }
  });

  await t.test('filters narrow the list without ever widening visibility', async () => {
    const byCategory = (await getJson(mainPort, `/products?category=${categoryActive.slug}&limit=100`)).body;
    assert.deepEqual(byCategory.items.map((item) => item.slug).sort(), [...expectedSlugs].sort());

    const byHiddenCategory = (await getJson(mainPort, `/products?category=${fixture.categoryHidden.slug}`)).body;
    assert.equal(byHiddenCategory.items.length, 0);

    const byBrand = (await getJson(mainPort, `/products?brand=${brandActive.slug}&limit=100`)).body;
    assert.deepEqual(byBrand.items.map((item) => item.slug).sort(), [visible.freezer.slug, visible.visi.slug].sort());

    const byHiddenBrand = (await getJson(mainPort, `/products?brand=${fixture.brandHidden.slug}`)).body;
    assert.equal(byHiddenBrand.items.length, 0);

    const searched = (await getJson(mainPort, '/products?q=visi')).body;
    assert.deepEqual(searched.items.map((item) => item.slug), [visible.visi.slug]);

    const miss = (await getJson(mainPort, '/products?q=definitely-not-present')).body;
    assert.equal(miss.items.length, 0);
    assert.equal(miss.page.total, 0);
  });

  await t.test('product detail fails closed for unpublished, inactive, foreign, or unknown slugs', async () => {
    const known = await getJson(mainPort, `/products/${visible.chiller.slug}`);
    assert.equal(known.response.status, 200);
    assert.deepEqual(Object.keys(known.body).sort(), MARKET_PRODUCT_KEYS);

    for (const product of Object.values(hidden)) {
      const { response, body } = await getJson(mainPort, `/products/${product.slug}`);
      assert.equal(response.status, 404, `${product.slug} must not resolve`);
      assert.equal(body.error.code, 'MARKET_PRODUCT_NOT_FOUND');
    }
    const unknown = await getJson(mainPort, '/products/no-such-product-here');
    assert.equal(unknown.response.status, 404);
    assert.equal(unknown.body.error.code, 'MARKET_PRODUCT_NOT_FOUND');
    const malformed = await getJson(mainPort, '/products/NOT_A_SLUG');
    assert.equal(malformed.response.status, 404, 'malformed slugs must not reach the database');
  });

  await t.test('brand and category navigation lists only active masters with visible products', async () => {
    const brands = await getJson(mainPort, '/brands?limit=100');
    assert.deepEqual(brands.body.items, [{ slug: brandActive.slug, name: brandActive.name }]);

    const categories = await getJson(mainPort, '/categories?limit=100');
    assert.deepEqual(categories.body.items, [{ slug: categoryActive.slug, name: categoryActive.name }]);
    for (const body of [brands.body, categories.body]) {
      const raw = JSON.stringify(body);
      assert.ok(!raw.includes('"id"'));
      assert.ok(!raw.includes(organizationA.id), 'organization ids must never leak');
    }
  });

  await t.test('the market API exposes no write routes', async () => {
    const mutations = [
      { method: 'POST', path: '/products', body: { code: 'X' } },
      { method: 'POST', path: `/products/${visible.visi.slug}`, body: {} },
      { method: 'PUT', path: `/products/${visible.visi.slug}`, body: {} },
      { method: 'DELETE', path: '/brands', body: undefined },
    ];
    for (const mutation of mutations) {
      const response = await fetch(marketUrl(mainPort, mutation.path), {
        method: mutation.method,
        headers: { origin: allowedOrigin },
        ...(mutation.body ? { body: JSON.stringify(mutation.body) } : {}),
      });
      assert.equal(response.status, 404, `${mutation.method} ${mutation.path} must not exist`);
      const body = await response.json();
      assert.equal(body.error.code, 'NOT_FOUND');
    }
  });

  await t.test('CORS allows only the configured storefront origin', async () => {
    const allowed = await get(mainPort, '/products', { origin: allowedOrigin });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('access-control-allow-origin'), allowedOrigin);

    const rejected = await get(mainPort, '/products', { origin: 'http://evil.example' });
    assert.equal(rejected.status, 200, 'a foreign origin still gets a plain response');
    assert.equal(rejected.headers.get('access-control-allow-origin'), null, 'but no CORS grant');
  });

  await t.test('the market API fails closed when the market organization is not resolvable', async () => {
    const unconfigured = startServer(unconfiguredPort, { MARKET_ORGANIZATION_ID: undefined });
    const notFound = startServer(notFoundPort, { MARKET_ORGANIZATION_ID: randomUUID() });
    try {
      await waitForServer(unconfiguredPort);
      await waitForServer(notFoundPort);

      // With more than one organization and no configuration, publishing one
      // tenant's catalogue would be a guess.
      const ambiguous = await getJson(unconfiguredPort, '/products');
      assert.equal(ambiguous.response.status, 503);
      assert.equal(ambiguous.body.error.code, 'MARKET_NOT_CONFIGURED');

      const missing = await getJson(notFoundPort, '/products');
      assert.equal(missing.response.status, 503);
      assert.equal(missing.body.error.code, 'MARKET_NOT_CONFIGURED');
    } finally {
      unconfigured.kill();
      notFound.kill();
    }
  });

  await t.test('sustained traffic is rate limited with a structured 429', async () => {
    // Runs last: it deliberately consumes the whole per-IP window.
    let limited = null;
    let attempts = 0;
    while (attempts < MARKET_RATE_LIMIT + 150 && !limited) {
      attempts += 1;
      const response = await get(mainPort, '/products?limit=1');
      if (response.status === 429) limited = response;
    }
    assert.ok(limited, 'the market API must eventually rate-limit a burst from one address');
    const body = await limited.json();
    assert.equal(body.error.code, 'RATE_LIMITED');
    assert.ok(attempts <= MARKET_RATE_LIMIT + 1, `429 must trigger near the ${MARKET_RATE_LIMIT} request budget, took ${attempts}`);
  });
});
