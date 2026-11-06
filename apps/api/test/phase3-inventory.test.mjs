import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { loadEnvironment } from '@arati/config/load-env.mjs';

await loadEnvironment();

const port = 3105;
const baseUrl = `http://127.0.0.1:${port}`;
const allowedOrigin = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim();

const prisma = new PrismaClient();
const proofDir = await mkdtemp(join(tmpdir(), 'arati-inventory-proof-'));
const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const suffix = runId.toUpperCase();
const adminEmail = `p3-admin-${runId}@example.com`;
const managerEmail = `p3-manager-${runId}@example.com`;
const staffEmail = `p3-staff-${runId}@example.com`;
const adminPassword = 'Phase3-Admin-Password!';
const managerPassword = 'Phase3-Manager-Password!';
const staffPassword = 'Phase3-Staff-Password!';

const created = {
  userIds: [],
  organizationIds: [],
  branchIds: [],
  warehouseIds: [],
};

const permissionDescriptions = {
  'branch.read': 'Read branches within the assigned organization scope',
  'user.read': 'Read users within the assigned organization scope',
  'user.create': 'Create users with permissions no greater than the caller',
  'catalog.read': 'Read product categories, brands, products, and variants',
  'catalog.write': 'Create and edit catalogue masters without publishing',
  'catalog.publish': 'Publish or unpublish catalogue products for the market',
  'inventory.read': 'Read stock balances, ledger movements, and availability explanations',
  'inventory.write': 'Post receipts, issues, transfers, reservations, and releases',
  'inventory.adjust': 'Post stock adjustments and damage write-offs',
};

async function ensureRoles() {
  for (const [code, description] of Object.entries(permissionDescriptions)) {
    await prisma.permission.upsert({ where: { code }, update: { description }, create: { code, description } });
  }
  const roleDefinitions = {
    ORG_ADMIN: { name: 'Organization administrator', permissions: Object.keys(permissionDescriptions) },
    BRANCH_MANAGER: {
      name: 'Branch manager',
      permissions: [
        'branch.read',
        'user.read',
        'user.create',
        'catalog.read',
        'catalog.write',
        'inventory.read',
        'inventory.write',
      ],
    },
    BRANCH_STAFF: { name: 'Branch staff', permissions: ['branch.read', 'catalog.read', 'inventory.read'] },
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
    data: { code: `P3A${suffix}`, name: 'Phase 3 Test Organization A', timezone: 'Asia/Kolkata' },
  });
  const organizationB = await prisma.organization.create({
    data: { code: `P3B${suffix}`, name: 'Phase 3 Test Organization B', timezone: 'Asia/Kolkata' },
  });
  const branchMain = await prisma.branch.create({
    data: { organizationId: organizationA.id, code: 'MAIN', name: 'Phase 3 Main Branch' },
  });
  const branchOther = await prisma.branch.create({
    data: { organizationId: organizationA.id, code: 'OTHER', name: 'Phase 3 Other Branch' },
  });
  const branchForeign = await prisma.branch.create({
    data: { organizationId: organizationB.id, code: 'FOREIGN', name: 'Phase 3 Foreign Branch' },
  });
  const warehouseMain = await prisma.warehouse.create({
    data: { branchId: branchMain.id, code: 'MAIN', name: 'Phase 3 Main Warehouse' },
  });
  const warehouseQuarantine = await prisma.warehouse.create({
    data: { branchId: branchMain.id, code: 'QUARANTINE', name: 'Phase 3 Quarantine', countsForMarket: false },
  });
  const warehouseOther = await prisma.warehouse.create({
    data: { branchId: branchOther.id, code: 'OTHER', name: 'Phase 3 Other Warehouse' },
  });
  const warehouseForeign = await prisma.warehouse.create({
    data: { branchId: branchForeign.id, code: 'FOREIGN', name: 'Phase 3 Foreign Warehouse' },
  });

  created.organizationIds.push(organizationA.id, organizationB.id);
  created.branchIds.push(branchMain.id, branchOther.id, branchForeign.id);
  created.warehouseIds.push(warehouseMain.id, warehouseQuarantine.id, warehouseOther.id, warehouseForeign.id);

  const users = {};
  for (const [key, email, password, roleCode, branchId] of [
    ['admin', adminEmail, adminPassword, 'ORG_ADMIN', null],
    ['manager', managerEmail, managerPassword, 'BRANCH_MANAGER', branchMain.id],
    ['staff', staffEmail, staffPassword, 'BRANCH_STAFF', branchMain.id],
  ]) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    users[key] = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: `Phase 3 Test ${key}`,
        memberships: {
          create: { organizationId: organizationA.id, branchId, roleId: roles[roleCode].id },
        },
      },
    });
    created.userIds.push(users[key].id);
  }

  const category = await prisma.productCategory.create({
    data: {
      organizationId: organizationA.id,
      code: `P3CAT${suffix}`,
      name: 'Phase 3 Refrigeration',
      slug: `phase-3-refrigeration-${runId}`,
    },
  });
  const product = await prisma.product.create({
    data: {
      organizationId: organizationA.id,
      categoryId: category.id,
      code: `P3VISI${suffix}`,
      name: `Phase 3 Visi Cooler ${suffix}`,
      slug: `phase-3-visi-cooler-${runId}`,
      lifecycleStatus: 'ACTIVE',
      isPublished: true,
      publishedAt: new Date(),
      summary: 'Phase 3 availability fixture.',
    },
  });
  const variantA = await prisma.productVariant.create({
    data: { organizationId: organizationA.id, productId: product.id, sku: `P3-A-${suffix}`, name: 'Variant A' },
  });
  const variantB = await prisma.productVariant.create({
    data: { organizationId: organizationA.id, productId: product.id, sku: `P3-B-${suffix}`, name: 'Variant B' },
  });

  return {
    organizationA,
    organizationB,
    branchMain,
    branchOther,
    branchForeign,
    warehouseMain,
    warehouseQuarantine,
    warehouseOther,
    warehouseForeign,
    users,
    product,
    variantA,
    variantB,
  };
}

function startServer() {
  const mainFile = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  const child = spawn(process.execPath, [mainFile], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, API_PORT: String(port), INVENTORY_PROOF_STORAGE_DIR: proofDir },
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

function inventoryUrl(organizationId, path) {
  return `${baseUrl}/api/v1/organizations/${organizationId}/inventory/${path}`;
}

function catalogUrl(organizationId, path) {
  return `${baseUrl}/api/v1/organizations/${organizationId}/catalog/${path}`;
}

async function call(url, { method = 'GET', body, cookie } = {}) {
  return fetch(url, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(method === 'GET' ? {} : { origin: allowedOrigin }),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function clearLedgerAndFixtures() {
  await prisma.$executeRawUnsafe('ALTER TABLE "inventory_movements" DISABLE TRIGGER "inventory_movements_append_only"');
  await prisma.$executeRawUnsafe('ALTER TABLE "inventory_postings" DISABLE TRIGGER "inventory_postings_append_only"');
  await prisma.$executeRawUnsafe('ALTER TABLE "proof_attachments" DISABLE TRIGGER "proof_attachments_append_only"');
  try {
    await prisma.proofAttachment.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
    await prisma.inventoryMovement.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
    await prisma.inventoryPosting.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE "inventory_movements" ENABLE TRIGGER "inventory_movements_append_only"');
    await prisma.$executeRawUnsafe('ALTER TABLE "inventory_postings" ENABLE TRIGGER "inventory_postings_append_only"');
    await prisma.$executeRawUnsafe('ALTER TABLE "proof_attachments" ENABLE TRIGGER "proof_attachments_append_only"');
  }
  await prisma.stockBalance.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
  await prisma.auditEvent.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
  await prisma.authSession.deleteMany({ where: { userId: { in: created.userIds } } });
  await prisma.organizationMembership.deleteMany({ where: { userId: { in: created.userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  await prisma.productVariant.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
  await prisma.product.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
  await prisma.productCategory.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
  await prisma.warehouse.deleteMany({ where: { id: { in: created.warehouseIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: created.branchIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: created.organizationIds } } });
}

test('Phase 3: inventory ledger, availability policy, reconciliation, and branch scope', async (t) => {
  let fixture;
  try {
    fixture = await setupFixture();
  } catch (error) {
    t.diagnostic(`Database unavailable (${error.message}). Run "pnpm db:deploy && pnpm db:seed" first.`);
    throw error;
  }
  const server = startServer();
  await waitForServer();
  const {
    organizationA,
    organizationB,
    warehouseMain,
    warehouseQuarantine,
    warehouseOther,
    warehouseForeign,
    product,
    variantA,
    variantB,
  } = fixture;
  const cookies = {
    admin: await login(adminEmail, adminPassword),
    manager: await login(managerEmail, managerPassword),
    staff: await login(staffEmail, staffPassword),
  };

  t.after(async () => {
    server.kill();
    await clearLedgerAndFixtures();
    await prisma.$disconnect();
    await rm(proofDir, { recursive: true, force: true });
  });

  const receipt = (body, cookie = cookies.admin, includeProof = true, proof = Buffer.from('%PDF-1.4\nproof')) => {
    const form = new FormData();
    form.set('warehouseId', body.warehouseId);
    form.set('variantId', body.variantId ?? body.lines?.[0]?.variantId ?? '');
    form.set('quantity', String(body.quantity ?? body.lines?.[0]?.quantity ?? ''));
    form.set('reference', body.reference ?? body.reason ?? '');
    if (body.referenceId) form.set('referenceId', body.referenceId);
    if (body.idempotencyKey) form.set('idempotencyKey', body.idempotencyKey);
    if (includeProof) form.set('proof_file', new Blob([proof], { type: 'application/pdf' }), 'receipt.pdf');
    return fetch(inventoryUrl(organizationA.id, 'receipts'), {
      method: 'POST',
      headers: { cookie, origin: allowedOrigin },
      body: form,
    });
  };
  const balancesFor = async (variantId) => {
    const response = await call(
      inventoryUrl(organizationA.id, `balances?variantId=${variantId}`),
      { cookie: cookies.admin },
    );
    assert.equal(response.status, 200);
    return (await response.json()).items;
  };
  const balanceAt = (items, warehouseCode) => {
    const match = items.find((item) => item.warehouse.code === warehouseCode);
    assert.ok(match, `expected a balance row for ${warehouseCode}`);
    return match;
  };
  const marketAvailability = async () => {
    const response = await call(catalogUrl(organizationA.id, 'market-preview'), { cookie: cookies.admin });
    assert.equal(response.status, 200);
    const { items } = await response.json();
    return items.find((item) => item.slug === product.slug)?.availability ?? null;
  };

  await t.test('inventory routes fail closed without a session', async () => {
    assert.equal((await call(inventoryUrl(organizationA.id, 'balances'))).status, 401);
    assert.equal(
      (
        await call(inventoryUrl(organizationA.id, 'receipts'), {
          method: 'POST',
          body: { warehouseId: warehouseMain.id, lines: [{ variantId: variantA.id, quantity: 1 }] },
        })
      ).status,
      401,
    );
  });

  await t.test('a receipt posts one ledger row and a matching balance', async () => {
    const response = await receipt({
      warehouseId: warehouseMain.id,
      lines: [{ variantId: variantA.id, quantity: 10 }],
      referenceType: 'purchase-order',
      referenceId: 'PO-1',
    });
    assert.equal(response.status, 201);
    const posting = await response.json();
    assert.equal(posting.replayed, false);
    assert.equal(posting.type, 'RECEIPT');
    assert.equal(posting.movements.length, 1);
    assert.equal(posting.movements[0].bucket, 'ON_HAND');
    assert.equal(posting.movements[0].quantity, 10);
    assert.equal(posting.movements[0].referenceId, 'PO-1');
    assert.equal(posting.proofAttachment.fileName, 'receipt.pdf');
    assert.equal(posting.proofAttachment.mimeType, 'application/pdf');
    assert.equal(posting.proofAttachment.fileSizeBytes, Buffer.byteLength('%PDF-1.4\nproof'));

    const balances = await balancesFor(variantA.id);
    assert.equal(balances.length, 1);
    assert.equal(balances[0].onHand, 10);
    assert.equal(balances[0].reserved, 0);
    assert.equal(balances[0].damaged, 0);
    assert.equal(balances[0].sellable, 10);
    assert.equal(balances[0].warehouse.code, 'MAIN');
    assert.equal(balances[0].variant.sku, `P3-A-${suffix}`);

    const movements = await call(
      inventoryUrl(organizationA.id, `movements?variantId=${variantA.id}`),
      { cookie: cookies.admin },
    );
    const body = await movements.json();
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].postingId, posting.id);
    assert.equal(body.items[0].warehouse.code, 'MAIN');
    assert.equal(body.items[0].posting.proofAttachment.id, posting.proofAttachment.id);

    const proof = await call(inventoryUrl(organizationA.id, `proofs/${posting.id}`), { cookie: cookies.admin });
    assert.equal(proof.status, 200);
    assert.equal(proof.headers.get('content-type'), 'application/pdf');
    assert.equal(proof.headers.get('cache-control'), 'private, no-store');
    assert.match(proof.headers.get('content-disposition'), /attachment/u);
    assert.equal(await proof.text(), '%PDF-1.4\nproof');

    const stored = await prisma.proofAttachment.findUniqueOrThrow({
      where: { postingId: posting.id },
      select: { storageKey: true },
    });
    const storedPath = join(proofDir, `${stored.storageKey}.proof`);
    await writeFile(storedPath, 'tampered proof');
    const tampered = await call(inventoryUrl(organizationA.id, `proofs/${posting.id}`), { cookie: cookies.admin });
    assert.equal(tampered.status, 500);
    assert.equal((await tampered.json()).error.code, 'PROOF_INTEGRITY_FAILED');
    await writeFile(storedPath, Buffer.from('%PDF-1.4\nproof'));

    const branchProof = await call(inventoryUrl(organizationA.id, `proofs/${posting.id}`), { cookie: cookies.manager });
    assert.equal(branchProof.status, 200);
  });

  await t.test('a receipt cannot be posted without a supported, valid proof', async () => {
    const missing = await receipt(
      { warehouseId: warehouseMain.id, variantId: variantA.id, quantity: 1 },
      cookies.admin,
      false,
    );
    assert.equal(missing.status, 400);
    assert.equal((await missing.json()).error.code, 'PROOF_FILE_REQUIRED');

    const invalid = await receipt(
      { warehouseId: warehouseMain.id, variantId: variantA.id, quantity: 1 },
      cookies.admin,
      true,
      Buffer.from('not a PDF'),
    );
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, 'PROOF_FILE_INVALID');
    assert.equal(balanceAt(await balancesFor(variantA.id), 'MAIN').onHand, 10);
  });

  await t.test('the database rejects receipt ledger rows created without proof metadata', async () => {
    const posting = await prisma.inventoryPosting.create({
      data: {
        organizationId: organizationA.id,
        type: 'RECEIPT',
        createdByUserId: fixture.users.admin.id,
      },
    });
    await assert.rejects(
      prisma.inventoryMovement.create({
        data: {
          postingId: posting.id,
          organizationId: organizationA.id,
          warehouseId: warehouseMain.id,
          variantId: variantA.id,
          type: 'RECEIPT',
          bucket: 'ON_HAND',
          quantity: 1,
          createdByUserId: fixture.users.admin.id,
        },
      }),
      /receipt inventory movements require a proof attachment/u,
    );
  });

  await t.test('an idempotent replay never posts stock twice', async () => {
    const body = {
      warehouseId: warehouseMain.id,
      lines: [{ variantId: variantA.id, quantity: 5 }],
      idempotencyKey: `p3-receipt-${runId}`,
    };
    const first = await receipt(body);
    assert.equal(first.status, 201);
    const firstPosting = await first.json();
    assert.equal(firstPosting.replayed, false);

    const second = await receipt(body);
    assert.equal(second.status, 201);
    const replayed = await second.json();
    assert.equal(replayed.replayed, true);
    assert.equal(replayed.id, firstPosting.id);

    const changedPayload = await receipt({
      ...body,
      lines: [{ variantId: variantA.id, quantity: 6 }],
    });
    assert.equal(changedPayload.status, 409);
    assert.equal((await changedPayload.json()).error.code, 'IDEMPOTENCY_KEY_REUSED');
    const balance = balanceAt(await balancesFor(variantA.id), 'MAIN');
    assert.equal(balance.onHand, 15);
    const movements = await call(
      inventoryUrl(organizationA.id, `movements?variantId=${variantA.id}`),
      { cookie: cookies.admin },
    );
    assert.equal((await movements.json()).items.length, 2);
  });

  await t.test('reservations reduce sellable stock without changing on-hand', async () => {
    const reserve = await call(inventoryUrl(organizationA.id, 'reservations'), {
      method: 'POST',
      cookie: cookies.admin,
      body: {
        warehouseId: warehouseMain.id,
        lines: [{ variantId: variantA.id, quantity: 4 }],
        referenceType: 'sales-order',
        referenceId: 'SO-1',
      },
    });
    assert.equal(reserve.status, 201);

    const balance = balanceAt(await balancesFor(variantA.id), 'MAIN');
    assert.equal(balance.onHand, 15);
    assert.equal(balance.reserved, 4);
    assert.equal(balance.sellable, 11);
    assert.equal(await marketAvailability(), 'IN_STOCK');

    const overReserve = await call(inventoryUrl(organizationA.id, 'reservations'), {
      method: 'POST',
      cookie: cookies.admin,
      body: { warehouseId: warehouseMain.id, lines: [{ variantId: variantA.id, quantity: 12 }] },
    });
    assert.equal(overReserve.status, 409);
    assert.equal((await overReserve.json()).error.code, 'INSUFFICIENT_STOCK');

    const release = await call(inventoryUrl(organizationA.id, 'reservations/release'), {
      method: 'POST',
      cookie: cookies.admin,
      body: { warehouseId: warehouseMain.id, lines: [{ variantId: variantA.id, quantity: 4 }] },
    });
    assert.equal(release.status, 201);
    const released = balanceAt(await balancesFor(variantA.id), 'MAIN');
    assert.equal(released.reserved, 0);
    assert.equal(released.sellable, 15);
  });

  await t.test('stock movements drive the public availability label', async () => {
    const issue = await call(inventoryUrl(organizationA.id, 'issues'), {
      method: 'POST',
      cookie: cookies.admin,
      body: {
        warehouseId: warehouseMain.id,
        lines: [{ variantId: variantA.id, quantity: 15 }],
        referenceType: 'sales-order',
        referenceId: 'SO-2',
      },
    });
    assert.equal(issue.status, 201);
    const empty = balanceAt(await balancesFor(variantA.id), 'MAIN');
    assert.equal(empty.onHand, 0);
    assert.equal(empty.sellable, 0);
    assert.equal(await marketAvailability(), 'ENQUIRE');

    const oversell = await call(inventoryUrl(organizationA.id, 'issues'), {
      method: 'POST',
      cookie: cookies.admin,
      body: { warehouseId: warehouseMain.id, lines: [{ variantId: variantA.id, quantity: 1 }] },
    });
    assert.equal(oversell.status, 409);
    assert.equal((await oversell.json()).error.code, 'INSUFFICIENT_STOCK');

    const refill = await receipt({
      warehouseId: warehouseMain.id,
      lines: [{ variantId: variantA.id, quantity: 2 }],
    });
    assert.equal(refill.status, 201);
    assert.equal(await marketAvailability(), 'IN_STOCK');
  });

  await t.test('damage moves stock out of sellable on-hand quantity', async () => {
    const damage = await call(inventoryUrl(organizationA.id, 'damage'), {
      method: 'POST',
      cookie: cookies.admin,
      body: {
        warehouseId: warehouseMain.id,
        reason: 'Crushed in transit',
        lines: [{ variantId: variantA.id, quantity: 1 }],
      },
    });
    assert.equal(damage.status, 201);
    const posting = await damage.json();
    const effectsByBucket = Object.fromEntries(
      posting.movements.map(({ bucket, quantity }) => [bucket, quantity]),
    );
    assert.deepEqual(effectsByBucket, { DAMAGED: 1, ON_HAND: -1 });

    const balance = balanceAt(await balancesFor(variantA.id), 'MAIN');
    assert.equal(balance.onHand, 1);
    assert.equal(balance.damaged, 1);
    assert.equal(balance.sellable, 1);
    assert.equal(await marketAvailability(), 'IN_STOCK');

    const overDamage = await call(inventoryUrl(organizationA.id, 'damage'), {
      method: 'POST',
      cookie: cookies.admin,
      body: {
        warehouseId: warehouseMain.id,
        reason: 'Second write-off',
        lines: [{ variantId: variantA.id, quantity: 2 }],
      },
    });
    assert.equal(overDamage.status, 409);
    assert.equal((await overDamage.json()).error.code, 'INSUFFICIENT_STOCK');
  });

  await t.test('transfers respect the market counting policy of each warehouse', async () => {
    const transfer = await call(inventoryUrl(organizationA.id, 'transfers'), {
      method: 'POST',
      cookie: cookies.admin,
      body: {
        fromWarehouseId: warehouseMain.id,
        toWarehouseId: warehouseQuarantine.id,
        lines: [{ variantId: variantA.id, quantity: 1 }],
        reason: 'Move to quarantine',
      },
    });
    assert.equal(transfer.status, 201);
    const posting = await transfer.json();
    assert.equal(posting.type, 'TRANSFER_OUT');
    assert.equal(posting.movements.length, 2);

    const main = balanceAt(await balancesFor(variantA.id), 'MAIN');
    assert.equal(main.onHand, 0);
    assert.equal(await marketAvailability(), 'ENQUIRE');

    const explanation = await call(
      inventoryUrl(organizationA.id, `availability/${product.id}`),
      { cookie: cookies.admin },
    );
    assert.equal(explanation.status, 200);
    const details = await explanation.json();
    assert.equal(details.availability, 'ENQUIRE');
    const variantDetail = details.variants.find((variant) => variant.variantId === variantA.id);
    const quarantine = variantDetail.warehouses.find((warehouse) => warehouse.code === 'QUARANTINE');
    assert.equal(quarantine.countedForMarket, false);
    assert.equal(quarantine.onHand, 1);
    assert.equal(variantDetail.sellableQuantity, 0);

    await prisma.warehouse.update({ where: { id: warehouseQuarantine.id }, data: { countsForMarket: true } });
    assert.equal(await marketAvailability(), 'IN_STOCK');
    await prisma.warehouse.update({ where: { id: warehouseQuarantine.id }, data: { countsForMarket: false } });
    assert.equal(await marketAvailability(), 'ENQUIRE');
  });

  await t.test('the enquiry fallback is an operator decision, not a frontend default', async () => {
    const patch = await call(catalogUrl(organizationA.id, `products/${product.id}`), {
      method: 'PATCH',
      cookie: cookies.admin,
      body: { isEnquiryAllowed: false },
    });
    assert.equal(patch.status, 200);
    assert.equal(await marketAvailability(), 'UNAVAILABLE');

    const restore = await call(catalogUrl(organizationA.id, `products/${product.id}`), {
      method: 'PATCH',
      cookie: cookies.admin,
      body: { isEnquiryAllowed: true },
    });
    assert.equal(restore.status, 200);
    assert.equal(await marketAvailability(), 'ENQUIRE');
  });

  await t.test('branch-scoped members cannot post outside their branch', async () => {
    const allowed = await receipt(
      { warehouseId: warehouseMain.id, lines: [{ variantId: variantA.id, quantity: 3 }] },
      cookies.manager,
    );
    assert.equal(allowed.status, 201);

    const outside = await receipt(
      { warehouseId: warehouseOther.id, lines: [{ variantId: variantA.id, quantity: 1 }] },
      cookies.manager,
    );
    assert.equal(outside.status, 404);
    assert.equal((await outside.json()).error.code, 'WAREHOUSE_NOT_FOUND');

    const staffWrite = await receipt(
      { warehouseId: warehouseMain.id, lines: [{ variantId: variantA.id, quantity: 1 }] },
      cookies.staff,
    );
    assert.equal(staffWrite.status, 403);
    assert.equal((await staffWrite.json()).error.code, 'PERMISSION_DENIED');

    const staffRead = await call(inventoryUrl(organizationA.id, 'balances'), { cookie: cookies.staff });
    assert.equal(staffRead.status, 200);

    const managerAdjust = await call(inventoryUrl(organizationA.id, 'adjustments'), {
      method: 'POST',
      cookie: cookies.manager,
      body: {
        warehouseId: warehouseMain.id,
        reason: 'Manager cycle count',
        lines: [{ variantId: variantA.id, quantity: 1 }],
      },
    });
    assert.equal(managerAdjust.status, 403);
    assert.equal((await managerAdjust.json()).error.code, 'PERMISSION_DENIED');
  });

  await t.test('an adjustment with a written reason is the only way to fix a count', async () => {
    const adjust = await call(inventoryUrl(organizationA.id, 'adjustments'), {
      method: 'POST',
      cookie: cookies.admin,
      body: {
        warehouseId: warehouseMain.id,
        reason: 'Physical count correction',
        lines: [{ variantId: variantA.id, quantity: 2 }],
      },
    });
    assert.equal(adjust.status, 201);
    const posting = await adjust.json();
    assert.equal(posting.type, 'ADJUSTMENT_INCREASE');
    const balance = balanceAt(await balancesFor(variantA.id), 'MAIN');
    assert.equal(balance.onHand, 5);
  });

  await t.test('inventory is isolated to the organization', async () => {
    const foreignWarehouse = await receipt({
      warehouseId: warehouseForeign.id,
      lines: [{ variantId: variantA.id, quantity: 1 }],
    });
    assert.equal(foreignWarehouse.status, 404);
    assert.equal((await foreignWarehouse.json()).error.code, 'WAREHOUSE_NOT_FOUND');

    const foreignScope = await call(inventoryUrl(organizationB.id, 'balances'), { cookie: cookies.admin });
    assert.equal(foreignScope.status, 403);
    assert.equal((await foreignScope.json()).error.code, 'PERMISSION_DENIED');

    const stored = await prisma.stockBalance.count({ where: { organizationId: organizationB.id } });
    assert.equal(stored, 0);
  });

  await t.test('invalid postings are rejected with normalized errors', async () => {
    const zeroQuantity = await receipt({
      warehouseId: warehouseMain.id,
      lines: [{ variantId: variantA.id, quantity: 0 }],
    });
    assert.equal(zeroQuantity.status, 400);
    assert.equal((await zeroQuantity.json()).error.code, 'VALIDATION_ERROR');

    const emptyLines = await receipt({ warehouseId: warehouseMain.id, lines: [] });
    assert.equal(emptyLines.status, 400);

    const zeroAdjustment = await call(inventoryUrl(organizationA.id, 'adjustments'), {
      method: 'POST',
      cookie: cookies.admin,
      body: {
        warehouseId: warehouseMain.id,
        reason: 'No-op adjustment',
        lines: [{ variantId: variantA.id, quantity: 0 }],
      },
    });
    assert.equal(zeroAdjustment.status, 400);

    const reasonlessDamage = await call(inventoryUrl(organizationA.id, 'damage'), {
      method: 'POST',
      cookie: cookies.admin,
      body: { warehouseId: warehouseMain.id, lines: [{ variantId: variantA.id, quantity: 1 }] },
    });
    assert.equal(reasonlessDamage.status, 400);

    const sameWarehouseTransfer = await call(inventoryUrl(organizationA.id, 'transfers'), {
      method: 'POST',
      cookie: cookies.admin,
      body: {
        fromWarehouseId: warehouseMain.id,
        toWarehouseId: warehouseMain.id,
        lines: [{ variantId: variantA.id, quantity: 1 }],
      },
    });
    assert.equal(sameWarehouseTransfer.status, 409);
    assert.equal((await sameWarehouseTransfer.json()).error.code, 'SAME_WAREHOUSE_TRANSFER');

    const unknownVariant = await receipt({
      warehouseId: warehouseMain.id,
      lines: [{ variantId: randomUUID(), quantity: 1 }],
    });
    assert.equal(unknownVariant.status, 404);
    assert.equal((await unknownVariant.json()).error.code, 'VARIANT_NOT_FOUND');

    const unknownFilter = await call(
      inventoryUrl(organizationA.id, 'balances?nonsense=1'),
      { cookie: cookies.admin },
    );
    assert.equal(unknownFilter.status, 400);
  });

  await t.test('concurrent issues cannot oversell the same balance', async () => {
    const fill = await receipt({
      warehouseId: warehouseMain.id,
      lines: [{ variantId: variantB.id, quantity: 10 }],
    });
    assert.equal(fill.status, 201);

    const issue = () =>
      call(inventoryUrl(organizationA.id, 'issues'), {
        method: 'POST',
        cookie: cookies.admin,
        body: { warehouseId: warehouseMain.id, lines: [{ variantId: variantB.id, quantity: 6 }] },
      });
    const [first, second] = await Promise.all([issue(), issue()]);
    assert.deepEqual([first.status, second.status].sort(), [201, 409]);
    const failed = first.status === 409 ? first : second;
    assert.equal((await failed.json()).error.code, 'INSUFFICIENT_STOCK');

    const balance = balanceAt(await balancesFor(variantB.id), 'MAIN');
    assert.equal(balance.onHand, 4);
  });

  await t.test('balances reconcile with the ledger and tampering is detectable', async () => {
    const consistent = await call(inventoryUrl(organizationA.id, 'reconciliation'), { cookie: cookies.admin });
    assert.equal(consistent.status, 200);
    const report = await consistent.json();
    assert.equal(report.consistent, true);
    assert.equal(report.mismatches.length, 0);
    assert.ok(report.checked.balances >= 2);

    const mainBalance = await prisma.stockBalance.findUniqueOrThrow({
      where: { warehouseId_variantId: { warehouseId: warehouseMain.id, variantId: variantA.id } },
    });
    await prisma.stockBalance.update({
      where: { id: mainBalance.id },
      data: { onHand: { increment: 7 } },
    });

    const tampered = await call(inventoryUrl(organizationA.id, 'reconciliation'), { cookie: cookies.admin });
    const tamperedReport = await tampered.json();
    assert.equal(tamperedReport.consistent, false);
    const mismatch = tamperedReport.mismatches.find(
      (entry) => entry.warehouseId === warehouseMain.id && entry.variantId === variantA.id,
    );
    assert.equal(mismatch.bucket, 'ON_HAND');
    assert.equal(mismatch.ledger, mainBalance.onHand);
    assert.equal(mismatch.balance, mainBalance.onHand + 7);

    await prisma.stockBalance.update({
      where: { id: mainBalance.id },
      data: { onHand: mainBalance.onHand },
    });
    const restored = await call(inventoryUrl(organizationA.id, 'reconciliation'), { cookie: cookies.admin });
    assert.equal((await restored.json()).consistent, true);
  });

  await t.test('ledger rows cannot be rewritten or deleted, even directly in SQL', async () => {
    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { organizationId: organizationA.id },
      select: { id: true },
    });
    await assert.rejects(
      () =>
        prisma.$executeRawUnsafe(
          `UPDATE "inventory_movements" SET "quantity" = 999 WHERE "id" = '${movement.id}'`,
        ),
      /append-only/u,
    );
    await assert.rejects(
      () =>
        prisma.$executeRawUnsafe(`DELETE FROM "inventory_movements" WHERE "id" = '${movement.id}'`),
      /append-only/u,
    );

    const stillThere = await prisma.inventoryMovement.count({
      where: { organizationId: organizationA.id },
    });
    assert.ok(stillThere > 0);
  });

  await t.test('every inventory operation is audited', async () => {
    const events = await prisma.auditEvent.findMany({
      where: { organizationId: organizationA.id },
      select: { action: true },
    });
    const recorded = new Set(events.map(({ action }) => action));
    for (const action of [
      'inventory.receipt.posted',
      'inventory.reserve.posted',
      'inventory.release.posted',
      'inventory.issue.posted',
      'inventory.damage.posted',
      'inventory.transfer_out.posted',
      'inventory.adjustment_increase.posted',
    ]) {
      assert.ok(recorded.has(action), `expected audit action ${action}`);
    }
  });
});
