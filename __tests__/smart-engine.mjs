// __tests__/smart-engine.mjs — run: node __tests__/smart-engine.mjs
import { runSmartEngine } from '../lib/smart/index.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

(async () => {
  const ctx = { location: 'OC', prefs: {}, coords: { latitude: 1, longitude: 2 } };
  const places = { food: [], activity: [], shopping: [], outdoor: [] };

  // Happy path with injected fakes
  const ok = await runSmartEngine({ ctx, places }, {
    runScout: async () => [{ interest: 'pinball', priority: 9, suggestedQuery: 'q' }],
    runDiscovery: async () => [{ title: 'Pin Bar', lat: 1, lng: 2 }],
    pickAnchors: async () => [{ find: { title: 'Pin Bar' }, rationale: 'r' }],
    runSynthesis: async () => [{ time: '11:00 AM', name: 'Pin Bar', category: 'activity', lat: 1, lng: 2, place_id: 'find_pin', reason: 'r', excitement_score: 90 }],
    runEvents: async () => [],
  });
  assert('returns itinerary on success', Array.isArray(ok.itinerary) && ok.itinerary.length === 1);
  assert('hadLiveData true when finds present', ok.hadLiveData === true);

  // Synthesis failure → itinerary null (caller falls back)
  const bad = await runSmartEngine({ ctx, places }, {
    runScout: async () => [{ interest: 'pinball', priority: 9, suggestedQuery: 'q' }],
    runDiscovery: async () => [{ title: 'Pin Bar' }],
    pickAnchors: async () => [],
    runSynthesis: async () => [],
    runEvents: async () => [],
  });
  assert('itinerary null when synthesis empty', bad.itinerary === null);

  // Total failure never throws
  const safe = await runSmartEngine({ ctx, places }, { runScout: async () => { throw new Error('boom'); } });
  assert('never throws; degrades to null', safe.itinerary === null && safe.hadLiveData === false);

  // localHappenings: events injected + holiday on ctx
  const ctxHoliday = { ...ctx, holiday: 'Independence Day (July 4th)' };
  const withEvents = await runSmartEngine({ ctx: ctxHoliday, places }, {
    runScout: async () => [],
    runDiscovery: async () => [],
    pickAnchors: async () => [],
    runSynthesis: async () => [],
    runEvents: async () => [{ title: 'Fireworks', url: 'http://x', when: '2026-07-04', category: 'activity', interest: 'Independence Day (July 4th)', lat: null, lng: null, address: '', snippet: '', sourceLabel: 'Local events' }],
  });
  assert('localHappenings.events has injected event', withEvents.localHappenings?.events?.length === 1);

  // localHappenings: holiday + zero events → note is non-empty string
  const noEvents = await runSmartEngine({ ctx: ctxHoliday, places }, {
    runScout: async () => [],
    runDiscovery: async () => [],
    pickAnchors: async () => [],
    runSynthesis: async () => [],
    runEvents: async () => [],
  });
  assert('localHappenings.note is non-empty when holiday + no events', typeof noEvents.localHappenings?.note === 'string' && noEvents.localHappenings.note.length > 0);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
