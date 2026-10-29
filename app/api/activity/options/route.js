import { route, json } from '../../../../lib/server/http.js';
import { query } from '../../../../lib/server/db.js';
import { listMyTeams } from '../../../../lib/server/access.js';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Values for the activity filter drop-downs: my teams, and the people on those teams.
export const GET = route(async ({ auth }) => {
  const teams = await listMyTeams(auth);
  if (!teams.length) return json({ teams: [], users: [] });
  const { rows } = await query(
    `select distinct u.id, u.display_name
       from team_memberships m join users u on u.id = m.user_id
      where m.team_id = any($1::uuid[]) and m.is_active
      order by u.display_name`,
    [teams.map((t) => t.id)],
  );
  return json({ teams: teams.map((t) => ({ id: t.id, name: t.name })), users: rows.map((r) => ({ id: r.id, name: r.display_name })) });
});
