import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, hashToken, newSessionToken, newTeamCode, formatTeamCode } from '../lib/server/security.js';
import { isSameOrigin } from '../lib/server/origin.js';

test('password hash verifies, wrong password fails, salts differ', async () => {
  const h1 = await hashPassword('correct horse battery');
  const h2 = await hashPassword('correct horse battery');
  assert.notEqual(h1, h2);
  assert.ok(h1.startsWith('scrypt$32768$8$3$'));
  assert.equal(await verifyPassword('correct horse battery', h1), true);
  assert.equal(await verifyPassword('wrong password!!', h1), false);
  assert.equal(await verifyPassword('', h1), false);
});
test('unknown user: verify is false (timing-equalised) and malformed hashes are rejected', async () => {
  assert.equal(await verifyPassword('anything', undefined), false);
  assert.equal(await verifyPassword('anything', null), false);
  assert.equal(await verifyPassword('x', 'garbage'), false);
  assert.equal(await verifyPassword('x', 'scrypt$999999999$8$3$AAAA$AAAA'), false);
});
test('session tokens: random, url-safe, stored only as sha256 hex', () => {
  const a = newSessionToken(), b = newSessionToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hashToken(a), /^[0-9a-f]{64}$/);
  assert.notEqual(hashToken(a), a);
});
test('team codes: 8 chars from the unambiguous alphabet', () => {
  for (let i = 0; i < 200; i++) assert.match(newTeamCode(), /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(formatTeamCode('ABCD2345'), 'ABCD-2345');
});
test('origin check (CSRF)', () => {
  const h = (o) => (n) => o[n] ?? null;
  assert.equal(isSameOrigin(h({ host: 'app.com', origin: 'https://app.com' })), true);
  assert.equal(isSameOrigin(h({ host: 'app.com', origin: 'https://evil.com' })), false);
  assert.equal(isSameOrigin(h({ host: 'app.com', origin: 'null' })), false);
  assert.equal(isSameOrigin(h({ host: 'internal', 'x-forwarded-host': 'app.com', origin: 'https://app.com' })), true);
  assert.equal(isSameOrigin(h({ host: 'app.com', 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(isSameOrigin(h({ host: 'app.com', 'sec-fetch-site': 'same-origin' })), true);
  assert.equal(isSameOrigin(h({ host: 'app.com' })), true);
});
