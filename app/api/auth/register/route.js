import { route, json } from '../../../../lib/server/http.js';
import { HttpError } from '../../../../lib/server/errors.js';
import { tx } from '../../../../lib/server/db.js';
import * as v from '../../../../lib/server/validate.js';
import { hashPassword } from '../../../../lib/server/security.js';
import { createSession, attachSession } from '../../../../lib/server/session.js';
import { isLimited, record, clientIp } from '../../../../lib/server/throttle.js';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Personal account registration.
export const POST = route(async ({ req, body }) => {
  const u = v.username(body.username);
  const name = v.displayName(body.displayName);
  const pw = v.newPassword(body.password);
  const bucket = `register:ip:${clientIp(req)}`;
  if (await isLimited(bucket, 10, 60)) throw new HttpError(429, 'Too many sign-ups from this network. Try again later.');
  await record(bucket);
  const hash = await hashPassword(pw);
  const session = await tx(async (c) => {
    const { rows } = await c.query(
      'insert into users (username, display_name, password_hash) values ($1, $2, $3) on conflict (username) do nothing returning id',
      [u, name, hash],
    );
    if (!rows[0]) throw new HttpError(409, 'That username is already taken.');
    return createSession(c, { userId: rows[0].id, userAgent: req.headers.get('user-agent') });
  });
  return attachSession(json({ ok: true }, 201), session);
}, { public: true });
