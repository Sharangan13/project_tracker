import { route, json } from '../../../../lib/server/http.js';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = route(async ({ auth }) => json({
  user: auth.user,
  scope: auth.teamId ? { type: 'team', teamId: auth.teamId } : { type: 'account', teamId: null },
}));
