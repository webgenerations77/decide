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

// ─── Google Routes ────────────────────────────────────────────────────────────
// Uncosted until 2026-07-28: every Routes call logged $0.00, so the dashboard under-reported a
// real plan by ~20% (about $0.045 of a measured $0.22). A cost dashboard that quietly omits a
// fifth of the bill is worse than none, because it gets trusted.
assert('a Routes element is costed',
  close(computeCost({ model: 'google-routes-walk', requests: 1 }), PRICING.googleRoutesPerElement));
assert('every travel mode bills the same per element',
  close(computeCost({ model: 'google-routes-transit', requests: 2 }), 2 * PRICING.googleRoutesPerElement)
  && close(computeCost({ model: 'google-routes-drive', requests: 1 }), PRICING.googleRoutesPerElement));
// The observed shape of one real Brooklyn plan.
assert('a nine-element plan matches the SKU',
  close(computeCost({ model: 'google-routes-walk', requests: 9 }), 0.045));
// Routes is billed per element and lib/transport/routes.js sends one pair per request, so tokens
// must never leak into the calculation.
assert('token fields are ignored for Routes',
  close(computeCost({ model: 'google-routes-walk', requests: 1, inputTokens: 9999, outputTokens: 9999 }),
    PRICING.googleRoutesPerElement));
assert('an unfamiliar provider still costs 0 rather than guessing',
  computeCost({ model: 'some-new-api', requests: 5 }) === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
