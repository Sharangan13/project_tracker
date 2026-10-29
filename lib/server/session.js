import { query } from './db.js';
import { hashToken, newSessionToken } from './security.js';

export const SESSION_DAYS = 7;
const PROD = process.env.NODE_ENV === 'production';
export const cookieName = () => (PROD ? '__Host-mtt_session' : 'mtt_session');
export const cookieOptions = (expires) => ({ httpOnly: true, secure: PROD, sameSite: 'lax', path: '/', ...(expires ? { expires } : { maxAge: 0 }) });

export async function createSession(client, { userId, teamId = null, userAgent = null }) {
  const token = newSessionToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await client.query(
    'insert into user_sessions (token_hash, user_id, team_id, user_agent, expires_at) values ($1, $2, $3, $4, $5)',
    [hashToken(token), userId, teamId, userAgent ? String(userAgent).slice(0, 300) : null, expires],
  );
  if (Math.random() < 0.05) client.query('delete from user_sessions where expires_at < now()').catch(() => {});
  return { token, expires };
}

export function attachSession(res, { token, expires }) {
  res.cookies.set(cookieName(), token, cookieOptions(expires));
  return res;
}
export function clearSessionCookie(res) {
  res.cookies.set(cookieName(), '', cookieOptions(null));
  return res;
}

// Returns { sessionId, teamId, user: { id, username, displayName } } or null.
export async function loadAuth(req) {
  const token = req.cookies.get(cookieName())?.value;
  if (!token || token.length > 100) return null;
  const { rows } = await query(
    `select s.id as session_id, s.team_id, s.last_seen_at, u.id, u.username, u.display_name
       from user_sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now() and u.is_active
        and (s.team_id is null or exists (
              select 1 from team_memberships m
               where m.team_id = s.team_id and m.user_id = s.user_id and m.is_active))`,
    [hashToken(token)],
  );
  const r = rows[0];
  if (!r) return null;
  if (Date.now() - new Date(r.last_seen_at).getTime() > 600_000) {
    await query('update user_sessions set last_seen_at = now() where id = $1', [r.session_id]);
  }
  return { sessionId: r.session_id, teamId: r.team_id, user: { id: r.id, username: r.username, displayName: r.display_name } };
}

export async function destroySession(req) {
  const token = req.cookies.get(cookieName())?.value;
  if (token && token.length <= 100) await query('delete from user_sessions where token_hash = $1', [hashToken(token)]);
}
