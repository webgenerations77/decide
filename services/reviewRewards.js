import AsyncStorage from '@react-native-async-storage/async-storage';
import { rewardForReview, MAX_REVIEW_BONUS_PER_PERIOD } from '../lib/tripReview';

// Bonus decisions earned by reviewing a finished trip.
//
// Deliberately a SEPARATE counter from usage rather than a discount on it. Decrementing
// `@decide/usage_decisions_` would have been fewer lines and would have quietly corrupted the
// usage numbers the admin dashboard reports — "how many plans were generated" must keep meaning
// that. This adds headroom instead, and stays legible: usage counts what happened, bonus counts
// what was earned.
//
// ⚠ Bucketed PER MONTH, matching the decision allowance it tops up. These must share a period or
// the reward silently misbehaves: with a monthly allowance and a daily bonus, a traveller who
// earned two extra plans on Tuesday would find them gone on Wednesday — mid-trip, with no
// explanation. Whatever the allowance period is, this has to be the same one.

const BONUS_PREFIX = '@decide/review_bonus_';

const monthKey = () => new Date().toISOString().slice(0, 7); // YYYY-MM

export async function getReviewBonus() {
  try {
    const raw = await AsyncStorage.getItem(`${BONUS_PREFIX}${monthKey()}`);
    const n = parseInt(raw ?? '0', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch { return 0; }
}

/**
 * What reviewing right now would pay. Ask BEFORE offering a reward, so the prompt never promises
 * something the cap will refuse.
 */
export async function pendingReviewReward() {
  return rewardForReview(await getReviewBonus());
}

/**
 * Bank the reward for a review. Returns how much was actually granted — 0 once the daily cap is
 * reached, which is not an error: the review still counts, it just stops paying.
 */
export async function grantReviewReward() {
  try {
    const already = await getReviewBonus();
    const amount = rewardForReview(already);
    if (amount <= 0) return 0;
    await AsyncStorage.setItem(`${BONUS_PREFIX}${monthKey()}`, String(already + amount));
    return amount;
  } catch { return 0; }
}

export { MAX_REVIEW_BONUS_PER_PERIOD };
