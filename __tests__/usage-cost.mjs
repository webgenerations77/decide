// __tests__/usage-cost.mjs — run: node __tests__/usage-cost.mjs
import { computeCost } from '../lib/usageLog.js';
import { PRICING } from '../constants/pricing.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);
const close = (a, b) => Math.abs(a - b) < 1e-9;

const h = PRICING.anthropic['claude-haiku-4-5-20251001'];
const expectedHaiku = (1_000_000 / 1e6) * h.inPerMTok + (500_000 / 1e6) * h.outPerMTok;
assert('haiku token cost',
  close(computeCost({ model: 'claude-haiku-4-5-20251001', inputTokens: 1_000_000, outputTokens: 500_000 }), expectedHaiku));

assert('places request cost',
  close(computeCost({ model: 'google-places', requests: 10 }), 10 * PRICING.googlePlacesPerRequest));

assert('unknown model costs 0', computeCost({ model: 'nope', inputTokens: 100, outputTokens: 100 }) === 0);
assert('missing fields default to 0', computeCost({ model: 'claude-sonnet-4-6' }) === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
