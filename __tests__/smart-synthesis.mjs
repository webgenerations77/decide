// __tests__/smart-synthesis.mjs — run: node __tests__/smart-synthesis.mjs
import { buildSynthesisPrompt, validateStops } from '../lib/smart/synthesis.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const anchors = [{ find: { title: 'Old Pro Golf', lat: 38.4, lng: -75.05 }, rationale: 'mini golf icon' }];
const { system, user } = buildSynthesisPrompt({ places: { food: [], activity: [], shopping: [], outdoor: [] }, finds: [], anchors, ctx: { location: 'OC', prefs: {}, startTime: '11:00 AM', endTime: '8:00 PM' } });
assert('synthesis is Cheddar, opinionated', system.toLowerCase().includes('cheddar'));
assert('prompt injects the anchor', user.includes('Old Pro Golf'));

const stops = validateStops([
  { time: '11:00 AM', category: 'activity', name: 'X', place_id: 'find_old', lat: 38.4, lng: -75.05, reason: 'r', excitement_score: 90 },
  { name: 'no time' },
]);
assert('validateStops keeps complete stops', stops.length === 1 && stops[0].name === 'X');
assert('validateStops preserves provenance when present', validateStops([{ time: 't', category: 'activity', name: 'Y', place_id: 'find_y', lat: 1, lng: 2, reason: 'r', excitement_score: 50, provenance: { interest: 'pinball' } }])[0].provenance.interest === 'pinball');
const acStops = validateStops([
  { time: '1:00 PM', category: 'activity', name: 'Z', place_id: 'find_z', lat: 1, lng: 2, reason: 'r', excitement_score: 80, admission_cost: 'Free' },
  { time: '2:00 PM', category: 'food', name: 'W', place_id: 'find_w', lat: 1, lng: 2, reason: 'r', excitement_score: 70 },
]);
assert('validateStops preserves admission_cost when present', acStops[0].admission_cost === 'Free');
assert('validateStops sets admission_cost null when absent', acStops[1].admission_cost === null);

// ─── The synthesis deadline ───────────────────────────────────────────────────
// Synthesis is the only unbounded step inside Vercel's 60s ceiling, and the one that grows when
// live research succeeds — so the requests that died were the best-researched ones. These assert
// the deadline converts that into a fallback instead of a 504.
console.log('\nsynthesis deadline');
const { runSynthesis } = await import('../lib/smart/synthesis.js');
const { SYNTHESIS_BUDGET_MS, runSmartEngine } = await import('../lib/smart/index.js');

// Measured, not assumed: a real deadline run reported durationMs=50722 against a 50s budget, so
// everything after synthesis (routes, links, serialisation) costs well under a second. The upper
// bound here is what keeps a margin against Vercel's 60s kill.
assert('budget leaves room after synthesis inside a 60s function',
  SYNTHESIS_BUDGET_MS > 0 && SYNTHESIS_BUDGET_MS <= 56_000, String(SYNTHESIS_BUDGET_MS));
const { SKIP_VERIFY_AFTER_MS } = await import('../lib/smart/index.js');
assert('verification is abandoned well before the synthesis budget runs out',
  SKIP_VERIFY_AFTER_MS < SYNTHESIS_BUDGET_MS / 2, `${SKIP_VERIFY_AFTER_MS} vs ${SYNTHESIS_BUDGET_MS}`);

// Already out of budget: must not spend an expensive call it cannot use.
const t0 = Date.now();
const noBudget = await runSynthesis({
  places: { food: [], activity: [], shopping: [], outdoor: [] }, finds: [], anchors: [],
  ctx: { location: 'OC', prefs: {}, startTime: '11:00 AM', endTime: '8:00 PM' },
  deadlineAt: Date.now() - 1,
});
const elapsed = Date.now() - t0;
assert('an exhausted budget returns empty', Array.isArray(noBudget) && noBudget.length === 0);
// Bound is deliberately loose. A real Sonnet synthesis takes 20-40s, so anything in single-digit
// seconds proves the call was skipped — while leaving room for the first firebase-admin require
// (~0.5s) that logUsage drags in. An earlier 500ms bound was really timing that module load, and
// flaked accordingly: a test that fails for a reason it is not testing is worse than no test.
assert('and skips the API call entirely', elapsed < 5000, `${elapsed}ms`);

// An empty result is what the twins already treat as "use buildFallbackItinerary" — the point of
// returning [] rather than throwing is that this path already exists and is already tested.
const engineDeadline = await runSmartEngine(
  { ctx: { location: 'OC', prefs: {} }, places: { food: [{ name: 'a' }], activity: [], shopping: [], outdoor: [] }, startedAt: Date.now() - SYNTHESIS_BUDGET_MS - 1000 },
  {
    runScout: async () => [], runDiscovery: async () => [], runEvents: async () => [],
    annotateEventTimes: async () => {}, verifyEventTimes: async () => {},
    verifyVenueTimes: async () => ({ promotedFinds: [], removePlaceIds: new Set() }),
    pickAnchors: async () => [], applySunsetGuard: (s) => s,
    // If the deadline works, the real runSynthesis short-circuits before this would matter.
    runSynthesis: async ({ deadlineAt }) => {
      assert('engine passes an absolute deadline down to synthesis', Number.isFinite(deadlineAt));
      assert('and it is already in the past for a stale request', deadlineAt < Date.now());
      return [];
    },
  },
);
assert('a blown budget yields no itinerary, so the caller falls back',
  !engineDeadline.itinerary || engineDeadline.itinerary.length === 0);

// The healthy path must be untouched: no deadline supplied → behaves exactly as before.
let sawDeadline = 'unset';
await runSmartEngine(
  { ctx: { location: 'OC', prefs: {} }, places: { food: [{ name: 'a' }], activity: [], shopping: [], outdoor: [] } },
  {
    runScout: async () => [], runDiscovery: async () => [], runEvents: async () => [],
    annotateEventTimes: async () => {}, verifyEventTimes: async () => {},
    verifyVenueTimes: async () => ({ promotedFinds: [], removePlaceIds: new Set() }),
    pickAnchors: async () => [], applySunsetGuard: (s) => s,
    runSynthesis: async ({ deadlineAt }) => { sawDeadline = deadlineAt; return []; },
  },
);
assert('no startedAt means no deadline — unchanged behaviour for any other caller',
  sawDeadline === null, String(sawDeadline));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
