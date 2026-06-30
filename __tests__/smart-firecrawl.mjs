// __tests__/smart-firecrawl.mjs — run: node __tests__/smart-firecrawl.mjs
import { fetchWithTimeout } from '../lib/smart/firecrawl.js';

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

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
