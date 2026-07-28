// Cheddar's local knowledge — real-world nuance layered onto recommendations.
// Each entry fires when a stop is INSIDE the entry's region AND its name/address matches a
// pattern AND conditions match. severity: 'warning' (orange) | 'info' (teal) | 'tip' (gold)
//
// ⚠ EVERY ENTRY MUST CARRY A `bbox`. This knowledge is region-specific, and matching on stop
// text alone leaks it worldwide. Two real bugs this caused:
//   · `delmarva_mosquitoes_dusk` had `patterns: []`, which the matcher read as "match every
//     stop" — a Delmarva marsh warning fired on outdoor stops anywhere on the planet.
//   · `ocean_city_boardwalk_tip` matched the bare word "Boardwalk", so Atlantic City, Santa
//     Cruz and Venice Beach all got Ocean City's advice.
// The geographic gate is now the FIRST check and there is no way to opt out of it. Empty
// `patterns` now means "any stop of this category within the bbox", which is a useful and
// bounded thing to say — not "everywhere".

// The Delmarva peninsula: roughly Cape Henlopen down to Cape Charles, bay to ocean. Used as
// the default region for entries about the peninsula as a whole rather than one town.
export const DELMARVA_BBOX = { minLat: 37.0, maxLat: 39.8, minLng: -76.3, maxLng: -74.9 };

export const LOCAL_KNOWLEDGE = [
  {
    id: 'assateague_biting_flies',
    bbox: { minLat: 38.05, maxLat: 38.35, minLng: -75.25, maxLng: -75.05 },
    patterns: ['Assateague'],
    categories: ['outdoor'],
    conditions: { months: [6, 7, 8], windDirections: ['E', 'ENE', 'ESE', 'NE', 'SE'] },
    text: 'Biting horse flies can be brutal when wind blows from the east in summer. Bug spray helps a little. Shade and a breeze make it tolerable.',
    severity: 'warning',
  },
  {
    id: 'assateague_always',
    bbox: { minLat: 38.05, maxLat: 38.35, minLng: -75.25, maxLng: -75.05 },
    patterns: ['Assateague'],
    categories: ['outdoor'],
    conditions: {},
    text: 'No food vendors or shade structures on the beach. Bring water, snacks, and sun protection. The wild ponies are wonderful but do not feed them.',
    severity: 'tip',
  },
  {
    id: 'ocean_city_summer_traffic',
    bbox: { minLat: 38.30, maxLat: 38.47, minLng: -75.12, maxLng: -75.02 },
    patterns: ['Ocean City', 'OC, MD'],
    categories: ['food', 'activity', 'outdoor', 'shopping'],
    conditions: { months: [6, 7, 8], dayOfWeek: ['Saturday', 'Sunday'] },
    text: 'Rt 50 westbound on summer weekends can be a 2–3 hour crawl. Plan to leave by noon or after 8 PM to avoid the worst of it.',
    severity: 'warning',
  },
  {
    id: 'ocean_city_boardwalk_tip',
    bbox: { minLat: 38.32, maxLat: 38.40, minLng: -75.10, maxLng: -75.04 },
    // NOT a bare 'Boardwalk' — that matched Atlantic City, Santa Cruz and Venice Beach too.
    // The bbox now gates it geographically, but the pattern is tightened as well so the
    // entry can't fire on some unrelated boardwalk that happens to fall inside the box.
    patterns: ['Ocean City Boardwalk', 'OC Boardwalk'],
    categories: ['outdoor', 'activity', 'shopping'],
    conditions: {},
    text: 'The boardwalk is best early morning (cooler, less crowded) or after 7 PM when the crowd thins and the lights come on.',
    severity: 'tip',
  },
  {
    id: 'rehoboth_parking',
    bbox: { minLat: 38.68, maxLat: 38.75, minLng: -75.10, maxLng: -75.04 },
    patterns: ['Rehoboth', 'Rehoboth Beach'],
    categories: ['food', 'activity', 'outdoor', 'shopping'],
    conditions: { months: [6, 7, 8] },
    text: 'Parking fills up fast on summer days. The Funland lot near Rehoboth Ave opens at 7 AM — grab a spot early or plan to walk several blocks.',
    severity: 'info',
  },
  {
    id: 'bethany_beach',
    bbox: { minLat: 38.51, maxLat: 38.56, minLng: -75.08, maxLng: -75.03 },
    patterns: ['Bethany', 'Bethany Beach'],
    categories: ['outdoor'],
    conditions: {},
    text: 'Quieter and more family-focused than Ocean City. Alcohol is prohibited on the beach. Easier parking than OC.',
    severity: 'tip',
  },
  {
    id: 'dewey_beach_crowds',
    bbox: { minLat: 38.66, maxLat: 38.70, minLng: -75.09, maxLng: -75.04 },
    patterns: ['Dewey Beach'],
    categories: ['food', 'outdoor', 'activity'],
    conditions: { months: [6, 7, 8] },
    text: 'Dewey is the party beach. Expect loud bars and a younger crowd on summer weekends. Great if that\'s your vibe — plan accordingly if it\'s not.',
    severity: 'info',
  },
  {
    id: 'fenwick_island',
    bbox: { minLat: 38.44, maxLat: 38.48, minLng: -75.08, maxLng: -75.02 },
    patterns: ['Fenwick Island'],
    categories: ['outdoor'],
    conditions: {},
    text: 'Delaware beach with no boardwalk and much fewer crowds than Rehoboth. Parking is easier. Strong surf on the ocean side — check flags.',
    severity: 'tip',
  },
  {
    id: 'blackwater_wildlife_refuge',
    bbox: { minLat: 38.30, maxLat: 38.52, minLng: -76.20, maxLng: -75.95 },
    patterns: ['Blackwater', 'Blackwater National Wildlife'],
    categories: ['outdoor'],
    conditions: { months: [10, 11, 12, 1, 2] },
    text: 'Peak season for bald eagles and migrating waterfowl is October–February. Bring binoculars. The wildlife drive is best at sunrise or dusk.',
    severity: 'tip',
  },
  {
    id: 'chincoteague_pony_swim',
    bbox: { minLat: 37.85, maxLat: 38.05, minLng: -75.45, maxLng: -75.20 },
    patterns: ['Chincoteague', 'Chincoteague National Wildlife'],
    categories: ['outdoor', 'activity'],
    conditions: { months: [7] },
    text: 'The famous pony swim and auction happens the last Wednesday/Thursday of July. Town gets extremely crowded that week — book accommodation months ahead.',
    severity: 'info',
  },
  {
    id: 'delmarva_mosquitoes_dusk',
    bbox: DELMARVA_BBOX,
    // Intentionally empty: this applies to ANY outdoor stop on the peninsula, not to a named
    // place. That is only safe because bbox is now checked first — before the geographic gate
    // existed, this fired on every outdoor stop in the world.
    patterns: [],
    categories: ['outdoor'],
    conditions: { months: [5, 6, 7, 8, 9], timeOfDay: 'evening' },
    text: 'Mosquitoes and gnats are aggressive at dusk on the Delmarva Peninsula, especially near marshes. Bug spray with DEET is worth it.',
    severity: 'info',
  },
  {
    id: 'ocean_pines_marina',
    bbox: { minLat: 38.36, maxLat: 38.44, minLng: -75.20, maxLng: -75.10 },
    patterns: ['Ocean Pines', 'Ocean Pines Marina'],
    categories: ['outdoor', 'activity'],
    conditions: {},
    text: 'Nice marina area with a less touristy feel than Ocean City. Good crabbing nearby and a decent beach in season.',
    severity: 'tip',
  },
];

function withinBbox(lat, lng, b) {
  if (!b) return false;
  const la = Number(lat), ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  return la >= b.minLat && la <= b.maxLat && ln >= b.minLng && ln <= b.maxLng;
}

// Returns matching local knowledge entries for a stop given current conditions.
//
// `lat`/`lng` are REQUIRED for anything to match. A stop with no coordinates returns no local
// knowledge at all — that is the correct, safe answer. The alternative (falling back to text
// matching) is what leaked Delmarva mosquito warnings and Ocean City boardwalk advice into
// plans in completely different states.
export function getLocalKnowledge({ stopName = '', stopAddress = '', category = '', weather = null, date = null, lat = null, lng = null }) {
  const nameAddr = `${stopName} ${stopAddress}`.toLowerCase();
  const month    = date ? new Date(date).getMonth() + 1 : new Date().getMonth() + 1;
  const dow      = date
    ? new Date(date).toLocaleDateString('en-US', { weekday: 'long' })
    : new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const windDir  = weather?.wind_dir ?? null;

  return LOCAL_KNOWLEDGE.filter((entry) => {
    // GEOGRAPHIC GATE FIRST, and there is no opting out of it. This is the check whose absence
    // put Delmarva mosquitoes and Ocean City parking advice on stops in other states.
    if (!withinBbox(lat, lng, entry.bbox)) return false;

    // Empty patterns now means "any stop of this category inside the bbox" — bounded by the
    // gate above — rather than the old "matches everything, everywhere".
    const patternsMatch =
      entry.patterns.length === 0 ||
      entry.patterns.some((p) => nameAddr.includes(p.toLowerCase()));
    if (!patternsMatch) return false;

    // Check category
    if (entry.categories.length > 0 && !entry.categories.includes(category)) return false;

    // Check conditions
    const { conditions } = entry;
    if (conditions.months?.length && !conditions.months.includes(month)) return false;
    if (conditions.dayOfWeek?.length && !conditions.dayOfWeek.includes(dow)) return false;
    if (conditions.windDirections?.length && windDir && !conditions.windDirections.includes(windDir)) return false;

    return true;
  });
}

// Returns allergy/sensitivity warnings for a stop
export function getAllergyAlerts({ category, stopName = '', stopAddress = '', sensitivities = [] }) {
  if (!sensitivities.length) return [];
  const alerts = [];
  const nameAddr = `${stopName} ${stopAddress}`.toLowerCase();

  const foodAllergens = ['Peanuts', 'Shellfish', 'Gluten', 'Dairy', 'Eggs', 'Soy', 'Tree Nuts', 'Fish'];
  const envAllergens  = ['Bees/Stinging Insects', 'Pollen', 'Cut Grass', 'Pet Dander', 'Mold', 'Strong Fragrances'];

  if (category === 'food') {
    const relevant = sensitivities.filter((s) => foodAllergens.includes(s));
    if (relevant.length) {
      const seafoodTerms = ['seafood', 'fish', 'crab', 'shrimp', 'lobster', 'oyster', 'sushi'];
      const isSeafood = seafoodTerms.some((t) => nameAddr.includes(t));
      relevant.forEach((s) => {
        if ((s === 'Shellfish' || s === 'Fish') && isSeafood) {
          alerts.push({ sensitivity: s, text: `Shellfish/fish likely present — review the menu.` });
        } else if (s !== 'Shellfish' && s !== 'Fish') {
          alerts.push({ sensitivity: s, text: `Ask about ${s.toLowerCase()} when ordering.` });
        }
      });
    }
  }

  if (category === 'outdoor') {
    const envRelevant = sensitivities.filter((s) => envAllergens.includes(s));
    envRelevant.forEach((s) => {
      if (s === 'Pollen')  alerts.push({ sensitivity: s, text: 'Outdoor pollen exposure — check today\'s pollen count.' });
      if (s === 'Bees/Stinging Insects') alerts.push({ sensitivity: s, text: 'Stinging insects may be present. Carry an EpiPen if prescribed.' });
      if (s === 'Cut Grass') alerts.push({ sensitivity: s, text: 'Freshly mowed areas likely. Antihistamines recommended.' });
      if (s === 'Mold') alerts.push({ sensitivity: s, text: 'Mold spores can be elevated near water and wooded areas.' });
    });
  }

  return alerts;
}
