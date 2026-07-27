import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from './settingsService';

// Every tap goes through here, so the enabled flag is held in memory rather than
// read from AsyncStorage on each press. Anchored on globalThis per the project
// convention — this module can be evaluated twice across the import graph, and a
// plain module-level `let` would leave one copy stuck on the default.
const state = (globalThis.__decideHaptics ??= { enabled: true, hydrated: false });

// Haptics are a native-only affordance; expo-haptics is a no-op shim on web.
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/** Hydrate the cached flag from storage. Call once at app start. */
export async function initHaptics() {
  if (!supported) { state.enabled = false; state.hydrated = true; return false; }
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

// Fire-and-forget: a failed haptic must never surface to the user or break a handler.
function fire(fn) {
  if (!supported || !state.enabled) return;
  try { fn()?.catch?.(() => {}); } catch {}
}

/** Standard button press. */
export function hapticTap() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Weightier press — primary CTAs that kick off real work. */
export function hapticPress() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Moving through options (chips, segmented controls, wheel ticks). */
export function hapticSelect() {
  fire(() => Haptics.selectionAsync());
}

/** A thing the user was waiting on has landed — e.g. the itinerary finished building. */
export function hapticSuccess() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Something failed. */
export function hapticError() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

/** Used by the Settings toggle so the user feels the setting they just enabled. */
export function hapticPreview() {
  if (!supported) return;
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)?.catch?.(() => {}); } catch {}
}
