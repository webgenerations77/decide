// __tests__/feedback-context.mjs — run: node __tests__/feedback-context.mjs
//
// Guards the loop that makes Decide learn. dislikedPlaces becomes a HARD AVOID instruction in the
// synthesis prompt, so anything landing there will not be offered again.
//
// THE BUG THIS EXISTS FOR: per-stop rejections captured by StopCard's swap flow were written to
// `@decide/feedback_*` and read by nothing. plan.js built its avoid list from two other keys
// entirely, so the most specific signal the app collects — a named place plus the traveller's own
// words — was discarded on every swap. Two docs asserted the wiring existed; the code never did.
// A silent gap like that is exactly what a test over the merge would have caught.

import { buildFeedbackContext } from '../lib/feedbackContext.js';

let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

console.log('every source reaches the prompt');

const ctx = buildFeedbackContext({
  decisions: [
    { name: 'Loud Bar', feedback: 'down', feedbackReason: 'too loud' },
    { name: 'Good Cafe', feedback: 'up' },
  ],
  itineraries: [
    { feedback: 'down', feedbackReason: 'too much driving' },
  ],
  placeFeedback: [
    { placeName: 'Tourist Trap', feedback: 'down', reason: 'overpriced' },
    { placeName: 'Hidden Gem', feedback: 'up' },
  ],
});

assert('a decision rejection reaches dislikedPlaces', ctx.dislikedPlaces.includes('Loud Bar'));
// The regression that mattered: this source was invisible to the prompt entirely.
assert('a PER-STOP rejection reaches dislikedPlaces', ctx.dislikedPlaces.includes('Tourist Trap'),
  JSON.stringify(ctx.dislikedPlaces));
assert('a per-stop reason reaches dislikedReasons', ctx.dislikedReasons.includes('overpriced'),
  JSON.stringify(ctx.dislikedReasons));
assert('itinerary-level reasons still reach it', ctx.dislikedReasons.includes('too much driving'));
assert('decision reasons still reach it', ctx.dislikedReasons.includes('too loud'));
assert('likes come from both sources',
  ctx.likedPlaces.includes('Good Cafe') && ctx.likedPlaces.includes('Hidden Gem'));

console.log('\nnever avoid something that was not rejected');
assert('a liked place is never in the avoid list', !ctx.dislikedPlaces.includes('Good Cafe'));
assert('an unrated place is never in the avoid list',
  !ctx.dislikedPlaces.includes('Hidden Gem') && !ctx.dislikedPlaces.includes('Nowhere'));
const noSignal = buildFeedbackContext({ decisions: [{ name: 'Unrated' }], placeFeedback: [{ placeName: 'Also Unrated' }] });
assert('absence of feedback is not inferred as a dislike',
  noSignal.dislikedPlaces.length === 0, JSON.stringify(noSignal.dislikedPlaces));

console.log('\nshape and hygiene');
const dupes = buildFeedbackContext({
  decisions: [{ name: 'Same Place', feedback: 'down', feedbackReason: 'too far' }],
  placeFeedback: [{ placeName: 'Same Place', feedback: 'down', reason: 'too far' }],
});
assert('the same place rejected twice appears once', dupes.dislikedPlaces.length === 1);
assert('an identical reason appears once', dupes.dislikedReasons.length === 1);

const blanks = buildFeedbackContext({
  placeFeedback: [
    { placeName: '  ', feedback: 'down', reason: '   ' },
    { placeName: 'Real', feedback: 'down', reason: null },
  ],
});
assert('blank names are dropped', blanks.dislikedPlaces.length === 1 && blanks.dislikedPlaces[0] === 'Real');
assert('blank and null reasons are dropped', blanks.dislikedReasons.length === 0);

// Prompt budget: an unbounded avoid list would crowd out the places we are trying to recommend.
const many = buildFeedbackContext({
  placeFeedback: Array.from({ length: 60 }, (_, i) => ({ placeName: `P${i}`, feedback: 'down', reason: `r${i}` })),
});
assert('dislikedPlaces is capped', many.dislikedPlaces.length <= 20, String(many.dislikedPlaces.length));
assert('dislikedReasons is capped', many.dislikedReasons.length <= 12, String(many.dislikedReasons.length));

console.log('\nnever the reason a plan cannot start');
assert('no arguments is safe', buildFeedbackContext().dislikedPlaces.length === 0);
assert('junk shapes are safe',
  buildFeedbackContext({ decisions: null, itineraries: 'nope', placeFeedback: 7 }).dislikedReasons.length === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
