// Local ways to get around that Google does not know about.
//
// WHY THIS FILE EXISTS: seasonal beach trolleys, resort shuttles and ferries are frequently
// missing from Google's transit data entirely — and they are the actual answer to "how do I
// get around here without moving my car" in exactly the region this app is tested in. A
// transit probe that returns "no coverage" for Ocean City is technically true and practically
// useless: the Beach Bus runs the length of Coastal Highway every day.
//
// HONESTY CONTRACT: every entry here is a curated pointer, not live data. We have no feed for
// any of these, so nothing in this file may state a departure time, a live position, or a
// current price as fact. Copy is written as "worth checking" and always carries a source URL
// the traveller can verify. Prices are described as approximate and season-dependent, because
// that is what they are. If we ever wire a real GTFS/GBFS feed, that becomes a separate
// module — this one stays the honest fallback.
//
// Follows the shape of constants/localKnowledge.js: match on region + season, return notes.

// Months are 1-indexed (1 = January) for readability. Converted at the match site.
const SUMMER = [5, 6, 7, 8, 9];      // May–September, the coastal season
const SHOULDER = [4, 5, 6, 7, 8, 9, 10];

export const LOCAL_TRANSPORT = [
  {
    id: 'oc_beach_bus',
    region: 'Ocean City, MD',
    bbox: { minLat: 38.30, maxLat: 38.47, minLng: -75.12, maxLng: -75.02 },
    months: null, // year-round service
    name: 'Ocean City Beach Bus',
    text: 'Runs the length of Coastal Highway and takes an all-day pass, so you can leave the car parked. Far more frequent in season than off.',
    url: 'https://oceancitymd.gov/oc/departments/public-works/transportation/',
  },
  {
    id: 'oc_boardwalk_tram',
    region: 'Ocean City, MD',
    bbox: { minLat: 38.32, maxLat: 38.38, minLng: -75.09, maxLng: -75.05 },
    months: SUMMER,
    name: 'Boardwalk Tram',
    text: 'Runs the boardwalk end to end in season. Worth it if you are covering the length of it with tired legs; walking is better if you want to stop.',
    url: 'https://oceancitymd.gov/oc/departments/public-works/transportation/',
  },
  {
    id: 'jolly_trolley',
    region: 'Rehoboth & Dewey Beach, DE',
    bbox: { minLat: 38.66, maxLat: 38.75, minLng: -75.12, maxLng: -75.03 },
    months: SUMMER,
    name: 'Jolly Trolley',
    text: 'Shuttles between Rehoboth and Dewey through the season and runs late on weekends — the usual answer to parking in Dewey, and to getting back afterwards.',
    url: 'https://www.jollytrolley.com/',
  },
  {
    id: 'dart_beach_service',
    region: 'Delaware beaches',
    bbox: { minLat: 38.44, maxLat: 38.82, minLng: -75.20, maxLng: -75.00 },
    months: SHOULDER,
    name: 'DART beach service',
    text: 'Delaware runs seasonal beach routes along the coast with park-and-ride lots inland. Check the current season map before relying on it — routes change year to year.',
    url: 'https://dartfirststate.com/',
  },
  {
    id: 'cape_may_lewes_ferry',
    region: 'Lewes, DE',
    bbox: { minLat: 38.73, maxLat: 38.82, minLng: -75.20, maxLng: -75.08 },
    months: null, // year-round
    name: 'Cape May–Lewes Ferry',
    text: 'Takes both cars and foot passengers across the bay to New Jersey. It is a genuine day-trip in its own right, not just a crossing — but reserve ahead in summer.',
    url: 'https://www.cmlf.com/',
  },
  {
    id: 'assateague_no_transit',
    region: 'Assateague Island',
    bbox: { minLat: 38.19, maxLat: 38.32, minLng: -75.20, maxLng: -75.10 },
    months: null,
    name: 'No transit to the island',
    text: 'Nothing serves Assateague — you drive in and pay at the gate. Cycling over from West Ocean City is doable but the bridge shoulder is narrow.',
    url: 'https://www.nps.gov/asis/planyourvisit/directions.htm',
  },
];

function inBox(lat, lng, b) {
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

/**
 * Local options for a location and date.
 *
 * @param lat/lng  the traveller's origin
 * @param date     Date | ISO string | null — controls seasonal entries
 * @returns array of { id, name, text, url } — empty outside covered regions, which is the
 *          correct and common answer. An empty array must render as nothing, never as a
 *          "no local options found" row.
 */
export function getLocalTransport(lat, lng, date = null) {
  const la = Number(lat), ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return [];

  const d = date ? new Date(date) : new Date();
  const month = Number.isNaN(d.getTime()) ? null : d.getMonth() + 1; // 1-indexed

  return LOCAL_TRANSPORT
    .filter((e) => inBox(la, ln, e.bbox))
    .filter((e) => !e.months || month == null || e.months.includes(month))
    .map(({ id, name, text, url, region }) => ({ id, name, text, url, region }));
}

/**
 * Rideshare deep link.
 *
 * Uber and Lyft both retired their public availability APIs, so we cannot know whether a car
 * is nearby, how long the wait is, or what it costs. This returns a link that opens the app
 * with the destination pre-filled and NOTHING ELSE — no ETA, no price, no "available now".
 * The UI must not imply any of those either.
 */
export function rideshareLink(to) {
  if (!to || !Number.isFinite(Number(to.lat)) || !Number.isFinite(Number(to.lng))) return null;
  const params = new URLSearchParams({
    action: 'setPickup',
    'pickup': 'my_location',
    'dropoff[latitude]': String(to.lat),
    'dropoff[longitude]': String(to.lng),
  });
  if (to.name) params.set('dropoff[nickname]', String(to.name));
  return `https://m.uber.com/ul/?${params.toString()}`;
}
