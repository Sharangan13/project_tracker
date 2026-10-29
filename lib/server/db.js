import pg from 'pg';
import { HttpError } from './errors.js';

// One pool per serverless instance (reused across warm invocations and dev hot reloads).
export function getPool() {
  if (globalThis.__mttPool) return globalThis.__mttPool;
  let url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    throw new HttpError(500, 'The server is not configured correctly.');
  }
  const local = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);
  // Strip sslmode from the URL so the explicit ssl option below is what applies.
  url = url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
  const pool = new pg.Pool({
    connectionString: url,
    // Supabase uses its own CA, so the certificate chain is not verified; the connection is still encrypted.
    ssl: local ? false : { rejectUnauthorized: false },
    max: process.env.NODE_ENV === 'production' ? 5 : 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });
  pool.on('error', (e) => console.error('Idle database client error:', e.message));
  globalThis.__mttPool = pool;
  return pool;
}

export const query = (text, params) => getPool().query(text, params);

export async function tx(fn) {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (e) {
    try { await client.query('rollback'); } catch { /* connection already broken */ }
    throw e;
  } finally {
    client.release();
  }
}
