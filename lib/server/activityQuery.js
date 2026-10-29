// Builds the parameterised SQL for the activity history filters (pure; no DB access).
import { HttpError } from './errors.js';
import { uuid } from './validate.js';

const ACTION_RE = /^[a-z_]+(\.([a-z_]+|\*))?$/;
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);

function isoDate(v, what) {
  if (!v) return null;
  const t = Date.parse(String(v));
  if (Number.isNaN(t)) throw new HttpError(400, `${what} is not a valid date.`);
  return new Date(t).toISOString();
}

// allowedTeamIds: teams the caller may see (already scoped by session + membership).
export function buildActivityQuery({ allowedTeamIds, teamId, userId, action, from, to, q, limit, offset }) {
  if (!allowedTeamIds.length) return null;
  let teams = allowedTeamIds;
  if (teamId) {
    const id = uuid(teamId, 'Team');
    if (!allowedTeamIds.includes(id)) throw new HttpError(404, 'Team not found.');
    teams = [id];
  }
  const params = [teams];
  const where = ['a.team_id = any($1::uuid[])'];
  const add = (v) => { params.push(v); return `$${params.length}`; };

  if (userId) { const p = add(uuid(userId, 'User')); where.push(`(a.actor_id = ${p} or a.target_user_id = ${p})`); }
  if (action) {
    if (!ACTION_RE.test(action)) throw new HttpError(400, 'Unknown action type.');
    if (action.endsWith('.*')) where.push(`a.action like ${add(action.slice(0, -1) + '%')}`);
    else where.push(`a.action = ${add(action)}`);
  }
  const f = isoDate(from, 'Start date'); if (f) where.push(`a.created_at >= ${add(f)}`);
  const t = isoDate(to, 'End date'); if (t) where.push(`a.created_at <= ${add(t)}`);
  const text = String(q ?? '').trim().slice(0, 100);
  if (text) where.push(`(a.message ilike ${add('%' + escapeLike(text) + '%')} or a.actor_name ilike ${add('%' + escapeLike(text) + '%')})`);

  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const sql = `select a.id, a.team_id, t.name as team_name, a.actor_id, a.actor_name, a.action, a.entity_type,
       a.target_user_id, a.message, a.created_at
  from activity_logs a
  left join teams t on t.id = a.team_id
 where ${where.join(' and ')}
 order by a.created_at desc, a.id desc
 limit ${lim + 1} offset ${off}`;
  return { sql, params, limit: lim };
}
