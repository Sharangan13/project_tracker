import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from '../lib/server/validate.js';
import { HttpError } from '../lib/server/errors.js';
import { taskPermissions, canResetPassword, leavesNoLeader } from '../lib/server/permissions.js';

const throwsHttp = (fn, status) => assert.throws(fn, (e) => e instanceof HttpError && (!status || e.status === status));

test('username normalisation and rejection', () => {
  assert.equal(v.username('  Sarah.J_1 '), 'sarah.j_1');
  for (const b of ['ab', 'has space', 'x'.repeat(31), 'a@b.com', '', null, 'semi;colon']) throwsHttp(() => v.username(b), 400);
});
test('password rules', () => {
  assert.equal(v.newPassword('12345678'), '12345678');
  throwsHttp(() => v.newPassword('short'), 400);
  throwsHttp(() => v.newPassword('x'.repeat(129)), 400);
  throwsHttp(() => v.newPassword(12345678), 400);
});
test('uuid / team code / role / status / names', () => {
  assert.equal(v.uuid('3F2504E0-4F89-11D3-9A0C-0305E82C3301'), '3f2504e0-4f89-11d3-9a0c-0305e82c3301');
  throwsHttp(() => v.uuid("1' or '1'='1"), 404);
  assert.equal(v.normalizeTeamCode('abcd-2345'), 'ABCD2345');
  assert.equal(v.normalizeTeamCode('short'), null);
  assert.equal(v.role('leader'), 'leader'); throwsHttp(() => v.role('admin'), 400);
  assert.equal(v.status('completed'), 'completed'); throwsHttp(() => v.status('done'), 400);
  assert.equal(v.teamName('  My   Team '), 'My Team'); throwsHttp(() => v.teamName('a'), 400);
  throwsHttp(() => v.note('x'.repeat(501)), 400);
  assert.equal(v.optionalUuid(''), null);
});

const task = (assignee_id) => ({ assignee_id });
test('leader may do everything to any task', () => {
  const p = taskPermissions('leader', 'u1', task('u2'));
  assert.deepEqual(p, { rename: true, assign: true, remove: true, status: true, note: true });
});
test('member: only status+note on own tasks; nothing on others or unassigned', () => {
  assert.deepEqual(taskPermissions('member', 'u1', task('u1')), { rename: false, assign: false, remove: false, status: true, note: true });
  assert.deepEqual(taskPermissions('member', 'u1', task('u2')), { rename: false, assign: false, remove: false, status: false, note: false });
  assert.deepEqual(taskPermissions('member', 'u1', task(null)), { rename: false, assign: false, remove: false, status: false, note: false });
  assert.deepEqual(taskPermissions(undefined, 'u1', task('u1')).rename, false);
});
test('password reset rules', () => {
  const ok = { actorId: 'L', target: { id: 'M', managed_by_team: 'T' }, teamId: 'T', otherActiveTeams: 0 };
  assert.equal(canResetPassword(ok).ok, true);
  assert.equal(canResetPassword({ ...ok, target: { id: 'L', managed_by_team: 'T' } }).ok, false); // self
  assert.equal(canResetPassword({ ...ok, target: { id: 'M', managed_by_team: null } }).ok, false); // personal account
  assert.equal(canResetPassword({ ...ok, target: { id: 'M', managed_by_team: 'OTHER' } }).ok, false);
  assert.equal(canResetPassword({ ...ok, otherActiveTeams: 1 }).ok, false); // multi-team
});
test('last-leader guard', () => {
  const cur = { role: 'leader', is_active: true };
  assert.equal(leavesNoLeader({ current: cur, next: { role: 'member', is_active: true }, otherActiveLeaders: 0 }), true);
  assert.equal(leavesNoLeader({ current: cur, next: { role: 'leader', is_active: false }, otherActiveLeaders: 0 }), true);
  assert.equal(leavesNoLeader({ current: cur, next: { role: 'member', is_active: true }, otherActiveLeaders: 1 }), false);
  assert.equal(leavesNoLeader({ current: { role: 'member', is_active: true }, next: { role: 'member', is_active: false }, otherActiveLeaders: 0 }), false);
  assert.equal(leavesNoLeader({ current: cur, next: cur, otherActiveLeaders: 0 }), false);
});
