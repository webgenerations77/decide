// __tests__/smart-engine-e2e.mjs — run: node __tests__/smart-engine-e2e.mjs
import fs from 'node:fs';
import path from 'node:path';
for (const line of fs.readFileSync(path.resolve('.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/\r$/, '').replace(/^"|"$/g, '');
}
const { runSmartEngine } = await import('file:///' + path.resolve('lib/smart/index.js').replace(/\\/g, '/'));

let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const ctx = {
  location: 'Ocean City, MD', travelDates: { start: '2026-06-28', end: '2026-06-28' },
  coords: { latitude: 38.3365, longitude: -75.0849 }, maxMiles: 25, weather: null,
  prefs: { pace: 'moderate', budget: '$$', group_type: 'family', cuisines: [], activityStyles: ['arcades'], dietary: [] },
  feedback: {}, tripNote: 'we love pinball and vinyl', startTime: '11:00 AM', endTime: '8:00 PM',
};
const places = { food: [], activity: [], shopping: [], outdoor: [] };

const t = Date.now();
const res = await runSmartEngine({ ctx, places });
console.log(`took ${Date.now() - t}ms · finds=${res.finds.length} · anchors=${res.anchors.length} · hadLiveData=${res.hadLiveData}`);
console.log('anchors:', res.anchors.map((a) => a.find?.title));
assert('discovery surfaced finds', res.finds.length > 0);
assert('built an itinerary', Array.isArray(res.itinerary) && res.itinerary.length > 0);
assert('at least one interest-driven (find_) stop', (res.itinerary || []).some((s) => String(s.place_id).startsWith('find_')));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
