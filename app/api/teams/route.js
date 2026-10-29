import { route, json } from '../../../lib/server/http.js';
import { HttpError } from '../../../lib/server/errors.js';
import { tx } from '../../../lib/server/db.js';
import { teamName } from '../../../lib/server/validate.js';
import { newTeamCode } from '../../../lib/server/security.js';
import { listMyTeams } from '../../../lib/server/access.js';
import { logActivity } from '../../../lib/server/activity.js';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = route(async ({ auth }) => json({ teams: await listMyTeams(auth) }));

// Create a team; the creator becomes its leader. Personal-account sessions only.
export const POST = route(async ({ auth, body }) => {
  if (auth.teamId) throw new HttpError(403, 'Sign in to your personal account to create a team.');
  const name = teamName(body.name);
  const team = await tx(async (c) => {
    let row;
    for (let i = 0; i < 6 && !row; i++) {
      row = (await c.query(
        'insert into teams (name, code, created_by) values ($1, $2, $3) on conflict (code) do nothing returning id, name',
        [name, newTeamCode(), auth.user.id],
      )).rows[0];
    }
    if (!row) throw new HttpError(500, 'Could not generate a team code. Please try again.');
    await c.query(`insert into team_memberships (team_id, user_id, role, added_by) values ($1, $2, 'leader', $2)`, [row.id, auth.user.id]);
    await logActivity(c, auth, { teamId: row.id, action: 'team.created', entityType: 'team', entityId: row.id, message: `Team “${row.name}” created` });
    return row;
  });
  return json({ team: { id: team.id, name: team.name } }, 201);
});
