import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getDemoItinerary } from './demoData';
import { auth } from './firebase';

async function authHeader() {
  try {
    const token = await auth.currentUser?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
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
}) {
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
    body: JSON.stringify({ latitude, longitude, date, preferences: { ...preferences, activityStyles, dietary, neurodivergent }, startTime, endTime, feedback, maxDistanceMiles, tripNote }),
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

export async function swapStop({ itinerary, stopIndex, latitude, longitude }) {
  const base = getApiBase();
  const res  = await fetch(`${base}/api/itinerary-swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ itinerary, stopIndex, latitude, longitude }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Swap failed (${res.status})`);
  }

  const data = await res.json();
  return data.itinerary;
}
