// __tests__/roles-resolve.mjs — run: node __tests__/roles-resolve.mjs
// resolveRole lives in a RN-free module so this test runs under plain node
// (services/rolesService.js imports ./firebase → react-native, which would crash node).
import { resolveRole } from '../utils/resolveRole.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const map = { 'dwaynephil@gmail.com': 'beta_tester' };

assert('firestore role wins when present',
  resolveRole({ firestoreRole: 'beta_tester', fallbackMap: {}, email: 'a@b.com' }) === 'beta_tester');
assert('firestore null (explicit revoke) wins over map',
  resolveRole({ firestoreRole: null, fallbackMap: map, email: 'dwaynephil@gmail.com', hasDoc: true }) === null);
assert('falls back to map when no firestore doc',
  resolveRole({ firestoreRole: undefined, fallbackMap: map, email: 'dwaynephil@gmail.com', hasDoc: false }) === 'beta_tester');
assert('returns null when neither present',
  resolveRole({ firestoreRole: undefined, fallbackMap: map, email: 'nobody@x.com', hasDoc: false }) === null);
assert('email match is case-insensitive in fallback',
  resolveRole({ firestoreRole: undefined, fallbackMap: map, email: 'DwaynePhil@Gmail.com', hasDoc: false }) === 'beta_tester');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
