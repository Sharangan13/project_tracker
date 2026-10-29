import { route, json } from '../../../../lib/server/http.js';
import { HttpError } from '../../../../lib/server/errors.js';
import { tx } from '../../../../lib/server/db.js';
import { teamName } from '../../../../lib/server/validate.js';
import { newTeamCode } from '../../../../lib/server/security.js';
import { requireTeam, listMyTeams } from '../../../../lib/server/access.js';
import { logActivity } from '../../../../lib/server/activity.js';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = route(async ({ auth, params }) => {
  const { team } = await requireTeam(auth, params.teamId);
  const t = (await listMyTeams(auth)).find((x) => x.id === team.id);
  return json({ team: t });
});

// Leaders: rename the team and/or regenerate its login code.
export const PATCH = route(async ({ auth, params, body }) => {
  const { team } = await requireTeam(auth, params.teamId, { leader: true });
  await tx(async (c) => {
    if (body.name !== undefined) {
      const name = teamName(body.name);
      if (name !== team.name) {
        await c.query('update teams set name = $1 where id = $2', [name, team.id]);
        await logActivity(c, auth, { teamId: team.id, action: 'team.updated', entityType: 'team', entityId: team.id, message: `Team renamed from “${team.name}” to “${name}”` });
      }
    }
    if (body.regenerateCode === true) {
      let ok = false;
      for (let i = 0; i < 6 && !ok; i++) {
        ok = (await c.query('update teams set code = $1 where id = $2 and not exists (select 1 from teams where code = $1)', [newTeamCode(), team.id])).rowCount === 1;
      }
      if (!ok) throw new HttpError(500, 'Could not generate a new code. Please try again.');
      await logActivity(c, auth, { teamId: team.id, action: 'team.updated', entityType: 'team', entityId: team.id, message: 'Team login code regenerated' });
    }
  });
  return json({ team: (await listMyTeams(auth)).find((x) => x.id === team.id) });
});

// Leaders: delete the team and everything in it. Requires typing the team name.
export const DELETE = route(async ({ auth, params, body }) => {
  const { team } = await requireTeam(auth, params.teamId, { leader: true });
  if (String(body.confirmName ?? '').trim() !== team.name) throw new HttpError(400, 'Type the team name exactly to confirm.');
  await tx((c) => c.query('delete from teams where id = $1', [team.id]));
  return json({ ok: true });
});
