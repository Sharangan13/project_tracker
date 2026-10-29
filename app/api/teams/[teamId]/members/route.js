import { route, json } from '../../../../../lib/server/http.js';
import { HttpError } from '../../../../../lib/server/errors.js';
import { query, tx } from '../../../../../lib/server/db.js';
import * as v from '../../../../../lib/server/validate.js';
import { hashPassword } from '../../../../../lib/server/security.js';
import { requireTeam, lockTeam } from '../../../../../lib/server/access.js';
import { isLeader } from '../../../../../lib/server/permissions.js';
import { logActivity } from '../../../../../lib/server/activity.js';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Everyone on the team can see who is on it. Only leaders see usernames and deactivated members.
export const GET = route(async ({ auth, params }) => {
  const { team, role } = await requireTeam(auth, params.teamId);
  const leader = isLeader(role);
  const { rows } = await query(
    `select u.id, u.username, u.display_name, m.role, m.is_active, (u.managed_by_team = m.team_id) as managed, m.created_at,
            (select count(*)::int from team_tasks k where k.team_id = m.team_id and k.assignee_id = u.id and k.status = 'pending') as pending,
            (select count(*)::int from team_tasks k where k.team_id = m.team_id and k.assignee_id = u.id and k.status = 'completed') as completed
       from team_memberships m join users u on u.id = m.user_id
      where m.team_id = $1 and ($2 or m.is_active)
      order by m.created_at, u.display_name`,
    [team.id, leader],
  );
  return json({
    members: rows.map((r) => ({
      id: r.id, displayName: r.display_name, username: leader ? r.username : undefined, role: r.role,
      isActive: r.is_active, managed: leader ? !!r.managed : undefined, joinedAt: r.created_at, pending: r.pending, completed: r.completed,
    })),
  });
});

// Leaders add people: mode "create" makes a new login with credentials; mode "existing" adds an existing username.
export const POST = route(async ({ auth, params, body }) => {
  const { team } = await requireTeam(auth, params.teamId, { leader: true });
  const memberRole = body.role === undefined ? 'member' : v.role(body.role);
  const mode = body.mode === 'existing' ? 'existing' : 'create';
  const u = v.username(body.username);
  const name = mode === 'create' ? v.displayName(body.displayName) : null;
  const hash = mode === 'create' ? await hashPassword(v.newPassword(body.password)) : null;

  const out = await tx(async (c) => {
    await lockTeam(c, team.id);
    let userId, display;
    if (mode === 'create') {
      const r = await c.query(
        'insert into users (username, display_name, password_hash, managed_by_team) values ($1, $2, $3, $4) on conflict (username) do nothing returning id, display_name',
        [u, name, hash, team.id],
      );
      if (!r.rows[0]) throw new HttpError(409, 'That username is already taken. Choose another, or add the existing user instead.');
      userId = r.rows[0].id; display = r.rows[0].display_name;
    } else {
      const r = await c.query('select id, display_name from users where username = $1 and is_active', [u]);
      if (!r.rows[0]) throw new HttpError(404, 'No active user with that username.');
      userId = r.rows[0].id; display = r.rows[0].display_name;
    }
    const existing = (await c.query('select is_active from team_memberships where team_id = $1 and user_id = $2 for update', [team.id, userId])).rows[0];
    if (existing?.is_active) throw new HttpError(409, `${display} is already on this team.`);
    if (existing) await c.query('update team_memberships set is_active = true, role = $3, added_by = $4 where team_id = $1 and user_id = $2', [team.id, userId, memberRole, auth.user.id]);
    else await c.query('insert into team_memberships (team_id, user_id, role, added_by) values ($1, $2, $3, $4)', [team.id, userId, memberRole, auth.user.id]);
    await logActivity(c, auth, { teamId: team.id, action: 'member.added', entityType: 'member', entityId: userId, targetUserId: userId, message: `${display} added to the team as ${memberRole === 'leader' ? 'a team leader' : 'a member'}`, details: { role: memberRole, mode } });
    if (mode === 'create') {
      await logActivity(c, auth, { teamId: team.id, action: 'member.credentials_created', entityType: 'member', entityId: userId, targetUserId: userId, message: `Login “${u}” created for ${display}` });
    }
    return { id: userId, displayName: display, username: u };
  });
  return json({ member: out }, 201);
});
