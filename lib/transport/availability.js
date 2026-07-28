// What ways of getting around actually EXIST where the traveller is standing.
//
// WHY THIS FILE EXISTS: "how are you getting around today?" only has three honest answers
// (drive / walk / no car), but "no car" means something completely different in Manhattan
// than it does in Berlin, Maryland. Offering a bare "No car" pill in both places tells the
// traveller nothing and quietly promises a bus that may not exist. This module turns that
// one abstract choice into the named services that are genuinely there — the Beach Bus, the
// MBTA, the Jolly Trolley — and shows nothing where nothing runs.
//
// ⚠ NO NETWORK. This is deliberate and must stay that way. Answering "is there transit here"
// with a live routing probe would mean a billed API call every time someone opens the plan
// screen, before they have even asked for a plan — see the COST DESIGN note in this folder's
// README-in-CLAUDE.md. Everything below is derived from coordinates alone.
//
// ⚠ HONESTY CONTRACT (inherited from local.js, and it binds this file too): these are curated
// pointers, not live feeds. Nothing here may state a departure time, a live position, or a
// current fare as fact. Copy says "worth checking" and carries a URL the traveller can verify.
// Coverage is knowingly partial: absence of an entry means WE don't know of service, which is
// not the same as there being none. The empty state has to say that, not imply a desert.

import { getLocalTransport } from './local.js';

/**
 * Metro areas where public transit is unambiguously a real way to spend a day without a car.
 *
 * Bounding boxes are deliberately coarse — they answer "is transit a serious option around
 * here", not "is there a stop on this corner". Naming the operator matters: "Take transit" is
 * advice, "the MBTA" is a thing you can actually look up. Same reason the leg-alternatives
 * sheet names the line rather than the mode.
 *
 * Adding a city is a one-line change. Getting a city wrong is worse than omitting it, so only
 * systems that carry a normal visitor through a normal day belong here.
 */
export const TRANSIT_SYSTEMS = [
  { id: 'mta_nyc',      name: 'Subway & buses',      operator: 'MTA',              icon: 'subway-outline', bbox: { minLat: 40.49, maxLat: 41.05, minLng: -74.30, maxLng: -73.68 }, url: 'https://new.mta.info/' },
  { id: 'njt',          name: 'PATH & NJ Transit',   operator: 'NJ Transit',       icon: 'train-outline',  bbox: { minLat: 40.60, maxLat: 40.95, minLng: -74.45, maxLng: -74.02 }, url: 'https://www.njtransit.com/' },
  { id: 'septa',        name: 'SEPTA',               operator: 'SEPTA',            icon: 'train-outline',  bbox: { minLat: 39.85, maxLat: 40.14, minLng: -75.30, maxLng: -74.95 }, url: 'https://www.septa.org/' },
  { id: 'wmata',        name: 'Metro',               operator: 'WMATA',            icon: 'subway-outline', bbox: { minLat: 38.79, maxLat: 39.12, minLng: -77.25, maxLng: -76.85 }, url: 'https://www.wmata.com/' },
  { id: 'mdot_mta',     name: 'Light RailLink & Metro', operator: 'Maryland MTA',  icon: 'train-outline',  bbox: { minLat: 39.19, maxLat: 39.42, minLng: -76.75, maxLng: -76.45 }, url: 'https://www.mta.maryland.gov/' },
  { id: 'mbta',         name: 'The T',               operator: 'MBTA',             icon: 'subway-outline', bbox: { minLat: 42.22, maxLat: 42.45, minLng: -71.20, maxLng: -70.95 }, url: 'https://www.mbta.com/' },
  { id: 'cta',          name: 'The ‘L’ & buses',     operator: 'CTA',              icon: 'train-outline',  bbox: { minLat: 41.64, maxLat: 42.07, minLng: -87.94, maxLng: -87.52 }, url: 'https://www.transitchicago.com/' },
  { id: 'muni_bart',    name: 'Muni & BART',         operator: 'SFMTA',            icon: 'train-outline',  bbox: { minLat: 37.70, maxLat: 37.84, minLng: -122.53, maxLng: -122.35 }, url: 'https://www.sfmta.com/' },
  { id: 'bart_eastbay', name: 'BART',                operator: 'BART',             icon: 'train-outline',  bbox: { minLat: 37.70, maxLat: 37.90, minLng: -122.35, maxLng: -122.10 }, url: 'https://www.bart.gov/' },
  { id: 'la_metro',     name: 'Metro rail & buses',  operator: 'LA Metro',         icon: 'train-outline',  bbox: { minLat: 33.70, maxLat: 34.34, minLng: -118.67, maxLng: -118.10 }, url: 'https://www.metro.net/' },
  { id: 'sound_transit',name: 'Link & King County Metro', operator: 'Sound Transit', icon: 'train-outline', bbox: { minLat: 47.45, maxLat: 47.75, minLng: -122.45, maxLng: -122.22 }, url: 'https://www.soundtransit.org/' },
  { id: 'trimet',       name: 'MAX & buses',         operator: 'TriMet',           icon: 'train-outline',  bbox: { minLat: 45.42, maxLat: 45.63, minLng: -122.85, maxLng: -122.45 }, url: 'https://trimet.org/' },
  { id: 'rtd_denver',   name: 'Light rail & buses',  operator: 'RTD',              icon: 'train-outline',  bbox: { minLat: 39.60, maxLat: 39.90, minLng: -105.15, maxLng: -104.75 }, url: 'https://www.rtd-denver.com/' },
  { id: 'marta',        name: 'MARTA',               operator: 'MARTA',            icon: 'subway-outline', bbox: { minLat: 33.63, maxLat: 33.92, minLng: -84.55, maxLng: -84.28 }, url: 'https://www.itsmarta.com/' },
  { id: 'miami_dade',   name: 'Metrorail & Metromover', operator: 'Miami-Dade Transit', icon: 'train-outline', bbox: { minLat: 25.65, maxLat: 25.95, minLng: -80.35, maxLng: -80.12 }, url: 'https://www.miamidade.gov/global/transportation/home.page' },
  { id: 'metro_transit',name: 'Light rail & buses',  operator: 'Metro Transit',    icon: 'train-outline',  bbox: { minLat: 44.85, maxLat: 45.10, minLng: -93.35, maxLng: -93.02 }, url: 'https://www.metrotransit.org/' },
  { id: 'sd_mts',       name: 'The Trolley',         operator: 'San Diego MTS',    icon: 'train-outline',  bbox: { minLat: 32.60, maxLat: 32.90, minLng: -117.25, maxLng: -116.95 }, url: 'https://www.sdmts.com/' },
  { id: 'dart_dallas',  name: 'DART rail & buses',   operator: 'DART',             icon: 'train-outline',  bbox: { minLat: 32.65, maxLat: 33.02, minLng: -96.95, maxLng: -96.60 }, url: 'https://www.dart.org/' },
  { id: 'houston_metro',name: 'METRORail & buses',   operator: 'Houston METRO',    icon: 'train-outline',  bbox: { minLat: 29.60, maxLat: 29.90, minLng: -95.55, maxLng: -95.24 }, url: 'https://www.ridemetro.org/' },
  { id: 'valley_metro', name: 'Light rail & buses',  operator: 'Valley Metro',     icon: 'train-outline',  bbox: { minLat: 33.35, maxLat: 33.60, minLng: -112.20, maxLng: -111.85 }, url: 'https://www.valleymetro.org/' },
  { id: 'nola_rta',     name: 'Streetcars & buses',  operator: 'New Orleans RTA',  icon: 'train-outline',  bbox: { minLat: 29.90, maxLat: 30.03, minLng: -90.14, maxLng: -89.98 }, url: 'https://www.norta.com/' },
  { id: 'pgh_prt',      name: 'The T & buses',       operator: 'Pittsburgh Regional Transit', icon: 'train-outline', bbox: { minLat: 40.36, maxLat: 40.51, minLng: -80.09, maxLng: -79.86 }, url: 'https://www.rideprt.org/' },
  { id: 'stl_metro',    name: 'MetroLink',           operator: 'Metro Transit St. Louis', icon: 'train-outline', bbox: { minLat: 38.55, maxLat: 38.75, minLng: -90.35, maxLng: -90.15 }, url: 'https://www.metrostlouis.org/' },
  { id: 'uta_trax',     name: 'TRAX',                operator: 'UTA',              icon: 'train-outline',  bbox: { minLat: 40.65, maxLat: 40.82, minLng: -111.98, maxLng: -111.80 }, url: 'https://www.rideuta.com/' },
  { id: 'rtc_vegas',    name: 'RTC buses',           operator: 'RTC of Southern Nevada', icon: 'bus-outline', bbox: { minLat: 36.05, maxLat: 36.25, minLng: -115.30, maxLng: -115.10 }, url: 'https://www.rtcsnv.com/' },
  { id: 'thebus_hnl',   name: 'TheBus',              operator: 'TheBus',           icon: 'bus-outline',    bbox: { minLat: 21.25, maxLat: 21.40, minLng: -158.05, maxLng: -157.75 }, url: 'https://www.thebus.org/' },
  { id: 'capmetro',     name: 'CapMetro',            operator: 'CapMetro',         icon: 'bus-outline',    bbox: { minLat: 30.18, maxLat: 30.45, minLng: -97.85, maxLng: -97.65 }, url: 'https://www.capmetro.org/' },
  { id: 'dart_wilm',    name: 'DART First State',    operator: 'DART First State', icon: 'bus-outline',    bbox: { minLat: 39.62, maxLat: 39.83, minLng: -75.65, maxLng: -75.42 }, url: 'https://dartfirststate.com/' },
  { id: 'shore_transit',name: 'Shore Transit',       operator: 'Shore Transit',    icon: 'bus-outline',    bbox: { minLat: 38.05, maxLat: 38.65, minLng: -75.90, maxLng: -75.30 }, url: 'https://www.shoretransit.org/' },
];

/**
 * Rideshare is the honest floor. It is not location-filtered, because we have no way to filter
 * it: Uber and Lyft both retired their public availability APIs, so nobody outside those
 * companies can say whether a car is nearby. It is offered everywhere and claims nothing —
 * no ETA, no price, no "available now". In a place with no bus it is not a consolation prize,
 * it IS the answer, and saying so plainly beats showing an empty list.
 */
export const RIDESHARE_OPTION = {
  id: 'rideshare',
  kind: 'rideshare',
  label: 'Rideshare',
  icon: 'car-outline',
  note: 'We can’t see whether cars are nearby — nobody outside Uber and Lyft can. Assume it works in and around town, and check the app before you count on it late at night.',
  url: null,
};

function inBox(lat, lng, b) {
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

/**
 * The transit options genuinely available at a location, best first.
 *
 * Order is the recommendation: a curated local service beats a generic system, because the
 * Beach Bus is the actual answer in Ocean City and "Shore Transit" is the technically-correct
 * one. Rideshare is always last and always present.
 *
 * @param {object}  where           { latitude, longitude } — nullish while GPS is still resolving
 * @param {Date|string|null} date   controls seasonal services (the trolley does not run in January)
 * @returns {Array<{id, kind, label, icon, note, url}>}
 */
export function getTransitOptions(where, date = null) {
  const lat = Number(where?.latitude ?? where?.lat);
  const lng = Number(where?.longitude ?? where?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  // Curated regional services first. local.js also carries deliberate NEGATIVE entries
  // ("nothing serves Assateague") — those are a warning, never a thing you can select.
  const local = getLocalTransport(lat, lng, date)
    .filter((e) => !e.unavailable)
    .map((e) => ({
      id: e.id,
      kind: 'local',
      label: e.name,
      icon: e.id.includes('ferry') ? 'boat-outline' : e.id.includes('tram') || e.id.includes('trolley') ? 'train-outline' : 'bus-outline',
      note: e.text,
      url: e.url,
    }));

  const systems = TRANSIT_SYSTEMS
    .filter((s) => inBox(lat, lng, s.bbox))
    // A local entry sourced from the same operator would read as the same thing twice.
    .filter((s) => !local.some((l) => l.url && s.url && l.url === s.url))
    .map((s) => ({
      id: s.id,
      kind: 'system',
      label: s.name,
      icon: s.icon,
      note: `Run by ${s.operator}. Check the current map and times before you rely on a late return.`,
      url: s.url,
    }));

  return [...local, ...systems, RIDESHARE_OPTION];
}

/**
 * The one we pick for them. Decide commits to a plan rather than handing over a menu, so the
 * carless traveller gets a working default the moment they tap "Without a car" — they change
 * it only if they disagree. Returns null when there is nothing to pick.
 */
export function defaultTransitPref(options) {
  return options?.[0]?.id ?? null;
}

/** True when the only thing we can offer is the rideshare floor — the empty state, honestly named. */
export function onlyRideshare(options) {
  return Array.isArray(options) && options.length === 1 && options[0].id === RIDESHARE_OPTION.id;
}

/**
 * The line handed to the synthesis prompt. Deliberately narrow: it tells the model what the
 * traveller will be RIDING, on top of the hard carless constraint that gettingAround already
 * injects. Empty string when there is nothing specific to say, so the prompt does not grow a
 * sentence that means nothing.
 *
 * Takes the id and the human label rather than the options array, because the server never
 * rebuilds that array — the client already resolved the choice and sends both across.
 *
 * @param {{id: string|null, label: string|null}} pick
 */
export function transitPrefConstraint(pick) {
  if (!pick?.id || !pick?.label) return '';
  if (pick.id === RIDESHARE_OPTION.id) {
    return 'GETTING AROUND — they expect to use rideshare between stops. Keep hops short and '
      + 'pick places a driver can actually reach and pull up to; nowhere down an unpaved access '
      + 'road, and nowhere they would struggle to get picked up from after dark.';
  }
  return `GETTING AROUND — they intend to use ${pick.label}. Favour stops on or near that `
    + 'service\'s route so the day works without a car, and prefer a walkable cluster at each '
    + 'end over a stop that needs a separate connection.';
}
