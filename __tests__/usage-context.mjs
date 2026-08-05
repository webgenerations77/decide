// __tests__/usage-context.mjs — run: node __tests__/usage-context.mjs
import { runWithUser, currentUserId, markFirecrawlDegraded, currentFirecrawlDegraded } from '../lib/usageContext.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

assert('null outside any context', currentUserId() === null);
assert('firecrawl degraded flag is null outside any context', currentFirecrawlDegraded() === null);
assert('marking degraded outside any context is a harmless no-op', (markFirecrawlDegraded('x'), currentFirecrawlDegraded() === null));

const result = await runWithUser('user-123', async () => {
  assert('uid visible inside context', currentUserId() === 'user-123');
  await Promise.resolve();
  assert('uid survives await boundary', currentUserId() === 'user-123');
  assert('firecrawl degraded flag starts null inside a fresh request', currentFirecrawlDegraded() === null);
  markFirecrawlDegraded('firecrawl-out-of-credits');
  assert('marking degraded is visible within the same request', currentFirecrawlDegraded() === 'firecrawl-out-of-credits');
  return 'done';
});
assert('runWithUser returns fn result', result === 'done');
assert('context does not leak after return', currentUserId() === null);
assert('degraded flag does not leak after return', currentFirecrawlDegraded() === null);

await runWithUser('user-456', async () => {
  assert('a new request starts with a clean degraded flag, even after a prior request set it', currentFirecrawlDegraded() === null);
});

await runWithUser(null, async () => {
  assert('null uid reads back as null', currentUserId() === null);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
