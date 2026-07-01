import { getUserHistory } from '../history/store.js';

// Aggregate a single user's activity: how many itineraries/decisions they have,
// and how many distinct locations (by meta.city, case-insensitive) show up.
export async function getUserStats(uid) {
  const { itineraries = [], decisions = [] } = await getUserHistory(uid);

  const cityMap = new Map(); // lowercase -> original-cased display value
  for (const item of itineraries) {
    const city = item?.meta?.city;
    if (typeof city !== 'string') continue;
    const trimmed = city.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!cityMap.has(key)) cityMap.set(key, trimmed);
  }

  return {
    itineraries: itineraries.length,
    decisions: decisions.length,
    locations: cityMap.size,
    cities: Array.from(cityMap.values()).slice(0, 10),
  };
}
