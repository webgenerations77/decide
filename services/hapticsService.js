import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from './settingsService';

// Every tap goes through here, so the enabled flag is held in memory rather than
// read from AsyncStorage on each press. Anchored on globalThis per the project
// convention — this module can be evaluated twice across the import graph, and a
// plain module-level `let` would leave one copy stuck on the default.
const state = (globalThis.__decideHaptics ??= { enabled: true, hydrated: false });

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Web fallback. The deployed app is installed from the browser, so `expo-haptics`
 * (native-only) never fires there — but Chrome on Android implements the Vibration
 * API, which is close enough for taps. Guarded for the static-render pass, where
 * `navigator` doesn't exist.
 *
 * iOS Safari implements no Vibration API at all, so this is correctly false on
 * iPhone and the Settings toggle hides itself rather than lying.
 */
function webVibrate() {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return null;
  return navigator.vibrate.bind(navigator);
}

/** Whether this device can produce haptics at all. Drives the Settings toggle. */
export function hapticsSupported() {
  return isNative || !!webVibrate();
}

/** Hydrate the cached flag from storage. Call once at app start. */
export async function initHaptics() {
  if (!hapticsSupported()) { state.enabled = false; state.hydrated = true; return false; }
  try {
    const raw = await AsyncStorage.getItem(KEYS.HAPTICS);
    state.enabled = raw === null ? true : raw === 'true';   // default ON
  } catch {
    state.enabled = true;
  }
  state.hydrated = true;
  return state.enabled;
}

/** Update the cached flag. The Settings toggle owns persistence via `save()`. */
export function setHapticsEnabled(enabled) {
  state.enabled = !!enabled;
}

export function hapticsEnabled() {
  return state.enabled;
}

/**
 * Fire-and-forget. A failed haptic must never surface to the user or break a handler.
 * `native` runs on a real device; `pattern` is the millisecond fallback for web —
 * a single number for one buzz, an array for an on/off/on sequence.
 */
function fire(native, pattern) {
  if (!state.enabled) return;
  try {
    if (isNative) { native()?.catch?.(() => {}); return; }
    // Chrome silently ignores vibrate() without a prior user gesture on the page.
    // That's fine — the first tap grants sticky activation for everything after.
    webVibrate()?.(pattern);
  } catch {}
}

/** Standard button press. */
export function hapticTap() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 10);
}

/** Weightier press — primary CTAs that kick off real work. */
export function hapticPress() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 18);
}

/** Moving through options (chips, segmented controls, wheel ticks). */
export function hapticSelect() {
  fire(() => Haptics.selectionAsync(), 8);
}

/** A thing the user was waiting on has landed — e.g. the itinerary finished building. */
export function hapticSuccess() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), [14, 60, 28]);
}

/** Something failed. */
export function hapticError() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), [30, 60, 30, 60, 30]);
}

/** Used by the Settings toggle so the user feels the setting they just enabled. */
export function hapticPreview() {
  if (!hapticsSupported()) return;
  try {
    if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)?.catch?.(() => {});
    else webVibrate()?.([14, 60, 28]);
  } catch {}
}
