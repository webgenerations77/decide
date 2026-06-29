// Quick verification script for the new feature logic
// Run with: node __tests__/verify.mjs

import { wantsAlcohol } from '../api/smart/sourceRegistry.js';
import { wantsLiveMusic, summarizeShow } from '../api/smart/liveMusic.js';
import { buildScoutPrompt } from '../api/smart/scout.js';
import { buildSynthesisPrompt } from '../api/smart/synthesis.js';

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ─── Copy pure functions from itineraryService.js (no React Native imports) ──

function getWeatherEmoji(condition) {
  if (!condition) return '🌤';
  const c = condition.toLowerCase();
  if (c.includes('thunder'))                               return '⛈';
  if (c.includes('snow') || c.includes('blizzard') || c.includes('ice')) return '❄️';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return '🌧';
  if (c.includes('fog') || c.includes('mist') || c.includes('haze'))       return '🌫';
  if (c.includes('wind') || c.includes('breezy') || c.includes('gale'))    return '🌬';
  if (c.includes('overcast'))                              return '☁️';
  if (c.includes('partly') || c.includes('mostly'))       return '🌤';
  if (c.includes('cloudy'))                               return '☁️';
  if (c.includes('sunny') || c.includes('clear'))         return '☀️';
  return '🌤';
}

function extractJSON(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
}

function buildNavURL(itinerary) {
  if (!itinerary?.length) return null;
  const encode = (s) => s.lat && s.lng
    ? `${s.lat},${s.lng}`
    : encodeURIComponent(s.address || s.name);
  const stops = itinerary.map(encode);
  let url = `https://www.google.com/maps/dir/?api=1&origin=${stops[0]}&destination=${stops[stops.length - 1]}&travelmode=driving`;
  if (stops.length > 2) url += `&waypoints=${stops.slice(1, -1).join('|')}`;
  return url;
}

function buildWeatherStr(weather) {
  const windStr = weather?.wind_speed_mph
    ? ` · Wind ${weather.wind_speed_mph}mph${weather.wind_dir ? ` ${weather.wind_dir}` : ''}`
    : '';
  return weather
    ? `${weather.emoji} ${weather.condition}, ${weather.temp_f}°F (feels like ${weather.feels_like_f}°F)${windStr}`
    : 'Weather data unavailable';
}

// ─── PRIORITY 3: Weather emoji tests ──────────────────────────────────────────
console.log('\nPRIORITY 3 — Weather emoji:');
assert('Sunny → ☀️',            getWeatherEmoji('Sunny') === '☀️');
assert('Clear → ☀️',            getWeatherEmoji('Clear') === '☀️');
assert('Partly cloudy → 🌤',    getWeatherEmoji('Partly cloudy') === '🌤');
assert('Overcast → ☁️',         getWeatherEmoji('Overcast') === '☁️');
assert('Light rain → 🌧',       getWeatherEmoji('Light rain') === '🌧');
assert('Thunderstorm → ⛈',     getWeatherEmoji('Thunderstorm') === '⛈');
assert('Heavy snow → ❄️',       getWeatherEmoji('Heavy snow') === '❄️');
assert('Fog → 🌫',              getWeatherEmoji('Fog') === '🌫');
assert('Windy → 🌬',            getWeatherEmoji('Windy') === '🌬');
assert('null → 🌤 default',     getWeatherEmoji(null) === '🌤');
assert('empty → 🌤 default',    getWeatherEmoji('') === '🌤');

console.log('\nPRIORITY 3 — Weather string with wind:');
const wx = { emoji: '☀️', condition: 'Sunny', temp_f: '75', feels_like_f: '73', wind_speed_mph: '12', wind_dir: 'SW' };
const wstr = buildWeatherStr(wx);
assert('Includes emoji',         wstr.includes('☀️'));
assert('Includes condition',     wstr.includes('Sunny'));
assert('Includes temp',          wstr.includes('75°F'));
assert('Includes wind speed',    wstr.includes('12mph'));
assert('Includes wind dir',      wstr.includes('SW'));

const wxNoWind = { emoji: '☁️', condition: 'Cloudy', temp_f: '60', feels_like_f: '58', wind_speed_mph: null };
assert('No wind → no 🌬 text',  !buildWeatherStr(wxNoWind).includes('Wind'));
assert('null weather → fallback', buildWeatherStr(null) === 'Weather data unavailable');

// ─── JSON extraction tests ────────────────────────────────────────────────────
console.log('\nextractJSON (unchanged):');
const codeBlock = '```json\n[{"name":"Test"}]\n```';
assert('Extracts from code block', extractJSON(codeBlock) === '[{"name":"Test"}]');
assert('Falls back to raw text',   extractJSON('[{"name":"Test"}]') === '[{"name":"Test"}]');
assert('Handles ```json``` prefix', extractJSON('```json\n[]\n```') === '[]');
assert('Trims whitespace',         extractJSON('  [{}]  ') === '[{}]');

// ─── PRIORITY 5: Navigate Full Day URL ────────────────────────────────────────
console.log('\nPRIORITY 5 — Navigate Full Day URL:');

const stops1 = [{ lat: 37.77, lng: -122.41, name: 'Place A', address: '1 Main St' }];
assert('Single stop: origin=dest', (() => {
  const url = buildNavURL(stops1);
  return url.includes('origin=37.77,-122.41') && url.includes('destination=37.77,-122.41') && !url.includes('waypoints');
})());

const stops2 = [
  { lat: 37.77, lng: -122.41, name: 'A', address: '1 Main' },
  { lat: 37.78, lng: -122.42, name: 'B', address: '2 Main' },
];
assert('Two stops: no waypoints', (() => {
  const url = buildNavURL(stops2);
  return url.includes('origin=37.77,-122.41') && url.includes('destination=37.78,-122.42') && !url.includes('waypoints');
})());

const stops3 = [
  { lat: 37.77, lng: -122.41, name: 'A', address: '1 Main' },
  { lat: 37.78, lng: -122.42, name: 'B', address: '2 Main' },
  { lat: 37.79, lng: -122.43, name: 'C', address: '3 Main' },
];
assert('Three stops: one waypoint', (() => {
  const url = buildNavURL(stops3);
  return url.includes('waypoints=37.78,-122.42') && url.includes('destination=37.79,-122.43');
})());

const stops5 = [
  { lat: 37.77, lng: -122.41, name: 'A', address: '1 Main' },
  { lat: 37.78, lng: -122.42, name: 'B', address: '2 Main' },
  { lat: 37.79, lng: -122.43, name: 'C', address: '3 Main' },
  { lat: 0,     lng: 0,       name: 'D', address: '4 Elm St' }, // no coords
  { lat: 37.80, lng: -122.44, name: 'E', address: '5 Main' },
];
assert('Five stops: origin/dest correct', (() => {
  const url = buildNavURL(stops5);
  // JS drops trailing zero: 37.80 → "37.8"
  return url.includes('origin=37.77,-122.41') && url.includes('destination=37.8,-122.44');
})());
assert('Falls back to address when lat/lng=0', (() => {
  const url = buildNavURL(stops5);
  return url.includes(encodeURIComponent('4 Elm St'));
})());

assert('Empty itinerary → null', buildNavURL([]) === null);
assert('Null itinerary → null',  buildNavURL(null) === null);

// ─── PRIORITY 2: NPS/RIDB place_id detection (detail modal logic) ─────────────
console.log('\nPRIORITY 2+4 — External place_id detection:');
const isExternal = (pid) => pid?.startsWith('nps_') || pid?.startsWith('ridb_');
assert('nps_ prefix → external',   isExternal('nps_abc123') === true);
assert('ridb_ prefix → external',  isExternal('ridb_456') === true);
assert('ChIJ prefix → not external', isExternal('ChIJabc') === false);
assert('null → not external',       !isExternal(null));
assert('event_ prefix → not external', isExternal('event_xyz') === false);

// ─── PRIORITY 6: Feedback AsyncStorage key format ─────────────────────────────
console.log('\nPRIORITY 6 — Feedback key format:');
const feedbackKey = (placeId) => `@decide/feedback_${placeId}`;
assert('Google place key',  feedbackKey('ChIJabc') === '@decide/feedback_ChIJabc');
assert('NPS place key',     feedbackKey('nps_123') === '@decide/feedback_nps_123');
assert('RIDB place key',    feedbackKey('ridb_456') === '@decide/feedback_ridb_456');

// ─── SESSION 2 — Alcohol gating ───────────────────────────────────────────────
console.log('\nSESSION 2 — wantsAlcohol gating:');
assert('Bars & Breweries style → true',  wantsAlcohol({ activityStyles: ['Bars & Breweries'] }, '') === true);
assert('tripNote mentions beer → true',  wantsAlcohol({}, 'want to grab a beer') === true);
assert('tripNote mentions brewery → true', wantsAlcohol({}, 'a brewery tour') === true);
assert('No drink signal → false',        wantsAlcohol({ activityStyles: ['Arcades'] }, 'pinball and parks') === false);
assert('Empty → false',                  wantsAlcohol({}, '') === false);

// ─── SESSION 2 — Activity-type balance guards ─────────────────────────────────
console.log('\nSESSION 2 — Activity-type balance:');
const scoutP = buildScoutPrompt({ location: 'X', tripNote: 'pinball and live music', prefs: {} });
assert('Scout asks for equal weight', /equal|do not let repetition|distinct/i.test(scoutP));
const synthP = buildSynthesisPrompt({
  places: {}, finds: [], anchors: [],
  ctx: { location: 'X', startTime: '11:00 AM', endTime: '8:00 PM', tripNote: 'pinball and live music', prefs: { activityStyles: ['Live Music'] } },
}).user;
assert('Synthesis caps a single type',  /at most 1.?2 stops|cap any single|no more than (1|2)/i.test(synthP));
assert('Synthesis sees the trip note',  synthP.includes('pinball and live music'));

// ─── SESSION 2 — Live music ───────────────────────────────────────────────────
console.log('\nSESSION 2 — Live music:');
assert('Live Music style → true',     wantsLiveMusic({ activityStyles: ['Live Music'] }, '') === true);
assert('tripNote concert → true',      wantsLiveMusic({}, 'see a concert tonight') === true);
assert('tripNote band → true',         wantsLiveMusic({}, 'catch a band') === true);
assert('No music signal → false',      wantsLiveMusic({ activityStyles: ['Arcades'] }, 'pinball') === false);
assert('Confirmed show snippet',       summarizeShow({ artist: 'The Beths', showtime: '8 PM', confirmed: true }) === '🎵 The Beths · 8 PM');
assert('Unconfirmed → likely note',    /Live music likely/i.test(summarizeShow({ confirmed: false, url: 'https://v.com' })));

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
