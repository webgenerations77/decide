// __tests__/api-quota.mjs — run: node __tests__/api-quota.mjs
//
// The server-side abuse ceiling. These cases exist because the endpoint was open to the internet
// until 2026-07-29 and the only cap lived in the client's AsyncStorage.
import { evaluateQuota, isAdminEmail, QUOTA_LIMITS } from '../lib/apiQuota.js';

let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const NOW = 1_800_000_000_000;
const MONTH = '2026-07';
const HOUR = 3600000;
const ev = (cur, weight = 1, now = NOW) => evaluateQuota({ cur, now, month: MONTH, weight });

console.log('fresh account');
assert('first plan is allowed', ev({}).allowed === true);
assert('first plan counts as 1', ev({}).plans === 1);
assert('first plan opens the burst window at now', ev({}).next.hourStart === NOW);
assert('first plan stamps the month', ev({}).next.month === MONTH);

console.log('monthly ceiling');
const atCeiling = { month: MONTH, plans: QUOTA_LIMITS.PLAN_CEILING_PER_MONTH, hourStart: NOW, hourCount: 1 };
assert('a plan at the ceiling is refused', ev(atCeiling).allowed === false);
assert('refusal names the monthly reason', ev(atCeiling).reason === 'monthly');
assert('one below the ceiling still passes', ev({ ...atCeiling, plans: QUOTA_LIMITS.PLAN_CEILING_PER_MONTH - 1 }).allowed === true);
// The whole point of the split from the client's 3/month cap: a free user can legitimately reach
// 6 with the review bonus, so the server must not be the thing that stops them at 3.
assert('a 6th plan (3 free + 3 review bonus) is NOT refused', ev({ month: MONTH, plans: 5, hourStart: NOW, hourCount: 1 }).allowed === true);

console.log('month rollover');
assert('last month\'s spent plans do not carry over', ev({ month: '2026-06', plans: 99, hourStart: NOW, hourCount: 1 }).allowed === true);
assert('rollover resets the count to this request only', ev({ month: '2026-06', plans: 99, hourStart: NOW, hourCount: 1 }).plans === 1);

console.log('hourly burst');
const burst = { month: MONTH, plans: 0, hourStart: NOW, hourCount: QUOTA_LIMITS.BURST_PER_HOUR };
assert('the burst cap refuses', ev(burst).allowed === false);
assert('refusal names the burst reason', ev(burst).reason === 'burst');
assert('burst refusal carries a positive retryAfter', ev(burst).retryAfter > 0);
assert('retryAfter is under an hour', ev(burst).retryAfter <= 3600);
assert('burst applies to weight-0 calls too', ev(burst, 0).allowed === false);
assert('an expired window lets the next call through', ev({ ...burst, hourStart: NOW - HOUR - 1 }).allowed === true);
assert('an expired window restarts the counter at 1', ev({ ...burst, hourStart: NOW - HOUR - 1 }).next.hourCount === 1);
assert('a live window keeps its original start', ev({ month: MONTH, plans: 0, hourStart: NOW - 60_000, hourCount: 1 }).next.hourStart === NOW - 60_000);

console.log('weight 0 — swap, clarify, transport-leg');
const nearCeiling = { month: MONTH, plans: QUOTA_LIMITS.PLAN_CEILING_PER_MONTH, hourStart: NOW, hourCount: 1 };
assert('weight 0 is allowed even at the monthly ceiling', ev(nearCeiling, 0).allowed === true);
assert('weight 0 does not increment the plan count', ev(nearCeiling, 0).next.plans === QUOTA_LIMITS.PLAN_CEILING_PER_MONTH);
assert('weight 0 DOES increment the burst count', ev(nearCeiling, 0).next.hourCount === 2);

console.log('malformed / hostile stored state');
assert('missing hourStart does not crash', ev({ month: MONTH, plans: 1 }).allowed === true);
assert('string hourStart is ignored, not trusted', ev({ month: MONTH, plans: 1, hourStart: 'nope', hourCount: 99 }).allowed === true);
assert('undefined doc is treated as fresh', evaluateQuota({ now: NOW, month: MONTH, weight: 1 }).allowed === true);

console.log('admin exemption');
assert('the admin email is exempt', isAdminEmail('webgenerations77@gmail.com') === true);
assert('exemption is case-insensitive', isAdminEmail('WebGenerations77@Gmail.com') === true);
assert('exemption trims whitespace', isAdminEmail('  webgenerations77@gmail.com  ') === true);
assert('a beta tester is NOT exempt', isAdminEmail('test@frank.com') === false);
assert('null email is not exempt', isAdminEmail(null) === false);
assert('undefined email is not exempt', isAdminEmail(undefined) === false);
assert('empty string is not exempt', isAdminEmail('') === false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
