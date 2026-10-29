import { route, json } from '../../../../../../lib/server/http.js';
import { HttpError } from '../../../../../../lib/server/errors.js';
import { tx } from '../../../../../../lib/server/db.js';
import * as v from '../../../../../../lib/server/validate.js';
import { hashPassword } from '../../../../../../lib/server/security.js';
import { requireTeam, lockTeam } from '../../../../../../lib/server/access.js';
import { canResetPassword, leavesNoLeader, isLeader } from '../../../../../../lib/server/permissions.js';
import { logActivity } from '../../../../../../lib/server/activity.js';
import { summarizeModules } from '../../../../../../lib/shared.js';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LAST_LEADER = 'A team needs at least one active leader. Make someone else a leader first.';

async function otherActiveLeaders(c, teamId, userId) {
  return (await c.query(`select count(*)::int as n from team_memberships where team_id = $1 and role = 'leader' and is_active and user_id <> $2`, [teamId, userId])).rows[0].n;
}
// Puts the person's tasks back to "unassigned" and records it.
async function releaseTasks(c, auth, teamId, userId, who) {
  const { rows } = await c.query(
    `update team_tasks set assignee_id = null, status = 'pending', assigned_at = null, completed_at = null
      where team_id = $1 and assignee_id = $2 returning num`, [teamId, userId]);
  if (rows.length) {
    await logActivity(c, auth, { teamId, action: 'task.unassigned', entityType: 'task', targetUserId: userId,
      message: `${rows.length} task${rows.length > 1 ? 's' : ''} (${summarizeModules(rows.map((r) => r.num))}) returned to unassigned from ${who}`, details: { nums: rows.map((r) => r.num) } });
  }
}

// Leaders: change role, enable/disable access, or reset the password of a login the team created.
export const PATCH = route(async ({ auth, params, body }) => {
  const { team } = await requireTeam(auth, params.teamId, { leader: true });
  const userId = v.uuid(params.userId, 'Member');
  await tx(async (c) => {
    await lockTeam(c, team.id);
    const m = (await c.query(
      `select m.role, m.is_active, u.id, u.display_name, u.managed_by_team
         from team_memberships m join users u on u.id = m.user_id
        where m.team_id = $1 and m.user_id = $2 for update of m`, [team.id, userId])).rows[0];
    if (!m) throw new HttpError(404, 'Member not found.');
    const next = { role: m.role, is_active: m.is_active };
    if (body.role !== undefined) next.role = v.role(body.role);
    if (body.isActive !== undefined) next.is_active = v.bool(body.isActive, 'isActive');
    if (leavesNoLeader({ current: m, next, otherActiveLeaders: await otherActiveLeaders(c, team.id, userId) })) throw new HttpError(409, LAST_LEADER);

    if (next.role !== m.role) {
      await c.query('update team_memberships set role = $3 where team_id = $1 and user_id = $2', [team.id, userId, next.role]);
      await logActivity(c, auth, { teamId: team.id, action: 'member.role_changed', entityType: 'member', entityId: userId, targetUserId: userId,
        message: `${m.display_name} is now ${next.role === 'leader' ? 'a team leader' : 'a member'}`, details: { from: m.role, to: next.role } });
    }
    if (next.is_active !== m.is_active) {
      await c.query('update team_memberships set is_active = $3 where team_id = $1 and user_id = $2', [team.id, userId, next.is_active]);
      if (!next.is_active) {
        await releaseTasks(c, auth, team.id, userId, m.display_name);
        await c.query('delete from user_sessions where user_id = $1 and team_id = $2', [userId, team.id]);
      }
      await logActivity(c, auth, { teamId: team.id, action: 'member.access_changed', entityType: 'member', entityId: userId, targetUserId: userId,
        message: next.is_active ? `${m.display_name}’s access was restored` : `${m.display_name}’s access was disabled` });
    }
    if (body.password !== undefined) {
      const others = (await c.query('select count(*)::int as n from team_memberships where user_id = $1 and team_id <> $2 and is_active', [userId, team.id])).rows[0].n;
      const verdict = canResetPassword({ actorId: auth.user.id, target: m, teamId: team.id, otherActiveTeams: others });
      if (!verdict.ok) throw new HttpError(403, verdict.reason);
      const hash = await hashPassword(v.newPassword(body.password));
      await c.query('update users set password_hash = $1 where id = $2', [hash, userId]);
      await c.query('delete from user_sessions where user_id = $1', [userId]);
      await logActivity(c, auth, { teamId: team.id, action: 'member.password_reset', entityType: 'member', entityId: userId, targetUserId: userId, message: `Password reset for ${m.display_name}` });
    }
  });
  return json({ ok: true });
});

// Leaders remove anyone; any member may remove themselves (leave the team).
export const DELETE = route(async ({ auth, params }) => {
  const userId = v.uuid(params.userId, 'Member');
  const { team, role } = await requireTeam(auth, params.teamId);
  const self = userId === auth.user.id;
  if (!isLeader(role) && !self) throw new HttpError(403, 'Only team leaders can remove other members.');
  await tx(async (c) => {
    await lockTeam(c, team.id);
    const m = (await c.query(
      `select m.role, m.is_active, u.display_name, u.managed_by_team
         from team_memberships m join users u on u.id = m.user_id
        where m.team_id = $1 and m.user_id = $2 for update of m`, [team.id, userId])).rows[0];
    if (!m) throw new HttpError(404, 'Member not found.');
    if (leavesNoLeader({ current: m, next: { role: m.role, is_active: false }, otherActiveLeaders: await otherActiveLeaders(c, team.id, userId) })) throw new HttpError(409, LAST_LEADER);
    await releaseTasks(c, auth, team.id, userId, m.display_name);
    await c.query('delete from user_sessions where user_id = $1 and team_id = $2', [userId, team.id]);
    await c.query('delete from team_memberships where team_id = $1 and user_id = $2', [team.id, userId]);
    // A login this team created, with no other team, has no purpose once removed.
    let deletedLogin = false;
    if (m.managed_by_team === team.id && !self) {
      const left = (await c.query('select count(*)::int as n from team_memberships where user_id = $1', [userId])).rows[0].n;
      if (left === 0) { await c.query('delete from users where id = $1', [userId]); deletedLogin = true; }
    }
    await logActivity(c, auth, { teamId: team.id, action: 'member.removed', entityType: 'member', entityId: deletedLogin ? null : userId, targetUserId: deletedLogin ? null : userId,
      message: self ? `${m.display_name} left the team` : `${m.display_name} removed from the team${deletedLogin ? ' (login deleted)' : ''}`, details: { deletedLogin } });
  });
  return json({ ok: true });
});
