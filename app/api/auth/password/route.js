import { route, json } from '../../../../lib/server/http.js';
import { HttpError } from '../../../../lib/server/errors.js';
import { query } from '../../../../lib/server/db.js';
import * as v from '../../../../lib/server/validate.js';
import { hashPassword, verifyPassword } from '../../../../lib/server/security.js';
import { isLimited, record, clear } from '../../../../lib/server/throttle.js';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Change your own password (works from account and team sessions). Signs out all other sessions.
export const POST = route(async ({ auth, body }) => {
  const bucket = `pwchange:${auth.user.id}`;
  if (await isLimited(bucket, 6, 15)) throw new HttpError(429, 'Too many attempts. Please wait a few minutes.');
  const next = v.newPassword(body.newPassword, 'New password');
  const { rows } = await query('select password_hash from users where id = $1', [auth.user.id]);
  if (!(await verifyPassword(String(body.currentPassword ?? '').slice(0, 128), rows[0]?.password_hash))) {
    await record(bucket);
    throw new HttpError(400, 'Your current password is incorrect.');
  }
  await query('update users set password_hash = $1 where id = $2', [await hashPassword(next), auth.user.id]);
  await query('delete from user_sessions where user_id = $1 and id <> $2', [auth.user.id, auth.sessionId]);
  await clear(bucket);
  return json({ ok: true });
});
