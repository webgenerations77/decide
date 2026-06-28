// __tests__/smart-synthesis.mjs — run: node __tests__/smart-synthesis.mjs
import { buildSynthesisPrompt, validateStops } from '../api/smart/synthesis.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const anchors = [{ find: { title: 'Old Pro Golf', lat: 38.4, lng: -75.05 }, rationale: 'mini golf icon' }];
const { system, user } = buildSynthesisPrompt({ places: { food: [], activity: [], shopping: [], outdoor: [] }, finds: [], anchors, ctx: { location: 'OC', prefs: {}, startTime: '11:00 AM', endTime: '8:00 PM' } });
assert('synthesis is Cheddar, opinionated', system.toLowerCase().includes('cheddar'));
assert('prompt injects the anchor', user.includes('Old Pro Golf'));

const stops = validateStops([
  { time: '11:00 AM', category: 'activity', name: 'X', place_id: 'find_old', lat: 38.4, lng: -75.05, reason: 'r', excitement_score: 90 },
  { name: 'no time' },
]);
assert('validateStops keeps complete stops', stops.length === 1 && stops[0].name === 'X');
assert('validateStops preserves provenance when present', validateStops([{ time: 't', category: 'activity', name: 'Y', place_id: 'find_y', lat: 1, lng: 2, reason: 'r', excitement_score: 50, provenance: { interest: 'pinball' } }])[0].provenance.interest === 'pinball');
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
