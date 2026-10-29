import { HttpError } from './errors.js';
import { query } from './db.js';
import { uuid } from './validate.js';
import { isLeader } from './permissions.js';

// Teams the caller can reach. Team-login sessions are pinned to their single team.
export async function listMyTeams(auth) {
  const { rows } = await query(
    `select t.id, t.name, t.code, m.role, t.created_at,
            (select count(*)::int from team_memberships x where x.team_id = t.id and x.is_active) as member_count,
            (select count(*)::int from team_tasks k where k.team_id = t.id) as task_count,
            (select count(*)::int from team_tasks k where k.team_id = t.id and k.status = 'completed') as completed_count,
            (select count(*)::int from team_tasks k where k.team_id = t.id and k.assignee_id = $1 and k.status = 'pending') as my_pending
       from team_memberships m
       join teams t on t.id = m.team_id
      where m.user_id = $1 and m.is_active and ($2::uuid is null or t.id = $2::uuid)
      order by lower(t.name)`,
    [auth.user.id, auth.teamId],
  );
  return rows.map((r) => ({
    id: r.id, name: r.name, code: r.code, role: r.role, createdAt: r.created_at,
    memberCount: r.member_count, taskCount: r.task_count, completedCount: r.completed_count, myPending: r.my_pending,
  }));
}

// Confirms the caller is an active member of the team (and a leader if required).
// Unknown teams and teams the caller does not belong to both give 404, so team ids can't be probed.
export async function requireTeam(auth, teamIdParam, { leader = false } = {}) {
  const teamId = uuid(teamIdParam, 'Team');
  if (auth.teamId && auth.teamId !== teamId) throw new HttpError(404, 'Team not found.');
  const { rows } = await query(
    `select t.id, t.name, t.code, t.created_by, m.role
       from team_memberships m join teams t on t.id = m.team_id
      where m.team_id = $1 and m.user_id = $2 and m.is_active`,
    [teamId, auth.user.id],
  );
  const r = rows[0];
  if (!r) throw new HttpError(404, 'Team not found.');
  if (leader && !isLeader(r.role)) throw new HttpError(403, 'Only team leaders can do this.');
  return { team: { id: r.id, name: r.name, code: r.code, createdBy: r.created_by }, role: r.role };
}

// Serialises membership changes within a team (used with the last-leader rule).
export const lockTeam = (client, teamId) => client.query('select id from teams where id = $1 for update', [teamId]);
