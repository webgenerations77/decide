// __tests__/usage-aggregate.mjs — run: node __tests__/usage-aggregate.mjs
import { aggregateUsage, rangeStartMs, summarizeDurations, summarizeGeneration } from '../lib/admin/usage.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);
const close = (a, b) => Math.abs(a - b) < 1e-9;

const rows = [
  { userId: 'u1', model: 'claude-haiku-4-5-20251001', route: 'scout',     inputTokens: 100, outputTokens: 50, requests: 0, estCost: 0.5 },
  { userId: 'u1', model: 'claude-sonnet-4-6',         route: 'synthesis', inputTokens: 200, outputTokens: 80, requests: 0, estCost: 1.0 },
  { userId: null, model: 'google-places',             route: 'places-nearby', inputTokens: 0, outputTokens: 0, requests: 3, estCost: 0.051 },
];
const agg = aggregateUsage(rows);

assert('totals sum requests', agg.totals.requests === 3);
assert('totals sum input tokens', agg.totals.inputTokens === 300);
assert('totals sum cost', close(agg.totals.estCost, 1.551));
assert('byModel splits sonnet', close(agg.byModel['claude-sonnet-4-6'].estCost, 1.0));
assert('byRoute splits scout', agg.byRoute['scout'].outputTokens === 50);
assert('byUser aggregates u1 cost', close(agg.byUser['u1'].estCost, 1.5));
assert('byUser aggregates u1 input tokens', agg.byUser['u1'].inputTokens === 300);
assert('byUser buckets null under anonymous', agg.byUser['anonymous'].requests === 3);
assert('byUser has exactly u1 and anonymous', JSON.stringify(Object.keys(agg.byUser).sort()) === JSON.stringify(['anonymous', 'u1']));

const now = 1_000_000_000_000;
assert('day range is 24h back', rangeStartMs('day', now) === now - 24 * 3600 * 1000);
assert('week range is 7d back', rangeStartMs('week', now) === now - 7 * 24 * 3600 * 1000);
assert('month range is 30d back', rangeStartMs('month', now) === now - 30 * 24 * 3600 * 1000);

console.log('generation timings — what the loading countdown is set from');
// Untimed rows are the norm (every places/anthropic row has no duration) and must not be
// counted as instant generations, which would drag the p80 to zero and set a countdown of 0s.
assert('rows without a duration are ignored, not counted as 0', agg.generation === null);

const timed = summarizeDurations([
  { durationMs: 30_000 }, { durationMs: 40_000 }, { durationMs: 45_000 },
  { durationMs: 50_000 }, { durationMs: 90_000 },
]);
assert('counts only timed runs', timed.n === 5);
assert('p50 is the middle run', timed.p50 === 45_000, String(timed.p50));
assert('p80 covers most runs', timed.p80 === 50_000, String(timed.p80));
assert('max is the slowest', timed.max === 90_000);
// p80 > p50 is the whole reason the dashboard tells you to read p80: the tail is where a
// countdown breaks its promise.
assert('p80 is never below p50', timed.p80 >= timed.p50);

assert('nothing timed yet reads as null, not a confident zero', summarizeDurations([]) === null);
assert('garbage durations are dropped',
  summarizeDurations([{ durationMs: 0 }, { durationMs: -5 }, { durationMs: null }, { durationMs: 'soon' }]) === null);
assert('a single run still produces an estimate', summarizeDurations([{ durationMs: 41_000 }]).p80 === 41_000);
assert('unsorted input is sorted before ranking',
  summarizeDurations([{ durationMs: 90_000 }, { durationMs: 10_000 }, { durationMs: 50_000 }]).p50 === 50_000);

console.log('generation funnel — making a dead request visible');
// The bug this exists for: a killed request writes nothing, so the only symptom was a MISSING
// synthesis row. started - completed is the number that never came back.
const funnel = summarizeGeneration([
  { route: 'itinerary', model: 'generation-start' },
  { route: 'itinerary', model: 'generation-start' },
  { route: 'itinerary', model: 'generation-start' },
  { route: 'itinerary', model: 'generation', durationMs: 41_000 },
  { route: 'synthesis', model: 'synthesis-deadline' },
  { route: 'synthesis', model: 'claude-sonnet-4-6', inputTokens: 10 },
]);
assert('counts starts', funnel.started === 3);
assert('counts completions', funnel.completed === 1);
assert('surfaces the ones that never came back', funnel.died === 2, String(funnel.died));
assert('counts deadline saves separately from deaths', funnel.deadline === 1);
assert('a normal synthesis row is not mistaken for either', funnel.completed === 1 && funnel.deadline === 1);

// A deadline hit still COMPLETES — it returns a fallback. So it must never be counted as a death,
// or the alarm cries wolf every time the safety net does its job.
const saved = summarizeGeneration([
  { route: 'itinerary', model: 'generation-start' },
  { route: 'synthesis', model: 'synthesis-deadline' },
  { route: 'itinerary', model: 'generation', durationMs: 52_000 },
]);
assert('a deadline save is not counted as a death', saved.died === 0, String(saved.died));
assert('and is still visible as a deadline hit', saved.deadline === 1);

assert('no generation rows at all reads as null, not a row of zeros',
  summarizeGeneration([{ route: 'scout', model: 'claude-haiku-4-5-20251001' }]) === null);
assert('funnel rides along on the aggregate', 'funnel' in agg);

console.log('live-research budget');
// Running out is invisible from the app — events.js returns [] and a plan just quietly loses its
// research. These assert the dashboard can show the ceiling BEFORE it is hit.
const { summarizeCredits } = await import('../lib/admin/firecrawlCredits.js');

const c = summarizeCredits({ remainingCredits: 891, planCredits: 1000 }, 14);
assert('reports the raw balance', c.remaining === 891 && c.total === 1000);
// Credits are an abstraction; plans are a decision.
assert('converts credits into plans left', c.plansLeft === Math.floor(891 / 14), String(c.plansLeft));
assert('reports how much is spent', c.usedPct === 11, String(c.usedPct));
assert('a healthy balance is not flagged low', c.low === false);

const low = summarizeCredits({ remainingCredits: 90, planCredits: 1000 }, 14);
assert('a nearly-spent balance IS flagged', low.low === true);
assert('and still says how many plans remain', low.plansLeft === 6, String(low.plansLeft));

// Both API shapes are in the wild (v1 snake_case, v2 camelCase) — reading only one would show
// "unavailable" forever after a version bump, which is the same silence this panel exists to end.
const snake = summarizeCredits({ remaining_credits: 500, plan_credits: 1000 }, 14);
assert('accepts the v1 snake_case shape', snake?.remaining === 500);

assert('a junk payload reads as unavailable, not as zero credits',
  summarizeCredits({}) === null && summarizeCredits(null) === null);
assert('a zero-credit plan does not divide by zero',
  summarizeCredits({ remainingCredits: 0, planCredits: 0 }) === null);
assert('a nonsense cost-per-plan still yields a number',
  Number.isFinite(summarizeCredits({ remainingCredits: 100, planCredits: 1000 }, 0).plansLeft));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
