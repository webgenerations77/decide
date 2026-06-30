// __tests__/admin-util.mjs — run: node __tests__/admin-util.mjs
import { isAdmin, getAdminRole } from '../utils/admin.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

assert('admin email is admin', isAdmin({ email: 'webgenerations77@gmail.com' }) === true);
assert('match is case-insensitive', isAdmin({ email: 'WebGenerations77@Gmail.com' }) === true);
assert('match trims whitespace', isAdmin({ email: '  webgenerations77@gmail.com ' }) === true);
assert('non-admin is false', isAdmin({ email: 'dwaynephil@gmail.com' }) === false);
assert('null user is false', isAdmin(null) === false);
assert('user without email is false', isAdmin({}) === false);
assert('getAdminRole returns admin for admin', getAdminRole({ email: 'webgenerations77@gmail.com' }) === 'admin');
assert('getAdminRole returns null for non-admin', getAdminRole({ email: 'x@y.com' }) === null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
