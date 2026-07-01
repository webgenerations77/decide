// __tests__/usage-context.mjs — run: node __tests__/usage-context.mjs
import { runWithUser, currentUserId } from '../lib/usageContext.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

assert('null outside any context', currentUserId() === null);

const result = await runWithUser('user-123', async () => {
  assert('uid visible inside context', currentUserId() === 'user-123');
  await Promise.resolve();
  assert('uid survives await boundary', currentUserId() === 'user-123');
  return 'done';
});
assert('runWithUser returns fn result', result === 'done');
assert('context does not leak after return', currentUserId() === null);

await runWithUser(null, async () => {
  assert('null uid reads back as null', currentUserId() === null);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
