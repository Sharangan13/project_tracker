import { route, json } from '../../../../lib/server/http.js';
import { HttpError } from '../../../../lib/server/errors.js';
import { query, tx } from '../../../../lib/server/db.js';
import * as v from '../../../../lib/server/validate.js';
import { verifyPassword } from '../../../../lib/server/security.js';
import { createSession, attachSession } from '../../../../lib/server/session.js';
import { isLimited, record, clear, clientIp } from '../../../../lib/server/throttle.js';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// "Login to My Account": username + password, personal (all-teams) session.
export const POST = route(async ({ req, body }) => {
  const u = String(body.username ?? '').trim().toLowerCase().slice(0, 30);
  const pw = v.loginPassword(body.password);
  const ipB = `login:ip:${clientIp(req)}`, userB = `login:user:${u}`;
  if ((await isLimited(ipB, 40, 15)) || (await isLimited(userB, 8, 15))) throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.');
  const { rows } = await query('select id, password_hash, is_active from users where username = $1', [u]);
  const user = rows[0];
  const ok = await verifyPassword(pw, user?.password_hash);
  if (!user || !user.is_active || !ok) {
    await record(ipB); await record(userB);
    throw new HttpError(401, 'Incorrect username or password.');
  }
  await clear(userB);
  const session = await tx((c) => createSession(c, { userId: user.id, userAgent: req.headers.get('user-agent') }));
  return attachSession(json({ ok: true }), session);
}, { public: true });
