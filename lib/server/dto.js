export const taskDto = (r) => ({
  id: r.id, num: r.num, label: r.label, note: r.note, status: r.status,
  assigneeId: r.assignee_id, assigneeName: r.assignee_name ?? null,
  createdAt: r.created_at, assignedAt: r.assigned_at, completedAt: r.completed_at,
});

export const TASK_SELECT = `select k.*, u.display_name as assignee_name
  from team_tasks k left join users u on u.id = k.assignee_id`;
