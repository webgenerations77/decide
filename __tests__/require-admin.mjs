// __tests__/require-admin.mjs — run: node __tests__/require-admin.mjs
import { extractBearer, decideAdmin } from '../lib/admin/requireAdmin.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

assert('extracts token from Bearer header', extractBearer('Bearer abc.def') === 'abc.def');
assert('case-insensitive scheme', extractBearer('bearer xyz') === 'xyz');
assert('returns null for missing header', extractBearer(undefined) === null);
assert('returns null for non-bearer', extractBearer('Basic abc') === null);

assert('admin token ok', decideAdmin({ email: 'webgenerations77@gmail.com' }).ok === true);
const notAdmin = decideAdmin({ email: 'someone@else.com' });
assert('non-admin denied 403', notAdmin.ok === false && notAdmin.status === 403);
const noEmail = decideAdmin({});
assert('no email denied 403', noEmail.ok === false && noEmail.status === 403);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
