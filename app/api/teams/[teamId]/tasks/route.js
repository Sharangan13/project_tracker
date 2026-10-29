import { route, json } from '../../../../../lib/server/http.js';
import { HttpError } from '../../../../../lib/server/errors.js';
import { query, tx } from '../../../../../lib/server/db.js';
import * as v from '../../../../../lib/server/validate.js';
import { requireTeam } from '../../../../../lib/server/access.js';
import { logActivity } from '../../../../../lib/server/activity.js';
import { taskDto, TASK_SELECT } from '../../../../../lib/server/dto.js';
import { parseModules, summarizeModules } from '../../../../../lib/shared.js';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Every team member can see the whole board.
export const GET = route(async ({ auth, params }) => {
  const { team } = await requireTeam(auth, params.teamId);
  const { rows } = await query(`${TASK_SELECT} where k.team_id = $1 order by k.num`, [team.id]);
  return json({ tasks: rows.map(taskDto) });
});

// Leaders create modules from a range ("1 to 10", "5", "1, 3, 7"), optionally assigning them straight away.
export const POST = route(async ({ auth, params, body }) => {
  const { team } = await requireTeam(auth, params.teamId, { leader: true });
  const parsed = parseModules(body.range);
  if (parsed.error) throw new HttpError(400, parsed.error);
  const noteText = v.note(body.note);
  const assigneeId = v.optionalUuid(body.assigneeId, 'Assignee');
  const result = await tx(async (c) => {
    let assigneeName = null;
    if (assigneeId) {
      const a = (await c.query(
        `select u.display_name from team_memberships m join users u on u.id = m.user_id
          where m.team_id = $1 and m.user_id = $2 and m.is_active`, [team.id, assigneeId])).rows[0];
      if (!a) throw new HttpError(400, 'That person is not an active member of this team.');
      assigneeName = a.display_name;
    }
    const { rows } = await c.query(
      `insert into team_tasks (team_id, num, label, note, assignee_id, assigned_at, created_by)
       select $1::uuid, s.n, 'Mod ' || s.n, $3::text, $4::uuid, case when $4::uuid is null then null else now() end, $5::uuid
         from unnest($2::int[]) as s(n)
       on conflict (team_id, num) do nothing
       returning num`,
      [team.id, parsed.nums, noteText, assigneeId, auth.user.id]);
    const created = rows.map((r) => r.num).sort((a, b) => a - b);
    if (created.length) {
      const what = `${created.length} task${created.length > 1 ? 's' : ''}: ${summarizeModules(created)}`;
      await logActivity(c, auth, { teamId: team.id, action: 'task.created', entityType: 'task', message: `Created ${what}`, details: { nums: created } });
      if (assigneeId) await logActivity(c, auth, { teamId: team.id, action: 'task.assigned', entityType: 'task', targetUserId: assigneeId, message: `${summarizeModules(created)} assigned to ${assigneeName}`, details: { nums: created } });
    }
    return { created: created.length, skipped: parsed.nums.length - created.length };
  });
  return json(result, 201);
});
