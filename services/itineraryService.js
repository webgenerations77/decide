import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getDemoItinerary } from './demoData';
import { auth } from './firebase';

/**
 * Bearer header for the API — or a thrown error. NEVER a silent omission.
 *
 * ⚠ This used to `catch { return {} }`, sending the request with no Authorization header at all.
 * That was harmless only while the endpoints treated the header as optional attribution. They now
 * reject an unverified caller with a 401, so failing open here would turn a transient token
 * refresh hiccup — a signed-in traveller on a flaky connection — into "sign in to generate a
 * plan", which is both wrong and impossible to act on because they ARE signed in.
 *
 * The retry is the actual fix: getIdToken() only touches the network when the cached token has
 * expired, so the common failure is a stale token plus a moment of bad signal. Forcing a refresh
 * resolves that outright. If it still fails, say so honestly rather than firing a request that is
 * now guaranteed to be refused.
 */
async function authHeader() {
  const user = auth.currentUser;
  if (!user) throw new Error('You need to be signed in to do that.');
  try {
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  } catch {
    try {
      return { Authorization: `Bearer ${await user.getIdToken(true)}` };
    } catch {
      throw new Error('Could not verify your session. Check your connection and try again.');
    }
  }
}

function getApiBase() {
  if (Platform.OS === 'web') return '';
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:8081`;
  }
  return 'http://localhost:8081';
}

export async function generateItinerary({
  latitude, longitude, preferences = {},
  startTime = '11:00 AM', endTime = '8:00 PM',
  date = null,
  feedback = {},
  maxDistanceMiles = 25,
  tripNote = '', activityStyles = [], dietary = [], neurodivergent = false,
  interests = [], lovedPlaces = [], avoidedPlaces = [],
  locationLabel = null, locationShort = null,
}) {
  // Taste Profile: union the standing curated lists with any per-trip (history-derived) feedback,
  // then bound each list so the scout/synthesis prompts stay small.
  const cap = (a, n = 15) => (Array.isArray(a) ? a.slice(0, n) : []);
  const union = (a, b) => Array.from(new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]));
  const mergedFeedback = {
    ...feedback,
    likedPlaces:    cap(union(feedback.likedPlaces, lovedPlaces)),
    dislikedPlaces: cap(union(feedback.dislikedPlaces, avoidedPlaces)),
  };
  try {
    const demoRaw = await AsyncStorage.getItem('@decide/demo_mode');
    if (demoRaw === 'true') {
      await new Promise((r) => setTimeout(r, 2000));
      return getDemoItinerary({ startTime, endTime, preferences });
    }
  } catch {}

  const base = getApiBase();
  const res  = await fetch(`${base}/api/itinerary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({
      latitude, longitude, date,
      preferences: { ...preferences, activityStyles, dietary, neurodivergent, interests: cap(interests) },
      startTime, endTime, feedback: mergedFeedback, maxDistanceMiles, tripNote,
      // Human-readable label wins over server-side reverse-geocoding when present.
      ...(locationLabel ? { locationLabel } : {}),
      ...(locationShort ? { locationShort } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Itinerary generation failed (${res.status})`);
  }

  return res.json();
}

export async function getClarifyingQuestion(tripNote) {
  try {
    const demoRaw = await AsyncStorage.getItem('@decide/demo_mode');
    if (demoRaw === 'true') return { skip: true };
  } catch {}
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/itinerary?mode=clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ tripNote }),
      signal: controller.signal,
    });
    if (!res.ok) return { skip: true };
    return await res.json();
  } catch {
    return { skip: true };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Other ways to cover ONE leg. Fired only when the traveller taps a leg chip, never during
// generation — paying for every mode on every leg of every itinerary is exactly the spend the
// ambiguous-band design avoids. Fails soft to an empty list: a sheet that says "couldn't work
// this one out" is honest; a spinner that never resolves is not.
export async function getLegAlternatives({ from, to }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/itinerary?mode=transport-leg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ from, to }),
      signal: controller.signal,
    });
    if (!res.ok) return { options: [] };
    return await res.json();
  } catch {
    return { options: [] };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function swapStop({ itinerary, stopIndex, latitude, longitude, locationLabel = null, locationShort = null }) {
  const base = getApiBase();
  const res  = await fetch(`${base}/api/itinerary-swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({
      itinerary, stopIndex, latitude, longitude,
      ...(locationLabel ? { locationLabel } : {}),
      ...(locationShort ? { locationShort } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Swap failed (${res.status})`);
  }

  const data = await res.json();
  return data.itinerary;
}
