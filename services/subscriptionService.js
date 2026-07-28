import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase';
import { isAdmin } from '../utils/admin';

/**
 * ⚠ DECISIONS ARE CAPPED PER MONTH, SPINS PER DAY. The mismatch is deliberate and cost-driven.
 *
 * A generated plan costs about $0.22 loaded (Places $0.068, Anthropic $0.062, Routes $0.045,
 * Firecrawl $0.045 — measured 2026-07-28, see docs/backlog.md). The old cap of 5 per DAY meant a
 * single free user could generate ~150 plans a month, roughly $33, which is not a limit so much
 * as an open tab.
 *
 * A day is also the wrong unit for this product. Trip planning is bursty: someone plans a
 * weekend, re-rolls it three times, then goes quiet for a month. A daily cap fails at both ends —
 * generous enough to give away a fortune, tight enough to interrupt the one evening they are
 * actually using it. A monthly cap matches how the thing is used.
 *
 * A spin costs one Places search, about $0.017 — a thirteenth of a plan — so it keeps its daily
 * allowance. Tightening it would cost a traveller something and save nothing.
 */
const FREE_DECISIONS_PER_MONTH = 3;
const FREE_SPINS_PER_DAY = 3;

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function monthKey() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

/**
 * Admins are never rate-limited.
 *
 * Read straight from `auth.currentUser` rather than cached at startup: admin status is a pure
 * function of the signed-in email against constants/admins.js, so there is nothing to hydrate and
 * no window where the answer is stale or wrong. Defaults to NOT admin on any error — failing
 * closed here costs an admin one paywall screen, while failing open would hand everyone
 * unlimited generations.
 */
function isAdminUser() {
  try { return isAdmin(auth?.currentUser); } catch { return false; }
}

// TODO: Replace with RevenueCat initialization when account is configured
// import Purchases from 'react-native-purchases';
// Purchases.configure({ apiKey: 'YOUR_REVENUECAT_PUBLIC_KEY' });
export async function initRevenueCat() {
  console.log('[subscriptions] RevenueCat not yet configured — using local usage tracking');
}

export async function isPro() {
  // TODO: Check RevenueCat CustomerInfo for active entitlement
  // const info = await Purchases.getCustomerInfo();
  // return info.entitlements.active['pro'] !== undefined;
  const cached = await AsyncStorage.getItem('@decide/subscription_status').catch(() => null);
  return cached === 'pro';
}

async function getCount(prefix, periodKey = todayKey) {
  const key = `${prefix}${periodKey()}`;
  const raw = await AsyncStorage.getItem(key).catch(() => null);
  return parseInt(raw, 10) || 0;
}

async function incrementCount(prefix, periodKey = todayKey) {
  const key     = `${prefix}${periodKey()}`;
  const current = await getCount(prefix, periodKey);
  await AsyncStorage.setItem(key, String(current + 1));
}

export async function getDecisionCount() {
  // Monthly bucket. Old per-day keys are simply orphaned — no migration, because the worst case
  // is a traveller getting a fresh allowance the day this ships, which is the forgiving direction.
  return getCount('@decide/usage_decisions_', monthKey);
}

export async function getSpinCount() {
  return getCount('@decide/usage_spins_');
}

export async function incrementDecisionCount() {
  return incrementCount('@decide/usage_decisions_', monthKey);
}

export async function incrementSpinCount() {
  return incrementCount('@decide/usage_spins_');
}

/**
 * Today's decision allowance: the free tier plus anything earned by reviewing a finished trip.
 *
 * Read through a dynamic import so this module stays free of a static cycle — reviewRewards
 * imports from lib/tripReview, and keeping the dependency one-way here avoids a load-order
 * surprise in the bundler. Falls back to the plain limit if anything goes wrong: a broken bonus
 * lookup must never lock someone out of a plan they were entitled to.
 */
async function decisionAllowance() {
  try {
    const { getReviewBonus } = await import('./reviewRewards');
    return FREE_DECISIONS_PER_MONTH + (await getReviewBonus());
  } catch {
    return FREE_DECISIONS_PER_MONTH;
  }
}

/** Everyone who is never rate-limited: admins, Pro subscribers, and demo mode. */
async function isExempt() {
  if (isAdminUser()) return true;
  const demo = await AsyncStorage.getItem('@decide/demo_mode').catch(() => null);
  if (demo === 'true') return true;
  return isPro();
}

export async function isAtDecisionLimit() {
  if (await isExempt()) return false;
  return (await getDecisionCount()) >= (await decisionAllowance());
}

export async function isAtSpinLimit() {
  if (await isExempt()) return false;
  return (await getSpinCount()) >= FREE_SPINS_PER_DAY;
}

// Infinity renders as "no counter shown" in both screens, which is the right treatment for
// someone who cannot run out.
export async function getRemainingDecisions() {
  if (await isExempt()) return Infinity;
  const count = await getDecisionCount();
  return Math.max(0, (await decisionAllowance()) - count);
}

export async function getRemainingSpins() {
  if (await isExempt()) return Infinity;
  const count = await getSpinCount();
  return Math.max(0, FREE_SPINS_PER_DAY - count);
}

// TODO: Wire to RevenueCat purchase flow
export async function purchasePro() {
  // const offerings = await Purchases.getOfferings();
  // const pkg = offerings.current?.monthly;
  // if (pkg) { const result = await Purchases.purchasePackage(pkg); ... }
  return { success: false, message: 'Subscriptions coming soon!' };
}

// TODO: Wire to RevenueCat restore
export async function restorePurchases() {
  // const info = await Purchases.restorePurchases();
  // return info.entitlements.active['pro'] !== undefined;
  return false;
}

export const LIMITS = { FREE_DECISIONS_PER_MONTH, FREE_SPINS_PER_DAY };
