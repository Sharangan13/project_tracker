import { NextResponse } from 'next/server';
import { HttpError } from './errors.js';
import { isSameOrigin } from './origin.js';
import { loadAuth } from './session.js';

export const json = (data, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

async function readBody(req) {
  if (Number(req.headers.get('content-length') || 0) > 20_000) throw new HttpError(413, 'Request too large.');
  const text = await req.text();
  if (!text) return {};
  if (text.length > 20_000) throw new HttpError(413, 'Request too large.');
  if (!(req.headers.get('content-type') || '').includes('application/json')) throw new HttpError(415, 'Send JSON.');
  let v;
  try { v = JSON.parse(text); } catch { throw new HttpError(400, 'Invalid JSON body.'); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new HttpError(400, 'Invalid JSON body.');
  return v;
}

export function errorResponse(e) {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  console.error('Unhandled API error:', e);
  return json({ error: 'Something went wrong on the server. Please try again.' }, 500);
}

// Wraps a route handler: CSRF check, authentication (unless { public: true }), JSON body parsing, error mapping.
export function route(fn, { public: isPublic = false } = {}) {
  return async (req, ctx) => {
    try {
      const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
      if (unsafe && !isSameOrigin((n) => req.headers.get(n))) throw new HttpError(403, 'Cross-site request blocked.');
      let auth = null;
      if (!isPublic) {
        auth = await loadAuth(req);
        if (!auth) throw new HttpError(401, 'Please sign in.');
      }
      const params = (ctx && (await ctx.params)) || {};
      const body = unsafe ? await readBody(req) : {};
      return await fn({ req, auth, params, body, search: req.nextUrl.searchParams });
    } catch (e) {
      return errorResponse(e);
    }
  };
}
