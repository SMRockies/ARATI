import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionToken,
  hashSessionToken,
  hasOrganizationScope,
  hasValidMutationOrigin,
  readSessionToken,
  setSessionCookie,
} from '../dist/auth/auth-security.js';

const organizationId = 'org-1';
const branchA = 'branch-a';
const branchB = 'branch-b';

function requestWithHeaders(headers = {}) {
  return {
    headers,
    header(name) {
      return headers[name.toLowerCase()];
    },
  };
}

test('session tokens are opaque, URL-safe, and stored through a deterministic digest', () => {
  const first = createSessionToken();
  const second = createSessionToken();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/u);
  assert.notEqual(first, second);
  assert.equal(hashSessionToken(first), hashSessionToken(first));
  assert.notEqual(hashSessionToken(first), first);
});

test('session cookie parsing accepts only the environment-specific cookie and token format', () => {
  const token = createSessionToken();
  assert.equal(readSessionToken(requestWithHeaders({ cookie: `other=x; arati_session=${token}` }), false), token);
  assert.equal(readSessionToken(requestWithHeaders({ cookie: `arati_session=${token}` }), true), undefined);
  assert.equal(readSessionToken(requestWithHeaders({ cookie: 'arati_session=not-a-token' }), false), undefined);
  assert.equal(readSessionToken(requestWithHeaders({ cookie: `arati_session=${token}` }), false), token);
});

test('session cookies are HttpOnly, strict same-site, and secure with a host prefix in production', () => {
  const cookies = [];
  const response = { setHeader(name, value) { cookies.push([name, value]); } };
  const token = createSessionToken();
  setSessionCookie(response, token, true, 600);
  assert.equal(cookies[0][0], 'Set-Cookie');
  assert.match(cookies[0][1], /^__Host-arati_session=/u);
  assert.match(cookies[0][1], /HttpOnly/u);
  assert.match(cookies[0][1], /SameSite=Strict/u);
  assert.match(cookies[0][1], /Secure/u);
  setSessionCookie(response, undefined, false);
  assert.match(cookies[1][1], /^arati_session=;/u);
});

test('mutation origin validation requires the configured origin', () => {
  assert.equal(hasValidMutationOrigin(requestWithHeaders({ origin: 'https://market.example' }), 'https://market.example/'), true);
  assert.equal(hasValidMutationOrigin(requestWithHeaders({ origin: 'https://evil.example' }), 'https://market.example'), false);
  assert.equal(hasValidMutationOrigin(requestWithHeaders(), 'https://market.example'), false);
  assert.equal(hasValidMutationOrigin(requestWithHeaders({ origin: 'not a url' }), 'https://market.example'), false);
});

test('mutation origin validation accepts any origin from the configured allow list', () => {
  const allowed = ['http://localhost:3000', 'http://localhost:3002'];
  assert.equal(hasValidMutationOrigin(requestWithHeaders({ origin: 'http://localhost:3000' }), allowed), true);
  assert.equal(hasValidMutationOrigin(requestWithHeaders({ origin: 'http://localhost:3002' }), allowed), true);
  assert.equal(hasValidMutationOrigin(requestWithHeaders({ origin: 'http://localhost:3003' }), allowed), false);
  assert.equal(hasValidMutationOrigin(requestWithHeaders({ origin: 'https://localhost:3000' }), allowed), false);
});

test('organization and branch membership limits authorization to the granted scope', () => {
  const memberships = [
    { organizationId, branchId: branchA, permissions: ['branch.read', 'user.read'] },
    { organizationId: 'other-org', branchId: null, permissions: ['*'] },
  ];
  assert.equal(hasOrganizationScope(memberships, organizationId, branchA, 'branch.read'), true);
  assert.equal(hasOrganizationScope(memberships, organizationId, branchB, 'branch.read'), false);
  // A branch-scoped member passes an organization-level permission check; the
  // PermissionGuard then narrows authorizationScope.branchIds to their branches,
  // so controllers only return in-scope records (covered by the Phase 1 integration test).
  assert.equal(hasOrganizationScope(memberships, organizationId, undefined, 'branch.read'), true);
  assert.equal(hasOrganizationScope(memberships, 'other-org', undefined, 'anything'), true);
});

test('organization-wide membership covers branches, but not permissions it lacks', () => {
  const memberships = [{ organizationId, branchId: null, permissions: ['branch.read'] }];
  assert.equal(hasOrganizationScope(memberships, organizationId, branchA, 'branch.read'), true);
  assert.equal(hasOrganizationScope(memberships, organizationId, undefined, 'branch.read'), true);
  assert.equal(hasOrganizationScope(memberships, organizationId, branchA, 'user.create'), false);
});
