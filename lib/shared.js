// Pure helpers used by both the browser and the server. No imports, no side effects.

export const MAX_MODULES_PER_REQUEST = 200;
export const MAX_MODULE_NUMBER = 99999;

// "1 to 10", "5", "1, 3, 7", "2-4" -> { nums: [..sorted unique..] } or { error }
export function parseModules(input) {
  const parts = String(input ?? '').split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (!parts.length) return { error: 'Enter modules like “1 to 10”, “5”, or “1, 3, 7”.' };
  const out = new Set();
  for (const p of parts) {
    const range = p.match(/^(\d+)\s*(?:to|-|–)\s*(\d+)$/);
    let a, b;
    if (range) { a = +range[1]; b = +range[2]; if (a > b) [a, b] = [b, a]; }
    else if (/^\d+$/.test(p)) { a = b = +p; }
    else return { error: `“${p}” is not a valid module or range.` };
    if (a < 1 || b > MAX_MODULE_NUMBER) return { error: `Module numbers must be between 1 and ${MAX_MODULE_NUMBER}.` };
    if (b - a + 1 > MAX_MODULES_PER_REQUEST) return { error: `Create at most ${MAX_MODULES_PER_REQUEST} modules at a time.` };
    for (let i = a; i <= b; i++) out.add(i);
    if (out.size > MAX_MODULES_PER_REQUEST) return { error: `Create at most ${MAX_MODULES_PER_REQUEST} modules at a time.` };
  }
  return { nums: [...out].sort((x, y) => x - y) };
}

// [1,2,3,4] -> "Mod 1 to Mod 4";  [1,3,9] -> "Mod 1, Mod 3, Mod 9"
export function summarizeModules(nums) {
  const n = [...nums].sort((a, b) => a - b);
  if (!n.length) return '';
  if (n.length === 1) return `Mod ${n[0]}`;
  const contiguous = n.every((v, i) => i === 0 || v === n[i - 1] + 1);
  if (contiguous) return `Mod ${n[0]} to Mod ${n[n.length - 1]}`;
  const shown = n.slice(0, 6).map((v) => `Mod ${v}`).join(', ');
  return n.length > 6 ? `${shown} and ${n.length - 6} more` : shown;
}

export const ROLES = ['leader', 'member'];
export const STATUSES = ['pending', 'completed'];
export const ROLE_LABEL = { leader: 'Team leader', member: 'Member' };

// Activity action types, grouped for the filter drop-down.
export const ACTION_GROUPS = [
  ['Tasks', [
    ['task.created', 'Task created'],
    ['task.updated', 'Task edited'],
    ['task.deleted', 'Task deleted'],
    ['task.assigned', 'Task assigned'],
    ['task.unassigned', 'Task unassigned'],
    ['task.status_changed', 'Status changed'],
  ]],
  ['Members', [
    ['member.added', 'Member added'],
    ['member.removed', 'Member removed'],
    ['member.role_changed', 'Role changed'],
    ['member.access_changed', 'Access enabled / disabled'],
    ['member.credentials_created', 'Credentials created'],
    ['member.password_reset', 'Password reset'],
  ]],
  ['Team', [
    ['team.created', 'Team created'],
    ['team.updated', 'Team updated'],
  ]],
];
export const ACTION_LABEL = Object.fromEntries(ACTION_GROUPS.flatMap(([, list]) => list));
