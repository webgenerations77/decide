// __tests__/history-merge.mjs — run: node __tests__/history-merge.mjs
import { mergeById } from '../lib/history/merge.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

// union: local-only + remote-only both survive
const u = mergeById([{ id: 'a', timestamp: 2 }], [{ id: 'b', timestamp: 1 }]);
assert('union keeps both ids', u.length === 2 && u.some(x => x.id === 'a') && u.some(x => x.id === 'b'));
assert('ordered by timestamp desc', u[0].id === 'a' && u[1].id === 'b');

// conflict: newer updatedAt wins
const c1 = mergeById(
  [{ id: 'a', timestamp: 1, updatedAt: 500, v: 'local' }],
  [{ id: 'a', timestamp: 1, updatedAt: 100, v: 'remote' }],
);
assert('newer updatedAt wins', c1.length === 1 && c1[0].v === 'local');

// conflict: falls back to timestamp when no updatedAt
const c2 = mergeById(
  [{ id: 'a', timestamp: 1, v: 'local-old' }],
  [{ id: 'a', timestamp: 9, v: 'remote-new' }],
);
assert('timestamp fallback picks newer', c2[0].v === 'remote-new');

// skips junk
const s = mergeById([null, { timestamp: 1 }, { id: 'x', timestamp: 3 }], []);
assert('skips null / id-less items', s.length === 1 && s[0].id === 'x');

// empty inputs
assert('empty both → empty', mergeById().length === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
