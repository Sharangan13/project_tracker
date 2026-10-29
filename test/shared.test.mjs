import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModules, summarizeModules } from '../lib/shared.js';

test('parseModules: ranges, singles, lists, dedupe, reversed', () => {
  assert.deepEqual(parseModules('1 to 5').nums, [1, 2, 3, 4, 5]);
  assert.deepEqual(parseModules('5').nums, [5]);
  assert.deepEqual(parseModules('1, 3, 7').nums, [1, 3, 7]);
  assert.deepEqual(parseModules('2-4, 3').nums, [2, 3, 4]);
  assert.deepEqual(parseModules('4 to 2').nums, [2, 3, 4]);
  assert.deepEqual(parseModules('2–3').nums, [2, 3]);
});
test('parseModules: rejects bad input', () => {
  for (const bad of ['', 'abc', '1 to', '0', '0 to 3', '1 to 500', '1, x', '100000', '1 to 150, 300 to 400'])
    assert.ok(parseModules(bad).error, `should reject "${bad}"`);
});
test('summarizeModules', () => {
  assert.equal(summarizeModules([3]), 'Mod 3');
  assert.equal(summarizeModules([1, 2, 3]), 'Mod 1 to Mod 3');
  assert.equal(summarizeModules([1, 3]), 'Mod 1, Mod 3');
  assert.equal(summarizeModules([1, 3, 5, 7, 9, 11, 13, 15]), 'Mod 1, Mod 3, Mod 5, Mod 7, Mod 9, Mod 11 and 2 more');
});
