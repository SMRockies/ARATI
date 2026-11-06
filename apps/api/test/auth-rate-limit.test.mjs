import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedWindowLimiter } from '../dist/rate-limit/fixed-window.js';
import {
  AuthLoginRateLimitGuard,
  AUTH_LOGIN_ACCOUNT_LIMIT,
  AUTH_LOGIN_IP_LIMIT,
  AUTH_LOGIN_WINDOW_MS,
} from '../dist/auth/auth.rate-limit.js';

function contextFor({ ip = '203.0.113.7', email } = {}) {
  const request = { ip, socket: { remoteAddress: ip }, body: email === undefined ? {} : { email } };
  return { switchToHttp: () => ({ getRequest: () => request }) };
}

test('the fixed window allows up to the limit, then reports a retry delay', () => {
  const limiter = new FixedWindowLimiter(3, 1000);
  const start = 10_000;

  assert.equal(limiter.take('a', start), null);
  assert.equal(limiter.take('a', start + 10), null);
  assert.equal(limiter.take('a', start + 20), null);

  // Fourth call is refused, with the remaining time in the window.
  assert.equal(limiter.take('a', start + 400), 1);
});

test('the window resets once it has elapsed', () => {
  const limiter = new FixedWindowLimiter(2, 1000);
  limiter.take('a', 0);
  limiter.take('a', 0);
  assert.notEqual(limiter.take('a', 500), null);
  assert.equal(limiter.take('a', 1000), null);
});

test('keys are independent, and forget() drops one', () => {
  const limiter = new FixedWindowLimiter(1, 1000);
  assert.equal(limiter.take('a', 0), null);
  assert.equal(limiter.take('b', 0), null);
  assert.notEqual(limiter.take('a', 0), null);

  limiter.forget(['a']);
  assert.equal(limiter.take('a', 0), null);
});

test('an expired sweep keeps the map from growing without bound', () => {
  const limiter = new FixedWindowLimiter(2, 100);
  for (let index = 0; index < 50; index += 1) limiter.take(`ip-${index}`, 0);
  limiter.take('later', 1000);
  assert.ok(limiter.size < 50, `expected the sweep to drop expired keys, kept ${limiter.size}`);
});

test('the login guard allows a normal attempt and no-ops without an email', () => {
  const guard = new AuthLoginRateLimitGuard();
  assert.equal(guard.canActivate(contextFor({ email: 'admin@arati.local' })), true);
  assert.equal(guard.canActivate(contextFor()), true);
});

test('one address cannot hammer one account beyond the account limit', () => {
  const guard = new AuthLoginRateLimitGuard();
  const context = contextFor({ email: 'Admin@Arati.local' });

  for (let attempt = 0; attempt < AUTH_LOGIN_ACCOUNT_LIMIT; attempt += 1) {
    assert.equal(guard.canActivate(context), true, `attempt ${attempt + 1} should be allowed`);
  }

  assert.throws(
    () => guard.canActivate(context),
    (error) => error.getStatus() === 429 && error.getResponse().code === 'RATE_LIMITED'
      && Number.isInteger(error.getResponse().retryAfterSeconds)
      && error.getResponse().retryAfterSeconds <= AUTH_LOGIN_WINDOW_MS / 1000,
  );
});

test('the account key is case-insensitive so casing cannot reset the count', () => {
  const guard = new AuthLoginRateLimitGuard();
  for (let attempt = 0; attempt < AUTH_LOGIN_ACCOUNT_LIMIT; attempt += 1) {
    guard.canActivate(contextFor({ email: `user${attempt % 2 === 0 ? '@arati.local' : '@ARATI.local'}`, ip: '198.51.100.4' }));
  }
  // The mixed casing belongs to the same account from the same address.
  assert.throws(() => guard.canActivate(contextFor({ email: 'USER@arati.local', ip: '198.51.100.4' })), {
    message: 'Too many sign-in attempts; try again shortly.',
  });
});

test('a second address is unaffected by the first address being throttled', () => {
  const guard = new AuthLoginRateLimitGuard();
  for (let attempt = 0; attempt < AUTH_LOGIN_ACCOUNT_LIMIT; attempt += 1) {
    guard.canActivate(contextFor({ email: 'shared@arati.local', ip: '192.0.2.10' }));
  }
  assert.throws(() => guard.canActivate(contextFor({ email: 'shared@arati.local', ip: '192.0.2.10' })));
  assert.equal(guard.canActivate(contextFor({ email: 'shared@arati.local', ip: '192.0.2.11' })), true);
});

test('password spraying across many accounts is caught by the address limit', () => {
  const guard = new AuthLoginRateLimitGuard();
  for (let attempt = 0; attempt < AUTH_LOGIN_IP_LIMIT; attempt += 1) {
    assert.equal(guard.canActivate(contextFor({ ip: '203.0.113.99', email: `target${attempt}@arati.local` })), true);
  }
  assert.throws(
    () => guard.canActivate(contextFor({ ip: '203.0.113.99', email: 'another@arati.local' })),
    (error) => error.getStatus() === 429,
  );
});
