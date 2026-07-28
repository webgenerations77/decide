// __tests__/trip-review.mjs — run: node __tests__/trip-review.mjs
//
// The review loop's judgement calls. Each of these is a way to get it subtly wrong in a way you
// would hear about from a user rather than from a crash: asking before the day has happened,
// asking again about something already answered, paying out enough to be farmed, or breaching
// Google's review-gating policy.

import {
  isTripOver, isReviewed, reviewableTrips, rewardForReview, googleReviewUrl,
  tripsToPrompt, REVIEW_REWARD, MAX_DAILY_REVIEW_BONUS, MAX_TRIP_PROMPTS, REVIEW_MAX_AGE_DAYS,
} from '../lib/tripReview.js';

let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const DAY = 24 * 3600 * 1000;
const now = new Date('2026-07-28T18:00:00').getTime(); // 6pm on the 28th, local

console.log('never ask about a day that has not finished');
assert('yesterday is reviewable', isTripOver({ tripDate: '2026-07-27' }, now));
// The one that matters: a plan MADE today for Saturday must not be asked about on Tuesday.
assert('a future trip is not', isTripOver({ tripDate: '2026-08-01' }, now) === false);
// 6pm on the day itself — they may still be at stop four.
assert('today is not, even in the evening', isTripOver({ tripDate: '2026-07-28' }, now) === false,
  'asking mid-trip reads as not paying attention');
assert('the day rolls over at midnight, not 24h later',
  isTripOver({ tripDate: '2026-07-27' }, new Date('2026-07-28T00:30:00').getTime()));

// Entries saved before tripDate existed fall back to when the plan was made.
assert('a legacy entry falls back to its timestamp',
  isTripOver({ timestamp: new Date('2026-07-26T11:00:00').getTime() }, now));
assert('a dateless entry is never prompted', isTripOver({}, now) === false);
assert('junk dates are never prompted', isTripOver({ tripDate: 'whenever' }, now) === false);
assert('no entry at all is safe', isTripOver(null, now) === false);

console.log('\nnever ask twice');
assert('an unreviewed trip counts', isReviewed({ feedback: null }) === false);
assert('a thumbs-up counts as reviewed', isReviewed({ feedback: 'up' }));
assert('a thumbs-down counts as reviewed too', isReviewed({ feedback: 'down' }),
  'a negative review is still a review — asking again would be nagging');

const trips = [
  { id: 'a', tripDate: '2026-07-26', feedback: null },      // past, unreviewed  → ask
  { id: 'b', tripDate: '2026-07-25', feedback: 'up' },      // past, reviewed    → done
  { id: 'c', tripDate: '2026-08-05', feedback: null },      // future            → too early
  { id: 'd', tripDate: '2026-07-28', feedback: null },      // today             → too early
];
const askable = reviewableTrips(trips, now).map((t) => t.id);
assert('only finished, unanswered trips are prompted',
  JSON.stringify(askable) === JSON.stringify(['a']), JSON.stringify(askable));
assert('an empty history prompts nothing', reviewableTrips([], now).length === 0);
assert('junk input is safe', reviewableTrips(null, now).length === 0);

console.log('\nask about a couple, not a backlog');
// Found on real data: 25 finished, unreviewed trips all qualified at once and turned the history
// screen into a wall of identical asks. Correct by the rules, awful to look at.
const backlog = Array.from({ length: 25 }, (_, i) => ({
  id: `t${i}`,
  tripDate: new Date(now - (i + 1) * DAY).toISOString().slice(0, 10),
  feedback: null,
}));
const prompts = tripsToPrompt(backlog, now);
assert('a long backlog does not become a wall of prompts',
  prompts.size === MAX_TRIP_PROMPTS, String(prompts.size));
assert('it asks about the FRESHEST trips, not the oldest',
  prompts.has('t0') && prompts.has('t1'), [...prompts].join(','));

// A review is only as good as the memory behind it; a guess is worse than silence because it
// feeds the avoid list a place they never really objected to.
const stale = [{ id: 'old', tripDate: new Date(now - (REVIEW_MAX_AGE_DAYS + 5) * DAY).toISOString().slice(0, 10), feedback: null }];
assert('a trip too old to remember is not asked about', tripsToPrompt(stale, now).size === 0);

// Answering one should surface the next, so a motivated traveller can still work through them.
const afterOne = tripsToPrompt(backlog.map((t) => (t.id === 't0' ? { ...t, feedback: 'up' } : t)), now);
assert('answering one surfaces the next', afterOne.has('t2') && !afterOne.has('t0'), [...afterOne].join(','));

assert('nothing to ask about is safe', tripsToPrompt([], now).size === 0);
assert('junk input is safe', tripsToPrompt(null, now).size === 0);
assert('an entry with no id is never prompted',
  tripsToPrompt([{ tripDate: '2026-07-26', feedback: null }], now).size === 0);

console.log('\nthe reward is a nudge, not a currency');
assert('a first review pays', rewardForReview(0) === REVIEW_REWARD);
assert('it stops at the daily cap', rewardForReview(MAX_DAILY_REVIEW_BONUS) === 0);
// Someone sitting on a month of history should not be able to mint a pile of decisions.
assert('a backlog of old trips cannot be farmed',
  rewardForReview(MAX_DAILY_REVIEW_BONUS - 1) + rewardForReview(MAX_DAILY_REVIEW_BONUS) <= REVIEW_REWARD);
assert('the cap is never exceeded by a partial grant',
  rewardForReview(MAX_DAILY_REVIEW_BONUS - 1) <= REVIEW_REWARD);
assert('a nonsense balance does not pay out extra', rewardForReview(-99) <= REVIEW_REWARD);
assert('a nonsense balance does not go negative', rewardForReview('lots') >= 0);

console.log('\nGoogle hand-off — the only legitimate shape');
const url = googleReviewUrl('ChIJrTLr-GyuEmsRBfy61i59si0');
assert('builds a composer link', url === 'https://search.google.com/local/writereview?placeid=ChIJrTLr-GyuEmsRBfy61i59si0', String(url));
// We cannot post on someone's behalf — Places is read-only for reviews and Google requires the
// review to come from the person's own account. A deep link is the whole of what is allowed.
assert('it is a link, not a submission', /writereview\?placeid=/.test(url) && !/POST|body/i.test(url));
// Synthetic ids do not exist on Google's side; linking them opens a broken dialog.
assert('fallback stops get no link', googleReviewUrl('fallback_food_2') === null);
assert('find-derived stops get no link', googleReviewUrl('find_old-pro-golf') === null);
assert('demo stops get no link', googleReviewUrl('demo_1') === null);
assert('missing id is safe', googleReviewUrl(null) === null && googleReviewUrl('') === null);
assert('a place id is escaped', googleReviewUrl('a b&c').includes('a%20b%26c'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
