// __tests__/transport-modes.mjs — run: node __tests__/transport-modes.mjs
import {
  classifyLeg, ambiguousLegIndexes, dayVerdict, isNotableLeg, legChipText,
  transitIsCompetitive, TRANSIT_TOLERANCE,
} from '../lib/transport/modes.js';
import { getLocalTransport, rideshareLink } from '../lib/transport/local.js';
import {
  clampSearchMiles, synthesisConstraint, maxLegMiles, normalizeGettingAround,
} from '../lib/transport/gettingAround.js';
import { buildLegs } from '../lib/transport/index.js';

let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

console.log('classifyLeg');
assert('sub-0.3mi is a certain walk', classifyLeg(0.15).mode === 'walk' && classifyLeg(0.15).ambiguous === false);
assert('0.4mi is ambiguous', classifyLeg(0.4).ambiguous === true);
assert('2.5mi is ambiguous', classifyLeg(2.5).ambiguous === true);
assert('22mi is a certain drive', classifyLeg(22).mode === 'drive' && classifyLeg(22).ambiguous === false);
assert('exactly 3.0mi still ambiguous', classifyLeg(3.0).ambiguous === true);
assert('3.1mi is a drive', classifyLeg(3.1).mode === 'drive');
assert('null distance degrades to drive, not a crash', classifyLeg(null).mode === 'drive');
assert('null distance is never ambiguous (would waste a call)', classifyLeg(null).ambiguous === false);
assert('walk carries an estimated time', classifyLeg(0.2).mins > 0);

console.log('ambiguousLegIndexes — the spend guard');
const legs = [{ miles: 22 }, { miles: 0.4 }, { miles: 1.8 }, { miles: 0.05 }, { miles: 14.2 }];
const idx = ambiguousLegIndexes(legs);
assert('picks exactly the uncertain band', JSON.stringify(idx) === '[1,2]', JSON.stringify(idx));
assert('all-drive day costs zero calls', ambiguousLegIndexes([{ miles: 12 }, { miles: 30 }]).length === 0);
assert('all-walk day costs zero calls', ambiguousLegIndexes([{ miles: 0.1 }, { miles: 0.2 }]).length === 0);

console.log('dayVerdict');
const driving = dayVerdict(
  [{ mode: 'drive', miles: 12, mins: 20 }, { mode: 'drive', miles: 19, mins: 32 }],
  { transit: 'no' },
);
assert('all-drive day commits to drive', driving.mode === 'drive');
assert('states total miles', driving.totalMiles === 31);
assert('transit absence stated once at day level', typeof driving.transitNote === 'string' && driving.transitNote.length > 0);

const walking = dayVerdict(
  [{ mode: 'walk', miles: 0.3, mins: 6 }, { mode: 'walk', miles: 0.2, mins: 4 }],
  { transit: 'no' },
);
assert('all-walk day commits to walk', walking.mode === 'walk');

// The load-bearing one: a single long leg must NOT be averaged away into a walkable day.
const mixed = dayVerdict(
  [{ mode: 'walk', miles: 0.2, mins: 4 }, { mode: 'drive', miles: 14, mins: 24 }, { mode: 'walk', miles: 0.3, mins: 6 }],
  { transit: 'no' },
);
assert('one long leg makes the whole day a drive', mixed.mode === 'drive');
assert('empty legs → null, not a fabricated verdict', dayVerdict([], {}) === null);

const unknownTransit = dayVerdict([{ mode: 'drive', miles: 9, mins: 15 }], { transit: 'unknown' });
assert('unknown transit is admitted, not guessed', /could not check/i.test(unknownTransit.transitNote));

console.log('isNotableLeg — chip suppression');
const driveDay = { mode: 'drive' };
assert('drive leg on a drive day is NOT notable', isNotableLeg({ mode: 'drive' }, driveDay) === false);
assert('walkable leg on a drive day IS notable', isNotableLeg({ mode: 'walk' }, driveDay) === true);
const walkDay = { mode: 'walk' };
assert('walk leg on a walk day is NOT notable', isNotableLeg({ mode: 'walk' }, walkDay) === false);
assert('drive leg on a walk day IS notable', isNotableLeg({ mode: 'drive' }, walkDay) === true);
assert('missing verdict is safe', isNotableLeg({ mode: 'walk' }, null) === false);

console.log('legChipText');
assert('chip names the action', /Walk it/.test(legChipText({ mode: 'walk', miles: 0.3, mins: 6 })));
assert('chip survives missing distance', typeof legChipText({ mode: 'drive' }) === 'string');

console.log('buildLegs');
const stops = [
  { lat: 38.33, lng: -75.08, name: 'A', leg_miles: 2.1 },
  { lat: 38.34, lng: -75.07, name: 'B', leg_miles: 0.4, leg_from: 'A' },
  { name: 'no coords' },
];
const built = buildLegs(stops, 38.30, -75.10);
assert('first leg starts at origin', built[0].from.lat === 38.30);
assert('second leg starts at previous stop', built[1].from.lat === 38.33);
assert('reuses annotateRoute miles rather than recomputing', built[1].miles === 0.4);
assert('coordless stop yields a null leg, not a crash', built[2] === null);

console.log('local transport');
const oc = getLocalTransport(38.35, -75.07, '2026-07-15');
assert('Ocean City in July finds local options', oc.length > 0);
assert('every local option carries a verifiable source', oc.every((e) => typeof e.url === 'string' && e.url.startsWith('http')));
const ocWinter = getLocalTransport(38.35, -75.07, '2026-01-15');
assert('seasonal entries drop out in January', ocWinter.length < oc.length);
assert('year-round Beach Bus survives winter', ocWinter.some((e) => e.id === 'oc_beach_bus'));
assert('uncovered region returns empty (renders as nothing)', getLocalTransport(40.71, -74.00, '2026-07-15').length === 0);
assert('bad coords return empty', getLocalTransport(null, null).length === 0);

console.log('big-city behaviour — transit vs driving');
// The bug this replaced: a flat "under 15 miles" ceiling sent a 22-mile Brooklyn → Manhattan
// → Queens day to "Drive it", which is bad advice in New York, while a 6-mile suburban day
// squeaked under it and got recommended transit that barely runs.
assert('transit wins when it beats driving', transitIsCompetitive(30, 40, 22) === true);
assert('transit wins when only modestly slower', transitIsCompetitive(50, 40, 22) === true);
assert('driving wins when transit is far slower', transitIsCompetitive(120, 40, 6) === false);
assert('tolerance boundary holds', transitIsCompetitive(40 * TRANSIT_TOLERANCE, 40, 6) === true);
assert('just past tolerance flips to driving', transitIsCompetitive(40 * TRANSIT_TOLERANCE + 1, 40, 6) === false);
assert('falls back to mileage when durations are unknown', transitIsCompetitive(null, null, 6) === true);
assert('mileage fallback rejects a long day', transitIsCompetitive(null, null, 40) === false);
assert('zero drive time does not divide-by-zero into transit', transitIsCompetitive(30, 0, 40) === false);

// The city case, end to end: a long day where transit genuinely beats driving.
const bigCity = dayVerdict(
  [{ mode: 'drive', miles: 9, mins: 20 }, { mode: 'drive', miles: 13, mins: 26 }],
  { transit: 'yes', transitMins: 38, driveMins: 46 },
);
assert('a 22-mile transit-competitive day says transit, not drive', bigCity.mode === 'transit', bigCity.mode);

// The suburban case: transit exists on paper but is three times slower.
const sprawl = dayVerdict(
  [{ mode: 'drive', miles: 3, mins: 8 }, { mode: 'drive', miles: 3, mins: 8 }],
  { transit: 'yes', transitMins: 75, driveMins: 16 },
);
assert('a short day with unusable transit still says drive', sprawl.mode === 'drive', sprawl.mode);

console.log('getting-around constraint — the plan-vs-fantasy guard');
// The whole point of phase 2: never tell someone without a car to drive.
const carlessBadPlan = dayVerdict(
  [{ mode: 'walk', miles: 0.3, mins: 6 }, { mode: 'drive', miles: 14, mins: 24 }],
  { transit: 'no', gettingAround: 'walk' },
);
assert('carless traveller is NEVER told to drive', carlessBadPlan.mode !== 'drive');
assert('on-foot traveller gets a walking verdict', carlessBadPlan.mode === 'walk');
assert('unreachable leg is flagged, not hidden', typeof carlessBadPlan.reachWarning === 'string');
assert('warning counts the bad legs', /One stretch/.test(carlessBadPlan.reachWarning), carlessBadPlan.reachWarning);
assert('carless transit copy does not say "car day"', !/car day/i.test(carlessBadPlan.transitNote ?? ''));

// The warning was right but the summary beside it was claiming a whole-day walking time for
// a day containing a 14-mile leg. A correct caveat next to a nonsense number is still wrong.
assert('unreachable day states no walking time',
  !/on foot/.test(carlessBadPlan.detail), carlessBadPlan.detail);
assert('unreachable day still states the distance',
  /mi across the day/.test(carlessBadPlan.detail), carlessBadPlan.detail);

const carlessGoodPlan = dayVerdict(
  [{ mode: 'walk', miles: 0.3, mins: 6 }, { mode: 'walk', miles: 0.4, mins: 8 }],
  { transit: 'no', gettingAround: 'walk' },
);
assert('a genuinely walkable day raises no warning', carlessGoodPlan.reachWarning === null);
assert('a genuinely walkable day DOES state its walking time',
  /on foot/.test(carlessGoodPlan.detail), carlessGoodPlan.detail);

const noCarWithTransit = dayVerdict(
  [{ mode: 'drive', miles: 4, mins: 9 }],
  { transit: 'yes', gettingAround: 'transit' },
);
assert('no-car + transit available → transit verdict', noCarWithTransit.mode === 'transit');
const noCarNoTransit = dayVerdict(
  [{ mode: 'walk', miles: 0.5, mins: 10 }],
  { transit: 'no', gettingAround: 'transit' },
);
assert('no-car + no transit falls back to walking, not driving', noCarNoTransit.mode === 'walk');

// Driving travellers must be completely unaffected by phase 2.
const driverUnchanged = dayVerdict(
  [{ mode: 'drive', miles: 12, mins: 20 }],
  { transit: 'no', gettingAround: 'car' },
);
assert('driver still gets the drive verdict', driverUnchanged.mode === 'drive');
assert('driver never sees a reach warning', driverUnchanged.reachWarning === null);
assert('omitting gettingAround defaults to car behaviour',
  dayVerdict([{ mode: 'drive', miles: 12, mins: 20 }], { transit: 'no' }).mode === 'drive');

console.log('constraint helpers');
assert('walking clamps the search radius hard', clampSearchMiles('walk', 25) === 3);
assert('no-car clamps less aggressively', clampSearchMiles('transit', 25) === 10);
assert('driving is not clamped', clampSearchMiles('car', 25) === 25);
assert('clamp never widens a smaller request', clampSearchMiles('transit', 2) === 2);
assert('unknown value degrades to car, not to a clamp', clampSearchMiles('nonsense', 25) === 25);
assert('walk emits a prompt constraint', synthesisConstraint('walk').length > 0);
assert('transit emits a prompt constraint', synthesisConstraint('transit').length > 0);
assert('car emits NO constraint (prompt unchanged for drivers)', synthesisConstraint('car') === '');
assert('constraint names it as hard, not a preference', /HARD CONSTRAINT/.test(synthesisConstraint('walk')));
assert('walk max leg is tighter than transit', maxLegMiles('walk') < maxLegMiles('transit'));
assert('car has no leg ceiling', maxLegMiles('car') === null);
assert('normalize rejects junk', normalizeGettingAround(undefined) === 'car' && normalizeGettingAround('walk') === 'walk');

console.log('rideshare');
const link = rideshareLink({ lat: 38.34, lng: -75.07, name: 'B' });
assert('builds a deep link', typeof link === 'string' && link.includes('m.uber.com'));
assert('claims no price or ETA', !/price|eta|minutes|available/i.test(link));
assert('null target returns null', rideshareLink(null) === null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
