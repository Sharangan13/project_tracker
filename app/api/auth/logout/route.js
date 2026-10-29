import { route, json } from '../../../../lib/server/http.js';
import { destroySession, clearSessionCookie } from '../../../../lib/server/session.js';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = route(async ({ req }) => {
  await destroySession(req);
  return clearSessionCookie(json({ ok: true }));
}, { public: true });
