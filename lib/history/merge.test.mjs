import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeById } from './merge.js';

test('mergeById unions by id, newer stamp wins (no clearedAt)', () => {
  const local = [{ id: 'a', timestamp: 1, updatedAt: 5 }];
  const remote = [{ id: 'a', timestamp: 1, updatedAt: 3 }, { id: 'b', timestamp: 2 }];
  const out = mergeById(local, remote);
  assert.equal(out.length, 2);
  assert.equal(out.find((x) => x.id === 'a').updatedAt, 5); // local newer wins
});

test('mergeById default clearedAt=0 drops nothing (backward compatible)', () => {
  const out = mergeById([{ id: 'a', timestamp: 10 }], [{ id: 'b', timestamp: 20 }]);
  assert.deepEqual(out.map((x) => x.id), ['b', 'a']);
});

test('mergeById drops items with stamp < clearedAt, keeps >=', () => {
  const items = [
    { id: 'old', timestamp: 100 },
    { id: 'boundary', timestamp: 200 },
    { id: 'new', timestamp: 300 },
  ];
  const out = mergeById(items, [], 200);
  assert.deepEqual(out.map((x) => x.id).sort(), ['boundary', 'new']); // old (100<200) dropped, boundary (200>=200) kept
});

test('mergeById uses updatedAt over timestamp for the cut', () => {
  const out = mergeById([{ id: 'a', timestamp: 100, updatedAt: 500 }], [], 200);
  assert.equal(out.length, 1); // stamp=500 >= 200, survives despite timestamp 100
});

test('mergeById resurrection scenario: stale local + empty remote + clearedAt => empty', () => {
  const staleLocal = [{ id: 'x', timestamp: 50 }, { id: 'y', timestamp: 60 }];
  const out = mergeById(staleLocal, [], 100);
  assert.deepEqual(out, []);
});
