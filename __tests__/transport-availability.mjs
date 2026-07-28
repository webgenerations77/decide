// __tests__/transport-availability.mjs — run: node __tests__/transport-availability.mjs
//
// Guards the two promises this feature makes: only options that exist HERE are offered, and
// nothing offered ever claims a time, a fare or live availability.
import {
  getTransitOptions, defaultTransitPref, onlyRideshare, transitPrefConstraint,
  TRANSIT_SYSTEMS, RIDESHARE_OPTION,
} from '../lib/transport/availability.js';

let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

// Fixed dates so seasonal services are deterministic — never `new Date()` in a test.
const JULY = '2026-07-15';
const JANUARY = '2026-01-15';

const OCEAN_CITY   = { latitude: 38.34,  longitude: -75.07 };
const MANHATTAN    = { latitude: 40.75,  longitude: -73.98 };
const BOSTON       = { latitude: 42.35,  longitude: -71.06 };
const RURAL_KANSAS = { latitude: 38.50,  longitude: -98.50 };
const ASSATEAGUE   = { latitude: 38.25,  longitude: -75.15 };

console.log('location filtering — the whole point');
const oc = getTransitOptions(OCEAN_CITY, JULY);
assert('Ocean City in July offers the Beach Bus', oc.some((o) => /Beach Bus/i.test(o.label)));
assert('Ocean City in July offers the seasonal tram', oc.some((o) => /Tram/i.test(o.label)));
assert('Ocean City in January drops the seasonal tram',
  !getTransitOptions(OCEAN_CITY, JANUARY).some((o) => /Tram/i.test(o.label)));
assert('Ocean City in January keeps the year-round Beach Bus',
  getTransitOptions(OCEAN_CITY, JANUARY).some((o) => /Beach Bus/i.test(o.label)));

const nyc = getTransitOptions(MANHATTAN, JULY);
assert('Manhattan names the subway', nyc.some((o) => /Subway/i.test(o.label)));
assert('Manhattan does not offer the Ocean City Beach Bus', !nyc.some((o) => /Beach Bus/i.test(o.label)));
assert('Boston names the T', getTransitOptions(BOSTON, JULY).some((o) => /The T/i.test(o.label)));
assert('Boston does not offer the subway of another city',
  !getTransitOptions(BOSTON, JULY).some((o) => o.id === 'mta_nyc'));

console.log('nowhere — the honest floor, not an empty screen');
const kansas = getTransitOptions(RURAL_KANSAS, JULY);
assert('rural location still offers something actionable', kansas.length === 1);
assert('and that something is rideshare', onlyRideshare(kansas));
assert('a served location is not flagged as bare', !onlyRideshare(oc) && !onlyRideshare(nyc));

console.log('negative local entries are warnings, never selectable');
const assat = getTransitOptions(ASSATEAGUE, JULY);
assert('"no transit to the island" is not offered as a ride',
  !assat.some((o) => /No transit/i.test(o.label)), JSON.stringify(assat.map((o) => o.label)));

console.log('no coordinates yet');
assert('null location offers nothing rather than guessing', getTransitOptions(null, JULY).length === 0);
assert('junk coordinates offer nothing', getTransitOptions({ latitude: 'x', longitude: 'y' }, JULY).length === 0);

console.log('the default — Decide commits, it does not hand over a menu');
assert('a curated local service outranks the generic system', defaultTransitPref(oc) === 'oc_beach_bus', String(defaultTransitPref(oc)));
assert('rideshare is always last', oc[oc.length - 1].id === RIDESHARE_OPTION.id);
assert('rural default falls to rideshare', defaultTransitPref(kansas) === 'rideshare');
assert('no options means no default, not a crash', defaultTransitPref([]) === null);

console.log('honesty contract');
const allNotes = [...oc, ...nyc, ...kansas].map((o) => `${o.label} ${o.note ?? ''}`).join(' ');
assert('no departure times claimed', !/\b\d{1,2}[:.]\d{2}\s?(am|pm)?\b/i.test(allNotes), allNotes.slice(0, 120));
assert('no fares claimed', !/\$\d/.test(allNotes));
assert('no live-availability claims', !/available now|arriving in|minutes away|live/i.test(allNotes));
assert('every non-rideshare option carries a verifiable source',
  [...oc, ...nyc].filter((o) => o.id !== 'rideshare').every((o) => typeof o.url === 'string' && o.url.startsWith('http')));
assert('rideshare promises no ETA', RIDESHARE_OPTION.url === null && !/eta|minutes/i.test(RIDESHARE_OPTION.note));

console.log('system table integrity');
assert('every system has a bbox with sane bounds',
  TRANSIT_SYSTEMS.every((s) => s.bbox.minLat < s.bbox.maxLat && s.bbox.minLng < s.bbox.maxLng));
assert('every system names its operator and links out',
  TRANSIT_SYSTEMS.every((s) => s.operator && s.url?.startsWith('http')));
assert('system ids are unique', new Set(TRANSIT_SYSTEMS.map((s) => s.id)).size === TRANSIT_SYSTEMS.length);

console.log('synthesis constraint');
assert('no pick adds no line to the prompt', transitPrefConstraint({ id: null, label: null }) === '');
assert('a missing label adds no line', transitPrefConstraint({ id: 'oc_beach_bus', label: null }) === '');
assert('a named service reaches the prompt by name',
  transitPrefConstraint({ id: 'oc_beach_bus', label: 'Ocean City Beach Bus' }).includes('Ocean City Beach Bus'));
assert('rideshare gets its own pickup-shaped guidance',
  /pick(ed)? up/i.test(transitPrefConstraint({ id: 'rideshare', label: 'Rideshare' })));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
