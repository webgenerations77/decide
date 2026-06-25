// Cheddar's local knowledge — real-world nuance layered onto recommendations.
// Each entry fires when a card's name/address matches a pattern AND conditions match.
// severity: 'warning' (orange) | 'info' (teal) | 'tip' (gold)

export const LOCAL_KNOWLEDGE = [
  {
    id: 'assateague_biting_flies',
    patterns: ['Assateague'],
    categories: ['outdoor'],
    conditions: { months: [6, 7, 8], windDirections: ['E', 'ENE', 'ESE', 'NE', 'SE'] },
    text: 'Biting horse flies can be brutal when wind blows from the east in summer. Bug spray helps a little. Shade and a breeze make it tolerable.',
    severity: 'warning',
  },
  {
    id: 'assateague_always',
    patterns: ['Assateague'],
    categories: ['outdoor'],
    conditions: {},
    text: 'No food vendors or shade structures on the beach. Bring water, snacks, and sun protection. The wild ponies are wonderful but do not feed them.',
    severity: 'tip',
  },
  {
    id: 'ocean_city_summer_traffic',
    patterns: ['Ocean City', 'OC, MD'],
    categories: ['food', 'activity', 'outdoor', 'shopping'],
    conditions: { months: [6, 7, 8], dayOfWeek: ['Saturday', 'Sunday'] },
    text: 'Rt 50 westbound on summer weekends can be a 2–3 hour crawl. Plan to leave by noon or after 8 PM to avoid the worst of it.',
    severity: 'warning',
  },
  {
    id: 'ocean_city_boardwalk_tip',
    patterns: ['Boardwalk', 'Ocean City Boardwalk'],
    categories: ['outdoor', 'activity', 'shopping'],
    conditions: {},
    text: 'The boardwalk is best early morning (cooler, less crowded) or after 7 PM when the crowd thins and the lights come on.',
    severity: 'tip',
  },
  {
    id: 'rehoboth_parking',
    patterns: ['Rehoboth', 'Rehoboth Beach'],
    categories: ['food', 'activity', 'outdoor', 'shopping'],
    conditions: { months: [6, 7, 8] },
    text: 'Parking fills up fast on summer days. The Funland lot near Rehoboth Ave opens at 7 AM — grab a spot early or plan to walk several blocks.',
    severity: 'info',
  },
  {
    id: 'bethany_beach',
    patterns: ['Bethany', 'Bethany Beach'],
    categories: ['outdoor'],
    conditions: {},
    text: 'Quieter and more family-focused than Ocean City. Alcohol is prohibited on the beach. Easier parking than OC.',
    severity: 'tip',
  },
  {
    id: 'dewey_beach_crowds',
    patterns: ['Dewey Beach'],
    categories: ['food', 'outdoor', 'activity'],
    conditions: { months: [6, 7, 8] },
    text: 'Dewey is the party beach. Expect loud bars and a younger crowd on summer weekends. Great if that\'s your vibe — plan accordingly if it\'s not.',
    severity: 'info',
  },
  {
    id: 'fenwick_island',
    patterns: ['Fenwick Island'],
    categories: ['outdoor'],
    conditions: {},
    text: 'Delaware beach with no boardwalk and much fewer crowds than Rehoboth. Parking is easier. Strong surf on the ocean side — check flags.',
    severity: 'tip',
  },
  {
    id: 'blackwater_wildlife_refuge',
    patterns: ['Blackwater', 'Blackwater National Wildlife'],
    categories: ['outdoor'],
    conditions: { months: [10, 11, 12, 1, 2] },
    text: 'Peak season for bald eagles and migrating waterfowl is October–February. Bring binoculars. The wildlife drive is best at sunrise or dusk.',
    severity: 'tip',
  },
  {
    id: 'chincoteague_pony_swim',
    patterns: ['Chincoteague', 'Chincoteague National Wildlife'],
    categories: ['outdoor', 'activity'],
    conditions: { months: [7] },
    text: 'The famous pony swim and auction happens the last Wednesday/Thursday of July. Town gets extremely crowded that week — book accommodation months ahead.',
    severity: 'info',
  },
  {
    id: 'delmarva_mosquitoes_dusk',
    patterns: [],
    categories: ['outdoor'],
    conditions: { months: [5, 6, 7, 8, 9], timeOfDay: 'evening' },
    text: 'Mosquitoes and gnats are aggressive at dusk on the Delmarva Peninsula, especially near marshes. Bug spray with DEET is worth it.',
    severity: 'info',
  },
  {
    id: 'ocean_pines_marina',
    patterns: ['Ocean Pines', 'Ocean Pines Marina'],
    categories: ['outdoor', 'activity'],
    conditions: {},
    text: 'Nice marina area with a less touristy feel than Ocean City. Good crabbing nearby and a decent beach in season.',
    severity: 'tip',
  },
];

// Returns matching local knowledge entries for a stop given current conditions.
export function getLocalKnowledge({ stopName = '', stopAddress = '', category = '', weather = null, date = null }) {
  const nameAddr = `${stopName} ${stopAddress}`.toLowerCase();
  const month    = date ? new Date(date).getMonth() + 1 : new Date().getMonth() + 1;
  const dow      = date
    ? new Date(date).toLocaleDateString('en-US', { weekday: 'long' })
    : new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const windDir  = weather?.wind_dir ?? null;

  return LOCAL_KNOWLEDGE.filter((entry) => {
    // Check pattern match (empty patterns = matches all for category)
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
