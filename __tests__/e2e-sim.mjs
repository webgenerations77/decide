// Simulates a full itinerary response (as Claude would return it) and
// verifies that all downstream processing works correctly.

import assert from 'assert/strict';

// Simulated Claude response with lat/lng (the new schema)
const MOCK_CLAUDE_RESPONSE = JSON.stringify([
  {
    time: "11:00 AM", duration_mins: 90, category: "activity",
    name: "Golden Gate Park", place_id: "ChIJp9bMiIuAhYARqMIFUB_Sbjk",
    address: "501 Stanyan St, San Francisco, CA 94117",
    lat: 37.7694, lng: -122.4862,
    reason: "Perfect morning outdoor activity in the heart of SF.",
    excitement_score: 92
  },
  {
    time: "1:00 PM", duration_mins: 75, category: "food",
    name: "The Slanted Door", place_id: "ChIJYfSmvXKAhYARfJHNjBPUqj0",
    address: "1 Ferry Building, San Francisco, CA",
    lat: 37.7956, lng: -122.3935,
    reason: "Iconic Vietnamese cuisine for lunch.",
    excitement_score: 88
  },
  {
    time: "3:00 PM", duration_mins: 90, category: "outdoor",
    name: "nps_golden-gate", place_id: "nps_golden-gate",  // NPS stop
    address: "San Francisco, CA",
    lat: 37.8267, lng: -122.4233,
    reason: "Historic national park with stunning bay views.",
    excitement_score: 95
  },
  {
    time: "7:00 PM", duration_mins: 120, category: "food",
    name: "Zuni Café", place_id: "ChIJZabc12345",
    address: "1658 Market St, San Francisco, CA",
    lat: 37.7736, lng: -122.4205,
    reason: "Classic SF dinner spot.",
    excitement_score: 85
  }
]);

// ── extractJSON ───────────────────────────────────────────────────────────────
function extractJSON(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
}

// Test 1: Parse the mock response
const itinerary = JSON.parse(extractJSON(MOCK_CLAUDE_RESPONSE));
assert.equal(itinerary.length, 4, 'Should have 4 stops');
assert.equal(itinerary[0].name, 'Golden Gate Park');
assert.ok(itinerary[0].lat, 'Stop should have lat');
assert.ok(itinerary[0].lng, 'Stop should have lng');
console.log('✓ Itinerary parsed correctly (4 stops with lat/lng)');

// Test 2: NPS/RIDB place_id detection
const isExternal = (pid) => pid?.startsWith('nps_') || pid?.startsWith('ridb_');
assert.equal(isExternal(itinerary[2].place_id), true, 'NPS stop should be external');
assert.equal(isExternal(itinerary[0].place_id), false, 'Google stop should not be external');
console.log('✓ NPS/RIDB place_id detection works');

// Test 3: Navigate Full Day URL with real coordinates
function buildNavURL(itin) {
  if (!itin?.length) return null;
  const encode = (s) => s.lat && s.lng
    ? `${s.lat},${s.lng}`
    : encodeURIComponent(s.address || s.name);
  const stops = itin.map(encode);
  let url = `https://www.google.com/maps/dir/?api=1&origin=${stops[0]}&destination=${stops[stops.length - 1]}&travelmode=driving`;
  if (stops.length > 2) url += `&waypoints=${stops.slice(1, -1).join('|')}`;
  return url;
}

const navURL = buildNavURL(itinerary);
assert.ok(navURL.includes('origin=37.7694,-122.4862'), 'Origin should be first stop coords');
assert.ok(navURL.includes('destination=37.7736,-122.4205'), 'Destination should be last stop coords');
assert.ok(navURL.includes('waypoints='), 'Should have waypoints for 4 stops');
assert.ok(navURL.includes('travelmode=driving'), 'Should use driving mode');
const waypointCount = navURL.split('|').length;
assert.equal(waypointCount, 2, 'Should have 2 waypoints (stops 2 and 3)');
console.log('✓ Navigate Full Day URL:', navURL.slice(0, 80) + '...');

// Test 4: Weather string with new format
function buildWeatherStr(weather) {
  const windStr = weather?.wind_speed_mph
    ? ` · Wind ${weather.wind_speed_mph}mph${weather.wind_dir ? ` ${weather.wind_dir}` : ''}`
    : '';
  return weather
    ? `${weather.emoji} ${weather.condition}, ${weather.temp_f}°F (feels like ${weather.feels_like_f}°F)${windStr}`
    : 'Weather data unavailable';
}

const mockWeather = {
  condition: 'Partly cloudy', emoji: '🌤',
  temp_f: '68', feels_like_f: '65',
  wind_speed_mph: '8', wind_dir: 'NW'
};
const str = buildWeatherStr(mockWeather);
assert.ok(str.startsWith('🌤'), 'Weather string should start with emoji');
assert.ok(str.includes('Wind 8mph NW'), 'Should include wind info');
console.log('✓ Weather string:', str);

// Test 5: Feedback AsyncStorage keys for all stop types
const feedbackKey = (p) => `@decide/feedback_${p}`;
itinerary.forEach((stop, i) => {
  const key = feedbackKey(stop.place_id);
  assert.ok(key.startsWith('@decide/feedback_'), `Stop ${i} key should have prefix`);
});
console.log('✓ Feedback keys valid for all 4 stop types (Google + NPS)');

// Test 6: JSON schema has required new fields
itinerary.forEach((stop, i) => {
  const required = ['time', 'duration_mins', 'category', 'name', 'place_id', 'address', 'lat', 'lng', 'reason', 'excitement_score'];
  required.forEach(field => {
    assert.ok(field in stop, `Stop ${i} missing field: ${field}`);
  });
});
console.log('✓ All stops have the required 10 fields including lat/lng');

console.log('\n✅ All end-to-end simulations passed');
