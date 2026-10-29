import { route, json } from '../../../lib/server/http.js';
import { query } from '../../../lib/server/db.js';
import { listMyTeams } from '../../../lib/server/access.js';
import { buildActivityQuery } from '../../../lib/server/activityQuery.js';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Activity for the teams you belong to (a team-login session sees only its own team).
// Filters: team_id, user_id (actor or person affected), action (exact, or "task.*"), from, to (ISO), q, limit, offset.
export const GET = route(async ({ auth, search }) => {
  const teams = await listMyTeams(auth);
  const built = buildActivityQuery({
    allowedTeamIds: teams.map((t) => t.id),
    teamId: search.get('team_id'), userId: search.get('user_id'), action: search.get('action'),
    from: search.get('from'), to: search.get('to'), q: search.get('q'),
    limit: search.get('limit'), offset: search.get('offset'),
  });
  if (!built) return json({ items: [], hasMore: false });
  const { rows } = await query(built.sql, built.params);
  const items = rows.slice(0, built.limit).map((r) => ({
    id: String(r.id), teamId: r.team_id, teamName: r.team_name, actorId: r.actor_id, actorName: r.actor_name,
    action: r.action, entityType: r.entity_type, targetUserId: r.target_user_id, message: r.message, createdAt: r.created_at,
  }));
  return json({ items, hasMore: rows.length > built.limit });
});
