import { query } from './db.js';

// DB-backed so it works across serverless instances.
export async function isLimited(bucket, max, minutes) {
  const { rows } = await query(
    `select count(*)::int as n from login_attempts where bucket = $1 and created_at > now() - make_interval(mins => $2::int)`,
    [bucket, minutes],
  );
  return rows[0].n >= max;
}
export async function record(bucket) {
  await query('insert into login_attempts (bucket) values ($1)', [bucket]);
  if (Math.random() < 0.05) await query(`delete from login_attempts where created_at < now() - interval '1 day'`);
}
export const clear = (bucket) => query('delete from login_attempts where bucket = $1', [bucket]);

export function clientIp(req) {
  return (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim().slice(0, 64);
}
