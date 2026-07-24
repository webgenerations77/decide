import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  DISPLAY_NAME:       '@decide/display_name',
  AVATAR:             '@decide/avatar',
  LOCATION_MODE:      '@decide/location_mode',
  MANUAL_LOCATION:    '@decide/manual_location',  // { text, label, short, latitude, longitude }
  CUISINES:           '@decide/cuisines',
  DIETARY:            '@decide/dietary',
  ACTIVITY_STYLES:    '@decide/activity_styles',
  INTERESTS:          '@decide/interests',        // Taste Profile: niche hunt-able tags
  LOVED_PLACES:       '@decide/loved_places',      // Taste Profile: place names the traveler loves
  AVOIDED_PLACES:     '@decide/avoided_places',    // Taste Profile: place names to never resurface
  SENSITIVITIES:      '@decide/sensitivities',    // array of sensitivity names (food + environmental)
  NEURODIVERGENT:     '@decide/neurodivergent',   // boolean — sensory-friendly itinerary bias
  MAX_DISTANCE:       '@decide/max_distance',
  DEFAULT_PACE:       '@decide/default_pace',
  DEFAULT_BUDGET:     '@decide/default_budget',
  DEFAULT_GROUP:      '@decide/default_group',
  DEFAULT_START_TIME: '@decide/default_start_time',
  DEFAULT_END_TIME:   '@decide/default_end_time',
  NOTIFICATIONS:      '@decide/notifications',
  TOS_ACCEPTED:       '@decide/tos_accepted',     // ISO timestamp of acceptance
  THEME_MODE:         '@decide/theme_mode',          // 'auto' | 'light' | 'dark'
  COLLAPSED_SECTIONS: '@decide/collapsed_sections',  // JSON map { [sectionKey]: boolean }
};

const DEFAULTS = {
  displayName:    '',
  avatar:         'Explorer',
  locationMode:   'auto',
  manualLocation: null,
  cuisines:       [],
  dietary:        [],
  activityStyles: [],
  interests:      [],
  lovedPlaces:    [],
  avoidedPlaces:  [],
  sensitivities:  [],
  neurodivergent: false,
  maxDistance:    10,
  pace:           'moderate',
  budget:         '$$',
  group:          'couple',
  startTime:      '11:00 AM',
  endTime:        '8:00 PM',
  notifications:  false,
  tosAccepted:    null,
};

function parse(raw) {
  if (raw === null || raw === undefined) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

export async function loadAllSettings() {
  try {
    const pairs = await AsyncStorage.multiGet(Object.values(KEYS).filter((k) => k !== KEYS.TOS_ACCEPTED));
    const map = Object.fromEntries(pairs.map(([k, v]) => [k, parse(v)]));
    return {
      displayName:    map[KEYS.DISPLAY_NAME]       ?? DEFAULTS.displayName,
      avatar:         map[KEYS.AVATAR]              ?? DEFAULTS.avatar,
      locationMode:   map[KEYS.LOCATION_MODE]       ?? DEFAULTS.locationMode,
      manualLocation: map[KEYS.MANUAL_LOCATION]     ?? DEFAULTS.manualLocation,
      cuisines:       map[KEYS.CUISINES]            ?? DEFAULTS.cuisines,
      dietary:        map[KEYS.DIETARY]             ?? DEFAULTS.dietary,
      activityStyles: map[KEYS.ACTIVITY_STYLES]     ?? DEFAULTS.activityStyles,
      interests:      map[KEYS.INTERESTS]           ?? DEFAULTS.interests,
      lovedPlaces:    map[KEYS.LOVED_PLACES]        ?? DEFAULTS.lovedPlaces,
      avoidedPlaces:  map[KEYS.AVOIDED_PLACES]      ?? DEFAULTS.avoidedPlaces,
      sensitivities:  map[KEYS.SENSITIVITIES]       ?? DEFAULTS.sensitivities,
      neurodivergent: map[KEYS.NEURODIVERGENT]      ?? DEFAULTS.neurodivergent,
      maxDistance:    map[KEYS.MAX_DISTANCE]        ?? DEFAULTS.maxDistance,
      pace:           map[KEYS.DEFAULT_PACE]        ?? DEFAULTS.pace,
      budget:         map[KEYS.DEFAULT_BUDGET]      ?? DEFAULTS.budget,
      group:          map[KEYS.DEFAULT_GROUP]       ?? DEFAULTS.group,
      startTime:      map[KEYS.DEFAULT_START_TIME]  ?? DEFAULTS.startTime,
      endTime:        map[KEYS.DEFAULT_END_TIME]    ?? DEFAULTS.endTime,
      notifications:  map[KEYS.NOTIFICATIONS]       ?? DEFAULTS.notifications,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function loadPlanDefaults() {
  try {
    const [[, p], [, b], [, g], [, s], [, e], [, c]] = await AsyncStorage.multiGet([
      KEYS.DEFAULT_PACE, KEYS.DEFAULT_BUDGET, KEYS.DEFAULT_GROUP,
      KEYS.DEFAULT_START_TIME, KEYS.DEFAULT_END_TIME, KEYS.CUISINES,
    ]);
    return {
      pace:      p ?? DEFAULTS.pace,
      budget:    b ?? DEFAULTS.budget,
      group:     g ?? DEFAULTS.group,
      startTime: s ?? DEFAULTS.startTime,
      endTime:   e ?? DEFAULTS.endTime,
      cuisines:  c ? JSON.parse(c) : DEFAULTS.cuisines,
    };
  } catch {
    return { pace: DEFAULTS.pace, budget: DEFAULTS.budget, group: DEFAULTS.group, startTime: DEFAULTS.startTime, endTime: DEFAULTS.endTime, cuisines: DEFAULTS.cuisines };
  }
}

// Standing signals the discovery scout uses as fuel beyond the per-trip note. Always array-safe:
// coerces missing/malformed storage to []. See docs/superpowers/specs/2026-07-24-taste-profile-design.md
export async function loadTasteProfile() {
  const arr = (v) => (Array.isArray(v) ? v : []);
  try {
    const [[, i], [, l], [, a]] = await AsyncStorage.multiGet([
      KEYS.INTERESTS, KEYS.LOVED_PLACES, KEYS.AVOIDED_PLACES,
    ]);
    return {
      interests:     arr(parse(i)),
      lovedPlaces:   arr(parse(l)),
      avoidedPlaces: arr(parse(a)),
    };
  } catch {
    return { interests: [], lovedPlaces: [], avoidedPlaces: [] };
  }
}

export async function loadLocationSettings() {
  try {
    const [[, modeRaw], [, locRaw]] = await AsyncStorage.multiGet([
      KEYS.LOCATION_MODE, KEYS.MANUAL_LOCATION,
    ]);
    return {
      locationMode:   modeRaw   ?? DEFAULTS.locationMode,
      manualLocation: locRaw ? JSON.parse(locRaw) : null,
    };
  } catch {
    return { locationMode: 'auto', manualLocation: null };
  }
}

export function save(key, value) {
  const raw = (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    ? String(value)
    : JSON.stringify(value);
  AsyncStorage.setItem(key, raw).catch(() => {});
}
