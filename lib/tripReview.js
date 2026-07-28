// When a finished trip is worth asking about, and what a review is worth.
//
// Pure so the rules are examinable. The whole feature turns on judgement calls that are easy to
// get subtly wrong — asking too early, asking twice, or paying out enough to be farmed — and
// none of those are things you want to discover from a support message.

/** Bonus decisions granted for reviewing one trip. */
export const REVIEW_REWARD = 1;

/**
 * Most a traveller can earn back in a day, however many old trips they review.
 *
 * Without this, someone sitting on a month of unreviewed history could mint a large pile of
 * decisions in one sitting. The cap keeps the reward a nudge rather than a currency, and keeps
 * the free tier meaning roughly what it says.
 */
export const MAX_DAILY_REVIEW_BONUS = 3;

/**
 * Is this trip over?
 *
 * Uses the trip's own date, NOT when the plan was made — a plan built on Monday for Saturday is
 * not reviewable on Tuesday, and asking "how was it?" about a day that has not happened is the
 * kind of small wrongness that makes an app feel like it is not paying attention.
 *
 * `tripDate` was added to saved itineraries alongside this feature, so older entries do not have
 * it. They fall back to `timestamp` (when the plan was made), which for the overwhelming majority
 * of historical plans — made for the same day — is the same answer.
 */
/**
 * ⚠ A date-only string is parsed as UTC by `new Date()`, which shifts it BACKWARDS a day in every
 * western timezone: `new Date('2026-07-28')` is 8pm on the 27th in EDT. Left alone, that makes a
 * trip look finished while the traveller is still on it — the app would ask "how was it?" at
 * lunchtime. Date-only strings are therefore built as LOCAL dates; anything else (an epoch, a
 * full timestamp) already carries its own offset and is left alone.
 */
function localDayOf(raw) {
  if (typeof raw === 'string') {
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isTripOver(entry, now = Date.now()) {
  if (!entry) return false;
  const raw = entry.tripDate ?? entry.timestamp;
  if (raw == null) return false;
  const d = localDayOf(raw);
  if (!d) return false;
  // End of the trip's day in local time. Asking at 6pm about a day still in progress is asking
  // too early; the traveller may still be at stop four.
  const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
  return now > endOfDay;
}

/** Has this trip already been reviewed? Whole-day feedback is the marker. */
export function isReviewed(entry) {
  return !!entry && entry.feedback != null;
}

/** Trips worth prompting about: finished, and not yet reviewed. */
export function reviewableTrips(entries = [], now = Date.now()) {
  return (Array.isArray(entries) ? entries : [])
    .filter((e) => isTripOver(e, now) && !isReviewed(e));
}

/**
 * What a review pays out, given what has already been earned today.
 *
 * Returns 0 rather than throwing when the cap is reached — the review is still worth recording,
 * it just does not pay. The prompt must never imply a reward it will not deliver, so callers
 * should ask this BEFORE promising anything.
 */
export function rewardForReview(bonusAlreadyToday = 0) {
  const earned = Number.isFinite(bonusAlreadyToday) ? Math.max(0, bonusAlreadyToday) : 0;
  return Math.max(0, Math.min(REVIEW_REWARD, MAX_DAILY_REVIEW_BONUS - earned));
}

/**
 * Google's review composer for one stop.
 *
 * ⚠ There is no API for posting a review on someone's behalf — Places is read-only for reviews,
 * the Business Profile API can only reply to them, and Google requires reviews to come from the
 * person's own account. This is the only legitimate shape: hand them to Google's own dialog for
 * the right place. They write it, they post it, it stays theirs.
 *
 * ⚠ And never gate this on sentiment. Offering it only to happy travellers is review gating and
 * breaches Google's policy outright — so it is offered for every stop with a place_id, whatever
 * they thought of it.
 */
export function googleReviewUrl(placeId) {
  if (!placeId || typeof placeId !== 'string') return null;
  // Synthetic ids never exist on Google's side; linking them would open a broken dialog.
  if (/^(demo_|nps_|ridb_|fallback_|find_|stop_)/.test(placeId)) return null;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}
