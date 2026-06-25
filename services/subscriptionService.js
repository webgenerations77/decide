import AsyncStorage from '@react-native-async-storage/async-storage';

const FREE_DECISIONS_PER_DAY = 5;
const FREE_SPINS_PER_DAY = 3;

function todayKey() {
  return new Date().toISOString().split('T')[0];
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

async function getCount(prefix) {
  const key = `${prefix}${todayKey()}`;
  const raw = await AsyncStorage.getItem(key).catch(() => null);
  return parseInt(raw, 10) || 0;
}

async function incrementCount(prefix) {
  const key     = `${prefix}${todayKey()}`;
  const current = await getCount(prefix);
  await AsyncStorage.setItem(key, String(current + 1));
}

export async function getDecisionCount() {
  return getCount('@decide/usage_decisions_');
}

export async function getSpinCount() {
  return getCount('@decide/usage_spins_');
}

export async function incrementDecisionCount() {
  return incrementCount('@decide/usage_decisions_');
}

export async function incrementSpinCount() {
  return incrementCount('@decide/usage_spins_');
}

export async function isAtDecisionLimit() {
  const demo = await AsyncStorage.getItem('@decide/demo_mode').catch(() => null);
  if (demo === 'true') return false;
  if (await isPro()) return false;
  return (await getDecisionCount()) >= FREE_DECISIONS_PER_DAY;
}

export async function isAtSpinLimit() {
  const demo = await AsyncStorage.getItem('@decide/demo_mode').catch(() => null);
  if (demo === 'true') return false;
  if (await isPro()) return false;
  return (await getSpinCount()) >= FREE_SPINS_PER_DAY;
}

export async function getRemainingDecisions() {
  if (await isPro()) return Infinity;
  const count = await getDecisionCount();
  return Math.max(0, FREE_DECISIONS_PER_DAY - count);
}

export async function getRemainingSpins() {
  if (await isPro()) return Infinity;
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

export const LIMITS = { FREE_DECISIONS_PER_DAY, FREE_SPINS_PER_DAY };
