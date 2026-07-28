// __tests__/local-knowledge-region.mjs — run: node __tests__/local-knowledge-region.mjs
//
// Regression guard for a shipped bug: regional advice leaked worldwide because entries were
// matched on stop NAME/ADDRESS text with no geographic gate. Two concrete symptoms:
//   · delmarva_mosquitoes_dusk had `patterns: []`, read by the matcher as "match everything",
//     so a Delmarva marsh warning appeared on outdoor stops anywhere on the planet.
//   · ocean_city_boardwalk_tip matched the bare word "Boardwalk", so Atlantic City, Santa Cruz
//     and Venice Beach got Ocean City's advice.
import { getLocalKnowledge, LOCAL_KNOWLEDGE } from '../constants/localKnowledge.js';

let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

// Real coordinates, well outside Delmarva.
const DENVER       = { lat: 39.7392, lng: -104.9903 };
const SANTA_CRUZ   = { lat: 36.9741, lng: -122.0308 };
const ATLANTIC_CTY = { lat: 39.3643, lng: -74.4229 };
const OCEAN_CITY   = { lat: 38.3365, lng: -75.0849 };
const ASSATEAGUE   = { lat: 38.2460, lng: -75.1520 };

const JULY = '2026-07-15';

console.log('structural — every entry must be geographically gated');
assert('all entries carry a bbox', LOCAL_KNOWLEDGE.every((e) => e.bbox && Number.isFinite(e.bbox.minLat)),
  LOCAL_KNOWLEDGE.filter((e) => !e.bbox).map((e) => e.id).join(', '));

console.log('the reported bug — mosquitoes outside Delmarva');
const denverPark = getLocalKnowledge({
  stopName: 'City Park', stopAddress: 'Denver, CO', category: 'outdoor',
  date: JULY, ...DENVER,
});
assert('no Delmarva mosquito warning in Denver',
  !denverPark.some((e) => e.id === 'delmarva_mosquitoes_dusk'),
  denverPark.map((e) => e.id).join(', '));
assert('no local knowledge at all in Denver', denverPark.length === 0, denverPark.map((e) => e.id).join(', '));

console.log('bare-pattern leak — "Boardwalk" anywhere');
const scBoardwalk = getLocalKnowledge({
  stopName: 'Santa Cruz Beach Boardwalk', stopAddress: 'Santa Cruz, CA', category: 'activity',
  date: JULY, ...SANTA_CRUZ,
});
assert('Santa Cruz boardwalk gets no Ocean City advice',
  !scBoardwalk.some((e) => e.id === 'ocean_city_boardwalk_tip'),
  scBoardwalk.map((e) => e.id).join(', '));

const acBoardwalk = getLocalKnowledge({
  stopName: 'Atlantic City Boardwalk', stopAddress: 'Atlantic City, NJ', category: 'outdoor',
  date: JULY, ...ATLANTIC_CTY,
});
assert('Atlantic City boardwalk gets no Ocean City advice',
  !acBoardwalk.some((e) => e.id === 'ocean_city_boardwalk_tip'),
  acBoardwalk.map((e) => e.id).join(', '));
// AC is ~90 miles north of OC but on the same coast — the bbox, not distance, is what saves us.
assert('Atlantic City gets no Delmarva peninsula advice',
  !acBoardwalk.some((e) => e.id === 'delmarva_mosquitoes_dusk'),
  acBoardwalk.map((e) => e.id).join(', '));

console.log('still works where it should');
const ocOutdoor = getLocalKnowledge({
  stopName: 'Ocean City Boardwalk', stopAddress: 'Ocean City, MD', category: 'outdoor',
  date: JULY, ...OCEAN_CITY,
});
assert('Ocean City in July still gets peninsula mosquito advice',
  ocOutdoor.some((e) => e.id === 'delmarva_mosquitoes_dusk'),
  ocOutdoor.map((e) => e.id).join(', '));

const ocBoardwalk = getLocalKnowledge({
  stopName: 'Ocean City Boardwalk', stopAddress: 'Ocean City, MD', category: 'activity',
  date: JULY, ...OCEAN_CITY,
});
assert('the real Ocean City boardwalk still gets its tip',
  ocBoardwalk.some((e) => e.id === 'ocean_city_boardwalk_tip'),
  ocBoardwalk.map((e) => e.id).join(', '));

const assateague = getLocalKnowledge({
  stopName: 'Assateague Island National Seashore', stopAddress: 'Berlin, MD', category: 'outdoor',
  date: JULY, ...ASSATEAGUE,
});
assert('Assateague still gets its own advice',
  assateague.some((e) => e.id === 'assateague_always'),
  assateague.map((e) => e.id).join(', '));

console.log('coordless stops fail safe');
const noCoords = getLocalKnowledge({
  stopName: 'Ocean City Boardwalk', stopAddress: 'Ocean City, MD', category: 'outdoor', date: JULY,
});
assert('no coordinates → no local knowledge (never text-only fallback)', noCoords.length === 0,
  noCoords.map((e) => e.id).join(', '));
assert('null coordinates → no local knowledge',
  getLocalKnowledge({ stopName: 'X', category: 'outdoor', date: JULY, lat: null, lng: null }).length === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
