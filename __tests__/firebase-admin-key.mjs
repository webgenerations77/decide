// __tests__/firebase-admin-key.mjs — run: node __tests__/firebase-admin-key.mjs
import { normalizePrivateKey } from '../lib/firebaseAdmin.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

assert('converts literal \\n to real newlines',
  normalizePrivateKey('-----BEGIN-----\\nabc\\n-----END-----') === '-----BEGIN-----\nabc\n-----END-----');
assert('leaves real newlines untouched',
  normalizePrivateKey('a\nb') === 'a\nb');
assert('handles undefined as empty string',
  normalizePrivateKey(undefined) === '');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
