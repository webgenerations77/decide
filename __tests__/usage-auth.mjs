// __tests__/usage-auth.mjs — run: node __tests__/usage-auth.mjs
import { getUidFromAuth } from '../lib/admin/auth.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

assert('null for undefined header', (await getUidFromAuth(undefined)) === null);
assert('null for null header', (await getUidFromAuth(null)) === null);
assert('null for empty header', (await getUidFromAuth('')) === null);
assert('null for non-bearer header', (await getUidFromAuth('NotBearer xyz')) === null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
