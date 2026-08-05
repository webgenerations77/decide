// __tests__/smart-firecrawl.mjs — run: node __tests__/smart-firecrawl.mjs
import { fetchWithTimeout, firecrawlSearch } from '../lib/smart/firecrawl.js';
import { runWithUser, currentFirecrawlDegraded } from '../lib/usageContext.js';

let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

(async () => {
  // fetchWithTimeout aborts a hung request
  const orig = globalThis.fetch;
  globalThis.fetch = (_u, opts) => new Promise((_res, rej) => {
    opts.signal.addEventListener('abort', () => rej(new Error('aborted')));
  });
  let threw = false;
  try { await fetchWithTimeout('https://x', {}, 50); } catch { threw = true; }
  globalThis.fetch = orig;
  assert('fetchWithTimeout aborts after timeout', threw);

  // An exhausted quota (402) must be distinguishable from "found nothing" on THIS request, not
  // just in the monthly admin aggregate — that per-request signal is what the events.js quota bug
  // was missing.
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 402, json: async () => ({}) });
  await runWithUser('user-402', async () => {
    let searchThrew = false;
    try { await firecrawlSearch('q'); } catch { searchThrew = true; }
    assert('firecrawlSearch still throws on 402 (fails closed for the caller)', searchThrew);
    assert('402 marks the request as degraded by an exhausted quota', currentFirecrawlDegraded() === 'firecrawl-out-of-credits');
  });
  assert('degraded flag does not leak outside its request', currentFirecrawlDegraded() === null);

  globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
  await runWithUser('user-429', async () => {
    try { await firecrawlSearch('q'); } catch { /* expected */ }
    assert('429 marks the request as degraded by rate limiting', currentFirecrawlDegraded() === 'firecrawl-rate-limited');
  });

  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await runWithUser('user-500', async () => {
    try { await firecrawlSearch('q'); } catch { /* expected */ }
    assert('a one-off 500 does not mark the request as degraded', currentFirecrawlDegraded() === null);
  });
  globalThis.fetch = origFetch;

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
