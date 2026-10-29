import { route, json } from '../../../../lib/server/http.js';
import { HttpError } from '../../../../lib/server/errors.js';
import { query, tx } from '../../../../lib/server/db.js';
import * as v from '../../../../lib/server/validate.js';
import { verifyPassword } from '../../../../lib/server/security.js';
import { createSession, attachSession } from '../../../../lib/server/session.js';
import { isLimited, record, clear, clientIp } from '../../../../lib/server/throttle.js';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// "Login to a Team": team code + username + password. The session is pinned to that one team.
export const POST = route(async ({ req, body }) => {
  const code = v.normalizeTeamCode(body.teamCode);
  const u = String(body.username ?? '').trim().toLowerCase().slice(0, 30);
  const pw = v.loginPassword(body.password);
  const fail = new HttpError(401, 'Incorrect team code, username or password.');
  const ipB = `login:ip:${clientIp(req)}`, userB = `login:team:${code}:${u}`;
  if ((await isLimited(ipB, 40, 15)) || (await isLimited(userB, 8, 15))) throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.');
  const { rows } = code ? await query(
    `select u.id, u.password_hash, u.is_active, t.id as team_id
       from teams t
       join users u on u.username = $2
       join team_memberships m on m.team_id = t.id and m.user_id = u.id and m.is_active
      where t.code = $1`, [code, u]) : { rows: [] };
  const row = rows[0];
  const ok = await verifyPassword(pw, row?.password_hash);
  if (!row || !row.is_active || !ok) { await record(ipB); await record(userB); throw fail; }
  await clear(userB);
  const session = await tx((c) => createSession(c, { userId: row.id, teamId: row.team_id, userAgent: req.headers.get('user-agent') }));
  return attachSession(json({ ok: true, teamId: row.team_id }), session);
}, { public: true });
