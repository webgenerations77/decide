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

// ─── clearedAt: the cross-device delete high-water mark ───────────────────────
// This is how "Clear History" survives a second device. It had NO coverage, which is a bad place
// for a blind spot: the two ways it fails are a traveller's cleared history reappearing, and live
// history being deleted. CLAUDE.md also claimed the whole mechanism did not exist.
console.log('\nclearedAt — cross-device delete');

const CLEAR = 1000;

// The core job: a stale device pushes back items the traveller already cleared.
assert('an item older than the clear is dropped',
  mergeById([], [{ id: 'old', timestamp: 500 }], CLEAR).length === 0);
assert('a stale device cannot resurrect cleared history',
  mergeById([{ id: 'old', timestamp: 999 }], [{ id: 'old', timestamp: 999 }], CLEAR).length === 0);

// And the opposite failure, which is worse: losing something the traveller still has.
assert('an item newer than the clear survives',
  mergeById([], [{ id: 'new', timestamp: 1500 }], CLEAR).length === 1);
assert('a plan made right after clearing is kept',
  mergeById([{ id: 'fresh', timestamp: CLEAR + 1 }], [], CLEAR)[0]?.id === 'fresh');

// updatedAt is the stamp when present, so an old trip REVIEWED after the clear is a deliberate
// touch and is kept — losing it would silently discard the review the traveller just wrote.
assert('an old item edited after the clear is kept',
  mergeById([{ id: 'reviewed', timestamp: 200, updatedAt: CLEAR + 50 }], [], CLEAR).length === 1);

// Boundary: the mark is exclusive, so an item stamped exactly at the clear survives.
assert('an item stamped exactly at the clear survives',
  mergeById([{ id: 'edge', timestamp: CLEAR }], [], CLEAR).length === 1);

// ⚠ The safety property. clearUserHistory treats a falsy cutoff as a no-op precisely so a
// bodyless DELETE cannot wipe an account; merge must agree, or a missing/0 mark would drop
// everything client-side instead.
assert('no clear mark keeps everything', mergeById([{ id: 'a', timestamp: 1 }], []).length === 1);
assert('a zero clear mark keeps everything',
  mergeById([{ id: 'a', timestamp: 1 }], [], 0).length === 1);
assert('an undefined clear mark keeps everything',
  mergeById([{ id: 'a', timestamp: 1 }], [], undefined).length === 1);

// Mixed, which is the real-world shape after one device clears and another syncs late.
const mixed = mergeById(
  [{ id: 'keep', timestamp: 2000 }, { id: 'gone', timestamp: 300 }],
  [{ id: 'gone', timestamp: 300 }, { id: 'alsoKeep', timestamp: 1200 }],
  CLEAR,
);
assert('only pre-clear items are dropped from a mixed sync',
  mixed.length === 2 && mixed.every((e) => e.id !== 'gone'), mixed.map((e) => e.id).join(','));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
