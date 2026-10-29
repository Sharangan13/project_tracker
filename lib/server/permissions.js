// Role-based authorization rules, kept pure so they can be unit-tested.

export const isLeader = (role) => role === 'leader';

// What may `role`/`userId` do to a task that currently has `task.assignee_id`?
export function taskPermissions(role, userId, task) {
  const leader = isLeader(role);
  const own = !!task.assignee_id && task.assignee_id === userId;
  return {
    rename: leader,
    assign: leader,
    remove: leader,
    status: leader || own, // Pending <-> Completed
    note: leader || own,
  };
}

// A leader may reset a password only for logins their team created, only for someone else,
// and only while that login belongs to no other team (otherwise it would give access to the other team).
export function canResetPassword({ actorId, target, teamId, otherActiveTeams }) {
  if (target.id === actorId) return { ok: false, reason: 'Use “Change password” in your account settings.' };
  if (target.managed_by_team !== teamId) return { ok: false, reason: 'This is a personal account. Its owner must change the password themselves.' };
  if (otherActiveTeams > 0) return { ok: false, reason: 'This login also belongs to other teams, so only its owner can change the password.' };
  return { ok: true };
}

// Would this change leave the team with no active leader?
export function leavesNoLeader({ current, next, otherActiveLeaders }) {
  const wasActiveLeader = current.role === 'leader' && current.is_active;
  const stillActiveLeader = next.role === 'leader' && next.is_active;
  return wasActiveLeader && !stillActiveLeader && otherActiveLeaders === 0;
}
