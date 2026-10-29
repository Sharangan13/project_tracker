import { route, json } from '../../../../../../lib/server/http.js';
import { HttpError } from '../../../../../../lib/server/errors.js';
import { tx } from '../../../../../../lib/server/db.js';
import * as v from '../../../../../../lib/server/validate.js';
import { requireTeam } from '../../../../../../lib/server/access.js';
import { taskPermissions } from '../../../../../../lib/server/permissions.js';
import { logActivity } from '../../../../../../lib/server/activity.js';
import { taskDto, TASK_SELECT } from '../../../../../../lib/server/dto.js';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const deny = (what) => new HttpError(403, `You are not allowed to ${what} this task.`);

// Leaders: edit anything. Members: change status and notes of tasks assigned to them.
export const PATCH = route(async ({ auth, params, body }) => {
  const { team, role } = await requireTeam(auth, params.teamId);
  const taskId = v.uuid(params.taskId, 'Task');
  const updated = await tx(async (c) => {
    const t = (await c.query('select * from team_tasks where id = $1 and team_id = $2 for update', [taskId, team.id])).rows[0];
    if (!t) throw new HttpError(404, 'Task not found.');
    const perm = taskPermissions(role, auth.user.id, t);
    if (has(body, 'label') && !perm.rename) throw deny('rename');
    if (has(body, 'assigneeId') && !perm.assign) throw deny('assign');
    if (has(body, 'status') && !perm.status) throw deny('change the status of');
    if (has(body, 'note') && !perm.note) throw deny('edit the notes of');

    const now = new Date();
    let { label, note, status, assignee_id: assignee, assigned_at: assignedAt, completed_at: completedAt } = t;
    const logs = [];
    const nameOf = async (id) => (id ? (await c.query('select display_name from users where id = $1', [id])).rows[0]?.display_name ?? 'a former member' : null);

    if (has(body, 'label')) {
      const next = v.taskLabel(body.label);
      if (next !== label) { logs.push({ action: 'task.updated', message: `${label} renamed to ${next}` }); label = next; }
    }
    if (has(body, 'note')) {
      const next = v.note(body.note);
      if (next !== note) { logs.push({ action: 'task.updated', message: `${label} notes updated` }); note = next; }
    }
    if (has(body, 'assigneeId')) {
      const next = v.optionalUuid(body.assigneeId, 'Assignee');
      if (next !== assignee) {
        const prev = await nameOf(assignee);
        if (next === null) {
          logs.push({ action: 'task.unassigned', message: `${label} unassigned${prev ? ` from ${prev}` : ''}`, target: assignee });
          assignee = null; status = 'pending'; assignedAt = null; completedAt = null;
        } else {
          const ok = (await c.query('select 1 from team_memberships where team_id = $1 and user_id = $2 and is_active', [team.id, next])).rowCount;
          if (!ok) throw new HttpError(400, 'That person is not an active member of this team.');
          const who = await nameOf(next);
          logs.push({ action: 'task.assigned', message: prev ? `${label} moved from ${prev} to ${who}` : `${label} assigned to ${who}`, target: next });
          assignee = next; status = 'pending'; assignedAt = now; completedAt = null;
        }
      }
    }
    if (has(body, 'status')) {
      const next = v.status(body.status);
      if (next !== status) {
        if (next === 'completed' && !assignee) throw new HttpError(400, 'Assign the task to someone before completing it.');
        status = next; completedAt = next === 'completed' ? now : null;
        logs.push({ action: 'task.status_changed', message: next === 'completed' ? `${label} marked completed` : `${label} reopened (pending)`, target: assignee });
      }
    }
    if (logs.length) {
      await c.query(
        'update team_tasks set label = $3, note = $4, assignee_id = $5, status = $6, assigned_at = $7, completed_at = $8 where id = $1 and team_id = $2',
        [taskId, team.id, label, note, assignee, status, assignedAt, completedAt]);
      for (const l of logs) {
        await logActivity(c, auth, { teamId: team.id, action: l.action, entityType: 'task', entityId: taskId, targetUserId: l.target ?? null, message: l.message, details: { num: t.num } });
      }
    }
    return (await c.query(`${TASK_SELECT} where k.id = $1`, [taskId])).rows[0];
  });
  return json({ task: taskDto(updated) });
});

export const DELETE = route(async ({ auth, params }) => {
  const { team } = await requireTeam(auth, params.teamId, { leader: true });
  const taskId = v.uuid(params.taskId, 'Task');
  await tx(async (c) => {
    const t = (await c.query('delete from team_tasks where id = $1 and team_id = $2 returning label, num', [taskId, team.id])).rows[0];
    if (!t) throw new HttpError(404, 'Task not found.');
    await logActivity(c, auth, { teamId: team.id, action: 'task.deleted', entityType: 'task', message: `${t.label} deleted`, details: { num: t.num } });
  });
  return json({ ok: true });
});
