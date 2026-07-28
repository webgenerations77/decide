// __tests__/usage-aggregate.mjs — run: node __tests__/usage-aggregate.mjs
import { aggregateUsage, rangeStartMs, summarizeDurations } from '../lib/admin/usage.js';
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
