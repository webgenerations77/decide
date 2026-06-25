import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getDemoItinerary } from './demoData';

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude, longitude, date, preferences, startTime, endTime, feedback, maxDistanceMiles }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Itinerary generation failed (${res.status})`);
  }

  return res.json();
}

export async function swapStop({ itinerary, stopIndex, latitude, longitude }) {
  const base = getApiBase();
  const res  = await fetch(`${base}/api/itinerary-swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itinerary, stopIndex, latitude, longitude }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Swap failed (${res.status})`);
  }

  const data = await res.json();
  return data.itinerary;
}
