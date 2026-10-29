// Password hashing and token helpers. Uses only Node's built-in crypto (no native modules),
// so it runs unchanged on Vercel serverless functions.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const PARAMS = { N: 32768, r: 8, p: 3 }; // OWASP-recommended scrypt cost tier
const KEYLEN = 32;

const maxmem = (N, r) => 256 * N * r;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEYLEN, { ...PARAMS, maxmem: maxmem(PARAMS.N, PARAMS.r) });
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

let dummyHash;
// Verifies a password. If `stored` is missing, still burns the same CPU time so response
// timing doesn't reveal whether a username exists.
export async function verifyPassword(password, stored) {
  let hash = stored;
  let real = true;
  if (typeof hash !== 'string') {
    real = false;
    dummyHash ??= await hashPassword('dummy-password-for-timing');
    hash = dummyHash;
  }
  const [alg, N, r, p, salt, key] = hash.split('$');
  if (alg !== 'scrypt' || !key) return false;
  const params = { N: +N, r: +r, p: +p };
  if (!(params.N <= 1 << 17 && params.r <= 16 && params.p <= 8)) return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await scryptAsync(String(password), Buffer.from(salt, 'base64'), expected.length, { ...params, maxmem: maxmem(params.N, params.r) });
  return timingSafeEqual(actual, expected) && real;
}

export const newSessionToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, no 0/O/1/I -> byte % 32 is unbiased
export function newTeamCode() {
  return Array.from(randomBytes(8), (b) => CODE_ALPHABET[b % 32]).join('');
}
export const formatTeamCode = (c) => (c ? `${c.slice(0, 4)}-${c.slice(4)}` : '');
