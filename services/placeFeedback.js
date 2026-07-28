import AsyncStorage from '@react-native-async-storage/async-storage';

// Per-stop feedback: "I didn't want this one, and here's why."
//
// ⚠ THIS WAS A WRITE-ONLY STORE. StopCard's swap flow has always captured a rejection and its
// reason and written it to `@decide/feedback_<place_id>` — and nothing ever read it back.
// plan.js builds its HARD AVOID list from `@decide/decisions` and `@decide/itineraries`, which
// are different keys entirely. Two docs asserted the connection existed; the code never did.
// So the single most specific signal the app collects — a named place plus the traveller's own
// words about why it was wrong — was being thrown away on every swap.
//
// This module exists so the key format has ONE owner. The bug was possible because the key was a
// template literal in a component, invisible to anything looking for a data source.

const PREFIX = '@decide/feedback_';
const keyFor = (placeId) => `${PREFIX}${placeId}`;

/** Record a reaction to one stop. `reason` is the traveller's own words and may be null. */
export async function savePlaceFeedback({ placeId, placeName, feedback, reason = null }) {
  if (!placeId) return null;
  const data = { placeId, placeName: placeName ?? null, feedback, reason, timestamp: Date.now() };
  try { await AsyncStorage.setItem(keyFor(placeId), JSON.stringify(data)); } catch { /* non-fatal */ }
  return data;
}

/** What we already know about one stop, or null. */
export async function loadPlaceFeedback(placeId) {
  if (!placeId) return null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(placeId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * Every stop reaction on this device.
 *
 * Fails soft to [] — feedback enriches the next plan, so it must never be the reason a
 * generation cannot start.
 */
export async function allPlaceFeedback() {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    if (!keys.length) return [];
    const pairs = await AsyncStorage.multiGet(keys);
    return pairs
      .map(([, raw]) => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } })
      .filter((e) => e && e.placeId);
  } catch { return []; }
}
