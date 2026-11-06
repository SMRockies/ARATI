import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { loadEnvironment } from '@arati/config/load-env.mjs';

await loadEnvironment();

const port = 3103;
const baseUrl = `http://127.0.0.1:${port}`;
const allowedOrigin = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim();

const prisma = new PrismaClient();
const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const suffix = runId.toUpperCase();
const adminEmail = `p2-admin-${runId}@example.com`;
const managerEmail = `p2-manager-${runId}@example.com`;
const staffEmail = `p2-staff-${runId}@example.com`;
const adminPassword = 'Phase2-Admin-Password!';
const managerPassword = 'Phase2-Manager-Password!';
const staffPassword = 'Phase2-Staff-Password!';

const created = {
  userIds: [],
  organizationIds: [],
  branchIds: [],
};

const PUBLIC_PRODUCT_KEYS = [
  'availability',
  'brand',
  'category',
  'description',
  'image',
  'name',
  'slug',
  'specifications',
  'summary',
];

const permissionDescriptions = {
  'branch.read': 'Read branches within the assigned organization scope',
  'user.read': 'Read users within the assigned organization scope',
  'user.create': 'Create users with permissions no greater than the caller',
  'catalog.read': 'Read product categories, brands, products, and variants',
  'catalog.write': 'Create and edit catalogue masters without publishing',
  'catalog.publish': 'Publish or unpublish catalogue products for the market',
};

async function ensureRoles() {
  for (const [code, description] of Object.entries(permissionDescriptions)) {
    await prisma.permission.upsert({ where: { code }, update: { description }, create: { code, description } });
  }
  const roleDefinitions = {
    ORG_ADMIN: { name: 'Organization administrator', permissions: Object.keys(permissionDescriptions) },
    BRANCH_MANAGER: {
      name: 'Branch manager',
      permissions: ['branch.read', 'user.read', 'user.create', 'catalog.read', 'catalog.write'],
    },
    BRANCH_STAFF: { name: 'Branch staff', permissions: ['branch.read', 'catalog.read'] },
  };
  const roles = {};
  for (const [code, definition] of Object.entries(roleDefinitions)) {
    const role = await prisma.role.upsert({
      where: { code },
      update: { name: definition.name, isSystem: true },
      create: { code, name: definition.name, isSystem: true },
    });
    for (const permissionCode of definition.permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionCode: { roleId: role.id, permissionCode } },
        update: {},
        create: { roleId: role.id, permissionCode },
      });
    }
    roles[code] = role;
  }
  return roles;
}

async function setupFixture() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  const roles = await ensureRoles();

  const organizationA = await prisma.organization.create({
    data: { code: `P2A${suffix}`, name: 'Phase 2 Test Organization A', timezone: 'Asia/Kolkata' },
  });
  const organizationB = await prisma.organization.create({
    data: { code: `P2B${suffix}`, name: 'Phase 2 Test Organization B', timezone: 'Asia/Kolkata' },
  });
  const branch = await prisma.branch.create({
    data: { organizationId: organizationA.id, code: 'MAIN', name: 'Phase 2 Test Branch' },
  });
  created.organizationIds.push(organizationA.id, organizationB.id);
  created.branchIds.push(branch.id);

  const users = {};
  for (const [key, email, password, roleCode, branchId] of [
    ['admin', adminEmail, adminPassword, 'ORG_ADMIN', null],
    ['manager', managerEmail, managerPassword, 'BRANCH_MANAGER', branch.id],
    ['staff', staffEmail, staffPassword, 'BRANCH_STAFF', branch.id],
  ]) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    users[key] = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: `Phase 2 Test ${key}`,
        memberships: {
          create: { organizationId: organizationA.id, branchId, roleId: roles[roleCode].id },
        },
      },
    });
    created.userIds.push(users[key].id);
  }

  return { organizationA, organizationB, branch, users };
}

function startServer() {
  const mainFile = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  const child = spawn(process.execPath, [mainFile], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, API_PORT: String(port) },
    stdio: 'pipe',
  });
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return child;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // server not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('API did not start within 5 seconds.');
}

function sessionCookie(response) {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'expected a session cookie');
  return setCookie.split(';')[0];
}

async function login(email, password) {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: allowedOrigin },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, `login failed for ${email}`);
  return sessionCookie(response);
}

function catalogUrl(organizationId, path) {
  return `${baseUrl}/api/v1/organizations/${organizationId}/catalog/${path}`;
}

async function request(organizationId, path, options = {}) {
  const { method = 'GET', body, cookie, origin = allowedOrigin } = options;
  return fetch(catalogUrl(organizationId, path), {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(method === 'GET' ? {} : { origin }),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test('Phase 2: catalogue masters, publication, market projection, and authorization', async (t) => {
  let fixture;
  try {
    fixture = await setupFixture();
  } catch (error) {
    t.diagnostic(`Database unavailable (${error.message}). Run "pnpm db:deploy && pnpm db:seed" first.`);
    throw error;
  }
  const server = startServer();
  await waitForServer();
  const { organizationA, organizationB } = fixture;
  const cookies = {
    admin: await login(adminEmail, adminPassword),
    manager: await login(managerEmail, managerPassword),
    staff: await login(staffEmail, staffPassword),
  };

  t.after(async () => {
    server.kill();
    await prisma.auditEvent.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: created.userIds } } });
    await prisma.organizationMembership.deleteMany({ where: { userId: { in: created.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    await prisma.productVariant.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
    await prisma.product.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
    await prisma.productBrand.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
    await prisma.productCategory.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
    await prisma.branch.deleteMany({ where: { id: { in: created.branchIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: created.organizationIds } } });
    await prisma.$disconnect();
  });

  const state = { category: null, brand: null, product: null, variant: null, emptyProduct: null };

  await t.test('catalogue routes fail closed without a session', async () => {
    const response = await request(organizationA.id, 'products');
    assert.equal(response.status, 401);
  });

  await t.test('admin creates a category, brand, and draft product with a variant', async () => {
    const categoryResponse = await request(organizationA.id, 'categories', {
      method: 'POST',
      cookie: cookies.admin,
      body: { code: `REFRIGERATION-${suffix}`, name: 'Refrigeration Equipment' },
    });
    assert.equal(categoryResponse.status, 201);
    state.category = await categoryResponse.json();
    assert.equal(state.category.slug, 'refrigeration-equipment');
    assert.equal(state.category.isActive, true);

    const brandResponse = await request(organizationA.id, 'brands', {
      method: 'POST',
      cookie: cookies.admin,
      body: { code: `ARATI-${suffix}`, name: 'Arati Refrigeration', slug: `arati-refrigeration-${runId}` },
    });
    assert.equal(brandResponse.status, 201);
    state.brand = await brandResponse.json();

    const productResponse = await request(organizationA.id, 'products', {
      method: 'POST',
      cookie: cookies.admin,
      body: {
        code: `VISI-500-${suffix}`,
        name: 'Arati Visi 500L Display Cooler',
        categoryId: state.category.id,
        brandId: state.brand.id,
        trackingMode: 'QUANTITY',
        summary: '500 litre display cooler with sliding doors.',
        description: 'Retail display cooler with adjustable shelves.',
        specifications: [
          { name: 'Capacity', value: '500 L' },
          { name: 'Type', value: 'Display cooler' },
        ],
        imageUrl: '/images/demo/visi-500.jpg',
      },
    });
    assert.equal(productResponse.status, 201);
    state.product = await productResponse.json();
    assert.equal(state.product.lifecycleStatus, 'DRAFT');
    assert.equal(state.product.isPublished, false);
    assert.equal(state.product.publishedAt, null);
    assert.equal(state.product.slug, 'arati-visi-500l-display-cooler');
    assert.deepEqual(state.product.specifications, [
      { name: 'Capacity', value: '500 L' },
      { name: 'Type', value: 'Display cooler' },
    ]);

    const variantResponse = await request(organizationA.id, `products/${state.product.id}/variants`, {
      method: 'POST',
      cookie: cookies.admin,
      body: { sku: `VISI-500-PCS-${suffix}`, name: '500 L display cooler', unitOfMeasure: 'pcs' },
    });
    assert.equal(variantResponse.status, 201);
    state.variant = await variantResponse.json();
    assert.equal(state.variant.unitOfMeasure, 'PCS');
    assert.equal(state.variant.isActive, true);
  });

  await t.test('a product without a sellable variant cannot be activated', async () => {
    const response = await request(organizationA.id, 'products', {
      method: 'POST',
      cookie: cookies.admin,
      body: { code: `EMPTY-${suffix}`, name: 'Product Without Variant', categoryId: state.category.id },
    });
    assert.equal(response.status, 201);
    state.emptyProduct = await response.json();

    const activate = await request(organizationA.id, `products/${state.emptyProduct.id}/activate`, {
      method: 'POST',
      cookie: cookies.admin,
    });
    assert.equal(activate.status, 409);
    assert.equal((await activate.json()).error.code, 'PRODUCT_REQUIRES_ACTIVE_VARIANT');
  });

  await t.test('a draft product cannot be published and stays out of the market projection', async () => {
    const publish = await request(organizationA.id, `products/${state.product.id}/publish`, {
      method: 'POST',
      cookie: cookies.admin,
    });
    assert.equal(publish.status, 409);
    assert.equal((await publish.json()).error.code, 'PRODUCT_NOT_ACTIVE');

    const preview = await request(organizationA.id, 'market-preview', { cookie: cookies.admin });
    assert.equal(preview.status, 200);
    const { items } = await preview.json();
    assert.equal(items.length, 0);
  });

  await t.test('activation and publication expose only approved public fields', async () => {
    const activate = await request(organizationA.id, `products/${state.product.id}/activate`, {
      method: 'POST',
      cookie: cookies.admin,
    });
    assert.equal(activate.status, 200);
    assert.equal((await activate.json()).lifecycleStatus, 'ACTIVE');

    const publish = await request(organizationA.id, `products/${state.product.id}/publish`, {
      method: 'POST',
      cookie: cookies.admin,
    });
    assert.equal(publish.status, 200);
    const published = await publish.json();
    assert.equal(published.isPublished, true);
    assert.ok(published.publishedAt);

    const preview = await request(organizationA.id, 'market-preview', { cookie: cookies.admin });
    const { items } = await preview.json();
    assert.equal(items.length, 1);
    assert.deepEqual(Object.keys(items[0]).sort(), PUBLIC_PRODUCT_KEYS);
    assert.equal(items[0].slug, state.product.slug);
    assert.equal(items[0].category.slug, state.category.slug);
    assert.equal(items[0].brand.slug, state.brand.slug);
    assert.deepEqual(items[0].image, {
      url: '/images/demo/visi-500.jpg',
      alt: 'Arati Visi 500L Display Cooler',
    });
    assert.equal('isPublished' in items[0], false);
    assert.equal('lifecycleStatus' in items[0], false);
    // Phase 3 owns the availability policy; this Phase 2 fixture holds no stock
    // and allows enquiries, so the approved label is ENQUIRE.
    assert.equal(items[0].availability, 'ENQUIRE');
  });

  await t.test('renaming a product keeps its stable market slug', async () => {
    const rename = await request(organizationA.id, `products/${state.product.id}`, {
      method: 'PATCH',
      cookie: cookies.admin,
      body: { name: 'Arati Visi 500L Display Cooler (2027)' },
    });
    assert.equal(rename.status, 200);
    const renamed = await rename.json();
    assert.equal(renamed.name, 'Arati Visi 500L Display Cooler (2027)');
    assert.equal(renamed.slug, state.product.slug);

    const preview = await request(organizationA.id, 'market-preview', { cookie: cookies.admin });
    assert.equal((await preview.json()).items[0].slug, state.product.slug);
  });

  await t.test('duplicate codes and invalid slugs are rejected', async () => {
    const duplicate = await request(organizationA.id, 'products', {
      method: 'POST',
      cookie: cookies.admin,
      body: { code: state.product.code, name: 'Duplicate Code Product', categoryId: state.category.id },
    });
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error.code, 'PRODUCT_EXISTS');

    const invalidSlug = await request(organizationA.id, 'products', {
      method: 'POST',
      cookie: cookies.admin,
      body: { code: `BADSLUG-${suffix}`, name: 'Bad Slug', slug: 'Not A Slug', categoryId: state.category.id },
    });
    assert.equal(invalidSlug.status, 400);
    assert.equal((await invalidSlug.json()).error.code, 'VALIDATION_ERROR');

    const missingCategory = await request(organizationA.id, 'products', {
      method: 'POST',
      cookie: cookies.admin,
      body: { code: `NOCAT-${suffix}`, name: 'No Category Product' },
    });
    assert.equal(missingCategory.status, 400);
  });

  await t.test('deactivation leaves the market and clears publication without breaking variants', async () => {
    const deactivate = await request(organizationA.id, `products/${state.product.id}/deactivate`, {
      method: 'POST',
      cookie: cookies.admin,
    });
    assert.equal(deactivate.status, 200);
    const deactivated = await deactivate.json();
    assert.equal(deactivated.lifecycleStatus, 'INACTIVE');
    assert.equal(deactivated.isPublished, false);
    assert.equal(deactivated.publishedAt, null);
    assert.equal(deactivated.variants.length, 1);
    assert.equal(deactivated.variants[0].id, state.variant.id);

    const preview = await request(organizationA.id, 'market-preview', { cookie: cookies.admin });
    assert.equal((await preview.json()).items.length, 0);

    const storedVariant = await prisma.productVariant.findUnique({ where: { id: state.variant.id } });
    assert.ok(storedVariant, 'variant rows must survive product deactivation');
  });

  await t.test('reactivation and republishing restore market visibility', async () => {
    const activate = await request(organizationA.id, `products/${state.product.id}/activate`, {
      method: 'POST',
      cookie: cookies.admin,
    });
    assert.equal(activate.status, 200);

    const publish = await request(organizationA.id, `products/${state.product.id}/publish`, {
      method: 'POST',
      cookie: cookies.admin,
    });
    assert.equal(publish.status, 200);

    const preview = await request(organizationA.id, 'market-preview', { cookie: cookies.admin });
    assert.equal((await preview.json()).items.length, 1);
  });

  await t.test('unpublishing hides an active product', async () => {
    const unpublish = await request(organizationA.id, `products/${state.product.id}/unpublish`, {
      method: 'POST',
      cookie: cookies.admin,
    });
    assert.equal(unpublish.status, 200);
    const body = await unpublish.json();
    assert.equal(body.isPublished, false);
    assert.equal(body.lifecycleStatus, 'ACTIVE');

    const preview = await request(organizationA.id, 'market-preview', { cookie: cookies.admin });
    assert.equal((await preview.json()).items.length, 0);
  });

  await t.test('deactivating a category or brand hides its published products', async () => {
    await request(organizationA.id, `products/${state.product.id}/publish`, {
      method: 'POST',
      cookie: cookies.admin,
    });

    const deactivateCategory = await request(organizationA.id, `categories/${state.category.id}`, {
      method: 'PATCH',
      cookie: cookies.admin,
      body: { isActive: false },
    });
    assert.equal(deactivateCategory.status, 200);
    let preview = await request(organizationA.id, 'market-preview', { cookie: cookies.admin });
    assert.equal((await preview.json()).items.length, 0);

    await request(organizationA.id, `categories/${state.category.id}`, {
      method: 'PATCH',
      cookie: cookies.admin,
      body: { isActive: true },
    });
    preview = await request(organizationA.id, 'market-preview', { cookie: cookies.admin });
    assert.equal((await preview.json()).items.length, 1);

    const deactivateBrand = await request(organizationA.id, `brands/${state.brand.id}`, {
      method: 'PATCH',
      cookie: cookies.admin,
      body: { isActive: false },
    });
    assert.equal(deactivateBrand.status, 200);
    preview = await request(organizationA.id, 'market-preview', { cookie: cookies.admin });
    assert.equal((await preview.json()).items.length, 0);

    await request(organizationA.id, `brands/${state.brand.id}`, {
      method: 'PATCH',
      cookie: cookies.admin,
      body: { isActive: true },
    });
    preview = await request(organizationA.id, 'market-preview', { cookie: cookies.admin });
    assert.equal((await preview.json()).items.length, 1);
  });

  await t.test('catalogue permissions are enforced server-side', async () => {
    const managerRead = await request(organizationA.id, 'products', { cookie: cookies.manager });
    assert.equal(managerRead.status, 200);

    const managerCreate = await request(organizationA.id, 'products', {
      method: 'POST',
      cookie: cookies.manager,
      body: { code: `MGR-${suffix}`, name: 'Manager Created Product', categoryId: state.category.id },
    });
    assert.equal(managerCreate.status, 201);

    const managerPublish = await request(organizationA.id, `products/${state.product.id}/publish`, {
      method: 'POST',
      cookie: cookies.manager,
    });
    assert.equal(managerPublish.status, 403);
    assert.equal((await managerPublish.json()).error.code, 'PERMISSION_DENIED');

    const staffRead = await request(organizationA.id, 'categories', { cookie: cookies.staff });
    assert.equal(staffRead.status, 200);

    const staffWrite = await request(organizationA.id, 'categories', {
      method: 'POST',
      cookie: cookies.staff,
      body: { code: `STAFF-${suffix}`, name: 'Staff Category' },
    });
    assert.equal(staffWrite.status, 403);
    assert.equal((await staffWrite.json()).error.code, 'PERMISSION_DENIED');

    const staffPreview = await request(organizationA.id, 'market-preview', { cookie: cookies.staff });
    assert.equal(staffPreview.status, 200);
  });

  await t.test('catalogue data is isolated to the organization', async () => {
    const crossOrganization = await request(organizationB.id, 'products', { cookie: cookies.admin });
    assert.equal(crossOrganization.status, 403);
    assert.equal((await crossOrganization.json()).error.code, 'PERMISSION_DENIED');

    const stored = await prisma.product.findFirst({
      where: { organizationId: organizationB.id },
    });
    assert.equal(stored, null);
  });

  await t.test('invalid pagination and unknown ids return normalized errors', async () => {
    const page = await request(organizationA.id, 'products?page=1&limit=1', { cookie: cookies.admin });
    assert.equal(page.status, 200);
    const pageBody = await page.json();
    assert.equal(pageBody.page.limit, 1);
    assert.equal(pageBody.items.length, 1);
    assert.equal(pageBody.page.hasMore, true);

    const oversized = await request(organizationA.id, 'products?limit=101', { cookie: cookies.admin });
    assert.equal(oversized.status, 400);
    assert.equal((await oversized.json()).error.code, 'VALIDATION_ERROR');

    const unknownProduct = await request(organizationA.id, `products/${randomUUID()}`, { cookie: cookies.admin });
    assert.equal(unknownProduct.status, 404);
    assert.equal((await unknownProduct.json()).error.code, 'PRODUCT_NOT_FOUND');

    const unknownFilter = await request(organizationA.id, 'products?nonsense=1', { cookie: cookies.admin });
    assert.equal(unknownFilter.status, 400);
  });

  await t.test('a published product must keep at least one sellable variant', async () => {
    const deactivateVariant = await request(organizationA.id, `variants/${state.variant.id}`, {
      method: 'PATCH',
      cookie: cookies.admin,
      body: { isActive: false },
    });
    assert.equal(deactivateVariant.status, 409);
    assert.equal((await deactivateVariant.json()).error.code, 'PUBLISHED_PRODUCT_REQUIRES_ACTIVE_VARIANT');
  });

  await t.test('catalogue changes are audited', async () => {
    const actions = await prisma.auditEvent.findMany({
      where: { organizationId: organizationA.id },
      select: { action: true },
    });
    const recorded = new Set(actions.map(({ action }) => action));
    for (const action of [
      'catalog.category.created',
      'catalog.category.updated',
      'catalog.brand.created',
      'catalog.brand.updated',
      'catalog.product.created',
      'catalog.product.activated',
      'catalog.product.deactivated',
      'catalog.product.published',
      'catalog.product.unpublished',
      'catalog.variant.created',
    ]) {
      assert.ok(recorded.has(action), `expected audit action ${action}`);
    }
  });
});
