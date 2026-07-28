import AsyncStorage from '@react-native-async-storage/async-storage';
import { rewardForReview, MAX_DAILY_REVIEW_BONUS } from '../lib/tripReview';

// Bonus decisions earned by reviewing a finished trip.
//
// Deliberately a SEPARATE counter from usage rather than a discount on it. Decrementing
// `@decide/usage_decisions_` would have been fewer lines and would have quietly corrupted the
// usage numbers the admin dashboard reports — "how many plans were generated" must keep meaning
// that. This adds headroom instead, and stays legible: usage counts what happened, bonus counts
// what was earned.
//
// Same per-day key shape as the usage counters, so it expires with them.

const BONUS_PREFIX = '@decide/review_bonus_';

const todayKey = () => new Date().toISOString().split('T')[0];

export async function getReviewBonusToday() {
  try {
    const raw = await AsyncStorage.getItem(`${BONUS_PREFIX}${todayKey()}`);
    const n = parseInt(raw ?? '0', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch { return 0; }
}

/**
 * What reviewing right now would pay. Ask BEFORE offering a reward, so the prompt never promises
 * something the cap will refuse.
 */
export async function pendingReviewReward() {
  return rewardForReview(await getReviewBonusToday());
}

/**
 * Bank the reward for a review. Returns how much was actually granted — 0 once the daily cap is
 * reached, which is not an error: the review still counts, it just stops paying.
 */
export async function grantReviewReward() {
  try {
    const already = await getReviewBonusToday();
    const amount = rewardForReview(already);
    if (amount <= 0) return 0;
    await AsyncStorage.setItem(`${BONUS_PREFIX}${todayKey()}`, String(already + amount));
    return amount;
  } catch { return 0; }
}

export { MAX_DAILY_REVIEW_BONUS };
