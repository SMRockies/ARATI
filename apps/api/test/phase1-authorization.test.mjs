import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { loadEnvironment } from '@arati/config/load-env.mjs';

await loadEnvironment();

const port = 3102;
const baseUrl = `http://127.0.0.1:${port}`;
const allowedOrigin = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim();

const prisma = new PrismaClient();
const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const suffix = runId.toUpperCase();
const adminEmail = `p1-admin-${runId}@example.com`;
const staffEmail = `p1-staff-${runId}@example.com`;
const staffPassword = 'Phase1-Staff-Password!';
const adminPassword = 'Phase1-Admin-Password!';

const created = {
  userIds: [],
  organizationIds: [],
  branchIds: [],
};

async function setupFixture() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;

  const permissionCodes = ['branch.read', 'user.read', 'user.create'];
  const permissionDescriptions = {
    'branch.read': 'Read branches within the assigned organization scope',
    'user.read': 'Read users within the assigned organization scope',
    'user.create': 'Create users with permissions no greater than the caller',
  };
  for (const code of permissionCodes) {
    await prisma.permission.upsert({
      where: { code },
      update: { description: permissionDescriptions[code] },
      create: { code, description: permissionDescriptions[code] },
    });
  }
  const adminRole = await prisma.role.upsert({
    where: { code: 'ORG_ADMIN' },
    update: {},
    create: { code: 'ORG_ADMIN', name: 'Organization administrator', isSystem: true },
  });
  const staffRole = await prisma.role.upsert({
    where: { code: 'BRANCH_STAFF' },
    update: {},
    create: { code: 'BRANCH_STAFF', name: 'Branch staff', isSystem: true },
  });
  for (const [role, codes] of [
    [adminRole, permissionCodes],
    [staffRole, ['branch.read']],
  ]) {
    for (const permissionCode of codes) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionCode: { roleId: role.id, permissionCode } },
        update: {},
        create: { roleId: role.id, permissionCode },
      });
    }
  }

  const organizationA = await prisma.organization.create({
    data: { code: `P1A${suffix}`, name: 'Phase 1 Test Organization A', timezone: 'Asia/Kolkata' },
  });
  const organizationB = await prisma.organization.create({
    data: { code: `P1B${suffix}`, name: 'Phase 1 Test Organization B', timezone: 'Asia/Kolkata' },
  });
  const branch = await prisma.branch.create({
    data: { organizationId: organizationA.id, code: 'MAIN', name: 'Phase 1 Test Branch' },
  });
  created.organizationIds.push(organizationA.id, organizationB.id);
  created.branchIds.push(branch.id);

  const adminHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: adminHash,
      displayName: 'Phase 1 Test Admin',
      memberships: { create: { organizationId: organizationA.id, branchId: null, roleId: adminRole.id } },
    },
  });
  created.userIds.push(admin.id);

  return { organizationA, organizationB, branch, admin, staffRole };
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

async function login(email, password, origin = allowedOrigin) {
  return fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email, password }),
  });
}

test('Phase 1: authentication, organization isolation, fail-closed authorization, audit', async (t) => {
  let fixture;
  try {
    fixture = await setupFixture();
  } catch (error) {
    t.diagnostic(`Database unavailable (${error.message}). Run "pnpm db:deploy && pnpm db:seed" first.`);
    throw error;
  }
  const server = startServer();
  await waitForServer();

  const cookieJar = new Map();
  t.after(async () => {
    server.kill();
    const userIds = [...created.userIds, ...(fixture?.staffUserId ? [fixture.staffUserId] : [])];
    await prisma.auditEvent.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { organizationId: { in: created.organizationIds } }] },
    });
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.organizationMembership.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.branch.deleteMany({ where: { id: { in: created.branchIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: created.organizationIds } } });
    await prisma.$disconnect();
  });

  await t.test('private routes fail closed without a session', async () => {
    const me = await fetch(`${baseUrl}/api/v1/auth/me`);
    assert.equal(me.status, 401);

    const createUser = await fetch(`${baseUrl}/api/v1/organizations/${fixture.organizationA.id}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: allowedOrigin },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'At-Least-12-Chars!', displayName: 'Nobody', roleCode: 'BRANCH_STAFF' }),
    });
    assert.equal(createUser.status, 401);
  });

  await t.test('unsafe requests from a foreign origin are rejected', async () => {
    const response = await login(adminEmail, adminPassword, 'https://evil.example');
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'ORIGIN_REJECTED');
  });

  await t.test('invalid credentials are rejected and audited', async () => {
    const response = await login(adminEmail, 'wrong-password');
    assert.equal(response.status, 401);
    const failure = await prisma.auditEvent.findFirst({
      where: { userId: fixture.admin.id, action: 'auth.login.failed' },
    });
    assert.ok(failure, 'expected an audit record for the failed login');
  });

  await t.test('admin login succeeds and establishes a session', async () => {
    const response = await login(adminEmail, adminPassword);
    assert.equal(response.status, 200);
    cookieJar.set('admin', sessionCookie(response));

    const me = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { cookie: cookieJar.get('admin') } });
    assert.equal(me.status, 200);
    const body = await me.json();
    assert.equal(body.user.email, adminEmail);
    assert.ok(body.memberships.some((m) => m.organizationId === fixture.organizationA.id && m.roleCode === 'ORG_ADMIN'));

    const success = await prisma.auditEvent.findFirst({
      where: { userId: fixture.admin.id, action: 'auth.login.succeeded' },
    });
    assert.ok(success, 'expected an audit record for the successful login');
  });

  await t.test('organization listing is scoped to the callers memberships', async () => {
    const response = await fetch(`${baseUrl}/api/v1/organizations`, { headers: { cookie: cookieJar.get('admin') } });
    assert.equal(response.status, 200);
    const { items } = await response.json();
    const ids = items.map((item) => item.id);
    assert.ok(ids.includes(fixture.organizationA.id));
    assert.ok(!ids.includes(fixture.organizationB.id), 'org B must not be visible to an org A member');
  });

  await t.test('branch reads are denied outside the callers organization', async () => {
    const inScope = await fetch(`${baseUrl}/api/v1/organizations/${fixture.organizationA.id}/branches`, {
      headers: { cookie: cookieJar.get('admin') },
    });
    assert.equal(inScope.status, 200);
    assert.ok((await inScope.json()).items.some((item) => item.id === fixture.branch.id));

    const outOfScope = await fetch(`${baseUrl}/api/v1/organizations/${fixture.organizationB.id}/branches`, {
      headers: { cookie: cookieJar.get('admin') },
    });
    assert.equal(outOfScope.status, 403);
    assert.equal((await outOfScope.json()).error.code, 'PERMISSION_DENIED');
  });

  await t.test('admin creates a branch-scoped user with an audit record', async () => {
    const response = await fetch(`${baseUrl}/api/v1/organizations/${fixture.organizationA.id}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieJar.get('admin'), origin: allowedOrigin },
      body: JSON.stringify({
        email: staffEmail,
        password: staffPassword,
        displayName: 'Phase 1 Test Staff',
        roleCode: 'BRANCH_STAFF',
        branchId: fixture.branch.id,
      }),
    });
    assert.equal(response.status, 201);
    const { user } = await response.json();
    fixture.staffUserId = user.id;
    created.userIds.push(user.id);

    const audit = await prisma.auditEvent.findFirst({
      where: { userId: fixture.admin.id, organizationId: fixture.organizationA.id, action: 'identity.user.created' },
    });
    assert.ok(audit, 'expected an audit record for user creation');
  });

  await t.test('restricted user is limited to their branch scope', async () => {
    const response = await login(staffEmail, staffPassword);
    assert.equal(response.status, 200);
    cookieJar.set('staff', sessionCookie(response));

    const branches = await fetch(`${baseUrl}/api/v1/organizations/${fixture.organizationA.id}/branches`, {
      headers: { cookie: cookieJar.get('staff') },
    });
    assert.equal(branches.status, 200);
    const items = (await branches.json()).items;
    assert.deepEqual(items.map((item) => item.id), [fixture.branch.id], 'branch staff must only see their own branch');

    const users = await fetch(`${baseUrl}/api/v1/organizations/${fixture.organizationA.id}/users`, {
      headers: { cookie: cookieJar.get('staff') },
    });
    assert.equal(users.status, 403);
    assert.equal((await users.json()).error.code, 'PERMISSION_DENIED');
  });

  await t.test('restricted user cannot reach another organization', async () => {
    const branches = await fetch(`${baseUrl}/api/v1/organizations/${fixture.organizationB.id}/branches`, {
      headers: { cookie: cookieJar.get('staff') },
    });
    assert.equal(branches.status, 403);
    assert.equal((await branches.json()).error.code, 'PERMISSION_DENIED');

    const createUser = await fetch(`${baseUrl}/api/v1/organizations/${fixture.organizationA.id}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieJar.get('staff'), origin: allowedOrigin },
      body: JSON.stringify({
        email: `p1-escalate-${runId}@example.com`,
        password: 'At-Least-12-Chars!',
        displayName: 'Escalation Attempt',
        roleCode: 'ORG_ADMIN',
      }),
    });
    assert.equal(createUser.status, 403);
    assert.equal((await createUser.json()).error.code, 'PERMISSION_DENIED');
  });
});
