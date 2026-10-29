import test from 'node:test';
import assert from 'node:assert/strict';
import { buildActivityQuery } from '../lib/server/activityQuery.js';

const T1 = '11111111-1111-4111-8111-111111111111', T2 = '22222222-2222-4222-8222-222222222222';
const U = '33333333-3333-4333-8333-333333333333';

test('no accessible teams -> no query', () => {
  assert.equal(buildActivityQuery({ allowedTeamIds: [] }), null);
});
test('defaults: scoped to allowed teams, limit+1 for hasMore', () => {
  const q = buildActivityQuery({ allowedTeamIds: [T1, T2] });
  assert.deepEqual(q.params, [[T1, T2]]);
  assert.match(q.sql, /a\.team_id = any\(\$1::uuid\[\]\)/);
  assert.match(q.sql, /limit 51 offset 0/);
});
test('team filter cannot escape the allowed set', () => {
  assert.deepEqual(buildActivityQuery({ allowedTeamIds: [T1, T2], teamId: T2 }).params[0], [T2]);
  assert.throws(() => buildActivityQuery({ allowedTeamIds: [T1], teamId: T2 }), /Team not found/);
});
test('all filters become bound parameters (no string interpolation of values)', () => {
  const q = buildActivityQuery({ allowedTeamIds: [T1], userId: U, action: 'task.*', from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z', q: '50%_off', limit: 10, offset: 20 });
  assert.equal(q.params.length, 7);
  assert.equal(q.params[2], 'task.%');
  assert.equal(q.params[5], '%50\\%\\_off%');
  assert.ok(!q.sql.includes('50%') && !q.sql.includes(U));
  assert.match(q.sql, /limit 11 offset 20/);
});
test('exact action filter and injection attempts are rejected', () => {
  assert.equal(buildActivityQuery({ allowedTeamIds: [T1], action: 'task.assigned' }).params[1], 'task.assigned');
  assert.throws(() => buildActivityQuery({ allowedTeamIds: [T1], action: "x'; drop table users;--" }), /Unknown action/);
  assert.throws(() => buildActivityQuery({ allowedTeamIds: [T1], from: 'not-a-date' }), /valid date/);
  assert.throws(() => buildActivityQuery({ allowedTeamIds: [T1], userId: "1 or 1=1" }), /not found/);
});
test('limit is clamped', () => {
  assert.match(buildActivityQuery({ allowedTeamIds: [T1], limit: 99999 }).sql, /limit 201/);
  assert.match(buildActivityQuery({ allowedTeamIds: [T1], limit: -5 }).sql, /limit 2 /);
});
