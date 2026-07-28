// Google Routes API client — the only network layer in lib/transport/.
//
// SPEND SHAPE (this is the whole reason the module is written this way):
// Nobody needs an API to know a 22-mile leg is a drive, or that 300 feet is a walk. We call
// out to real road geometry ONLY for legs in the 0.3–3 mi band where "can I actually walk
// this?" is a genuine question — typically 0–2 legs per itinerary — plus a transit coverage
// probe that is cached per region per day and therefore near-free across users in the same area.
//
// Billable elements per itinerary:
//   ambiguous legs        N        (typically 1–2)
//   transit probe         1        cached per region+day
//   + transit fallback    1        only when transit is absent, to tell "no service here"
//                                  apart from "the API did not answer" — see probeTransit
//   + line naming         1        ONE computeRoutes call, and ONLY on a day whose verdict
//                                  came back 'transit'. Deliberately budgeted: the matrix
//                                  cannot name a line, so a verdict of "Take transit" with no
//                                  train attached is close to useless in a city — that was the
//                                  gap a real Brooklyn day exposed. A drive day never pays it,
//                                  which is most days outside a metro. Cached per point pair,
//                                  so it is also free on a re-generate over the same stretch.
// Against a 10,000/month Essentials free tier, that is roughly 3,000–4,000 itineraries free.
//
// Every request is ONE origin and ONE destination. Route Matrix bills per element
// (origins × destinations), so batching N pairs into a single matrix to read its diagonal
// would bill N² for N answers. Requests fire in parallel, so N pairs still cost one round trip.
//
// Billing note: we deliberately do NOT send routingPreference TRAFFIC_AWARE or
// TRAFFIC_AWARE_OPTIMAL. Those modifiers are what promote a request from the Essentials SKU
// ($5/1k, 10k free/mo) to Pro ($10/1k, 5k free/mo), and traffic-accurate drive times are not
// what this feature is deciding — walkability is.
//
// Key: GOOGLE_ROUTES_API_KEY if set, else the existing Places key. Routes is a separate API
// that must be enabled on the project; the split lets the key be scoped independently later
// without touching this file.

import { logUsage } from '../usageLog.js';

const ROUTES_KEY =
  process.env.GOOGLE_ROUTES_API_KEY ||
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

const MATRIX_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
// computeRoutes, not computeRouteMatrix: the matrix returns summary numbers only, so it can
// answer "is there a transit route" but never "which train". Naming the line is the whole
// difference between useful and useless advice in a city — "Take transit" without "the 6 to
// Astor Place" is not something a friend would say.
const COMPUTE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const WALK_MPH = 3.0;

// ─── Cache ────────────────────────────────────────────────────────────────────
// Matches the module-level Map + TTL pattern already used for places/weather/geocode in the
// itinerary handlers. Anchored on globalThis because this project bundles the same module
// twice across the ESM/CJS boundary — a plain module singleton would give each copy its own
// empty cache and silently double the spend (the bug that bit usageContext).
globalThis.__decideTransportCache ??= new Map();
const cache = globalThis.__decideTransportCache;

const LEG_TTL     = 7 * 24 * 60 * 60 * 1000;  // road geometry between two fixed points is stable
const TRANSIT_TTL = 12 * 60 * 60 * 1000;      // coverage can change with season/service changes

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > hit.ttl) { cache.delete(key); return null; }
  return hit.data;
}

function cacheSet(key, data, ttl) {
  // Bounded: this lives for the life of a warm serverless instance, so evict oldest on growth.
  if (cache.size > 500) {
    for (const k of [...cache.keys()].slice(0, 100)) cache.delete(k);
  }
  cache.set(key, { data, ts: Date.now(), ttl });
}

// ~3 decimal places ≈ 110m — close enough that two nearby requests share a cache entry,
// precise enough that distinct venues don't collide.
const r3 = (n) => Math.round(Number(n) * 1000) / 1000;
const pointKey = (p) => `${r3(p.lat)},${r3(p.lng)}`;

const waypoint = (p) => ({
  waypoint: { location: { latLng: { latitude: Number(p.lat), longitude: Number(p.lng) } } },
});

function durationToMins(d) {
  if (!d) return null;
  const secs = typeof d === 'string' ? parseFloat(d.replace('s', '')) : Number(d);
  return Number.isFinite(secs) ? Math.max(1, Math.round(secs / 60)) : null;
}

/**
 * One computeRouteMatrix call for a SINGLE origin/destination pair — exactly 1 billable element.
 *
 * Deliberately one pair per request rather than batching N pairs into one matrix. Route Matrix
 * bills per ELEMENT (origins × destinations), so sending N origins and N destinations to read
 * only the diagonal would bill N² elements for N answers — 9 elements to answer 3 questions.
 * These fire in parallel, so N pairs still cost one round trip of latency.
 *
 * Returns null on any failure — transport is an enhancement, never a reason for an itinerary
 * request to fail.
 */
async function routePair(from, to, travelMode) {
  if (!ROUTES_KEY) return null;
  try {
    const res = await fetch(`${MATRIX_URL}?key=${ROUTES_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Requesting only these fields keeps the response in the Essentials tier.
        'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition',
      },
      body: JSON.stringify({
        origins: [waypoint(from)],
        destinations: [waypoint(to)],
        travelMode,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    logUsage({
      route: 'routes-matrix',
      model: `google-routes-${String(travelMode).toLowerCase()}`,
      requests: 1,
    });
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return null;
    // ROUTE_NOT_FOUND is the honest answer for "you cannot walk across this inlet".
    if (row.condition && row.condition !== 'ROUTE_EXISTS') return null;
    return row;
  } catch {
    return null;
  }
}

/**
 * A single TRANSIT route WITH line details — which train, which bus, how many stops.
 *
 * Called on demand from the leg-alternatives sheet, and at most ONCE during generation to name
 * the line on a transit day (see nameDayTransit). Never per leg: this is one computeRoutes
 * query per call, and paying it for every leg of every itinerary is the spend the
 * ambiguous-band design exists to avoid.
 *
 * Cached per rounded point pair, so the generation-time call and a later tap on the same
 * stretch share one answer.
 *
 * Returns null when there is no transit route, which is the common case outside metros.
 */
export async function transitRoute(from, to) {
  if (!ROUTES_KEY || !from || !to) return null;
  const cacheKey = `transitline:${pointKey(from)}>${pointKey(to)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached.route;
  try {
    const res = await fetch(`${COMPUTE_ROUTES_URL}?key=${ROUTES_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-FieldMask': [
          'routes.duration',
          'routes.distanceMeters',
          'routes.legs.steps.transitDetails.transitLine.name',
          'routes.legs.steps.transitDetails.transitLine.nameShort',
          'routes.legs.steps.transitDetails.transitLine.vehicle.type',
          'routes.legs.steps.transitDetails.stopDetails.departureStop.name',
        ].join(','),
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: Number(from.lat), longitude: Number(from.lng) } } },
        destination: { location: { latLng: { latitude: Number(to.lat), longitude: Number(to.lng) } } },
        travelMode: 'TRANSIT',
        // Fewer transfers beats marginally faster when someone is following a plan in an
        // unfamiliar city — a missed connection costs more than the minutes it saved.
        transitPreferences: { routingPreference: 'FEWER_TRANSFERS' },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    logUsage({ route: 'routes-compute', model: 'google-routes-transit', requests: 1 });

    // Cached as `{ route: null }` rather than left absent: "there is genuinely no transit
    // between these two points" is an expensive answer to buy twice. A transport failure
    // (!res.ok, a throw) is deliberately NOT cached — that is a blip, not a fact about a place.
    const route = data?.routes?.[0];
    if (!route) { cacheSet(cacheKey, { route: null }, LEG_TTL); return null; }

    // Collect the named vehicles in order — "6 → M14" tells a traveller what to look for.
    const lines = [];
    for (const leg of route.legs || []) {
      for (const step of leg.steps || []) {
        const td = step.transitDetails;
        if (!td?.transitLine) continue;
        const label = td.transitLine.nameShort || td.transitLine.name;
        if (label && !lines.includes(label)) lines.push(label);
      }
    }

    const mins = durationToMins(route.duration);
    if (mins == null) { cacheSet(cacheKey, { route: null }, LEG_TTL); return null; }
    const answer = {
      mins,
      miles: Number.isFinite(route.distanceMeters)
        ? Math.round((route.distanceMeters / 1609.34) * 10) / 10
        : null,
      lines,
    };
    cacheSet(cacheKey, { route: answer }, LEG_TTL);
    return answer;
  } catch {
    return null;
  }
}

/**
 * Resolve the ambiguous band against real road geometry.
 *
 * `legs` is the full ordered list; `indexes` names the subset worth paying for. A matrix
 * request returns the full cross product, so we read only the diagonal (origin i → destination i).
 *
 * Returns a Map of legIndex → { mode, miles, mins, estimated:false }.
 */
export async function resolveAmbiguousLegs(legs = [], indexes = []) {
  const out = new Map();
  if (!ROUTES_KEY || !indexes.length) return out;

  const pending = [];
  for (const i of indexes) {
    const leg = legs[i];
    if (!leg?.from || !leg?.to) continue;
    const key = `walk:${pointKey(leg.from)}>${pointKey(leg.to)}`;
    const cached = cacheGet(key);
    if (cached) { out.set(i, cached); continue; }
    pending.push({ i, key, from: leg.from, to: leg.to });
  }
  if (!pending.length) return out;

  // One element per uncertain leg, all in flight at once.
  const rows = await Promise.all(pending.map((p) => routePair(p.from, p.to, 'WALK')));

  for (let n = 0; n < pending.length; n++) {
    const row = rows[n];
    const p = pending[n];
    if (!row || !p) continue;

    const mins = durationToMins(row.duration);
    const miles = Number.isFinite(row.distanceMeters)
      ? Math.round((row.distanceMeters / 1609.34) * 10) / 10
      : null;
    if (mins == null) continue;

    // The real question: is the WALK acceptable once the road network has its say? A 20-minute
    // walk is a walk; past that it's a drive no matter what the straight line suggested.
    const resolved = mins <= 20
      ? { mode: 'walk', miles, mins, estimated: false }
      : miles != null && miles <= 3
        ? { mode: 'bike', miles, mins: Math.max(1, Math.round(mins * (WALK_MPH / 9))), estimated: false }
        : { mode: 'drive', miles, mins: null, estimated: false };

    cacheSet(p.key, resolved, LEG_TTL);
    out.set(p.i, resolved);
  }

  return out;
}

/**
 * One transit probe for the whole day: can you get from the first stop to the last by transit?
 *
 * This is a COVERAGE question, not a routing one. Transit coverage degrades badly outside
 * metros, and one honest day-level answer beats five per-leg "no route found" repetitions.
 * Cached per rounded region + date so users in the same area on the same day share it.
 *
 * Returns { status: 'yes'|'no'|'unknown', transitMins, driveMins }. 'unknown' is a real
 * answer — it means we could not check, which the UI states rather than guessing.
 *
 * The two durations exist so the day verdict can ask "is transit actually competitive here?"
 * instead of inferring it from raw distance. A 22-mile Brooklyn-to-Queens day is obviously a
 * transit day and a 6-mile suburban day obviously is not; distance alone cannot tell them
 * apart, and the old mileage ceiling got the city case exactly backwards.
 */
export async function probeTransit(from, to, departISO) {
  if (!ROUTES_KEY || !from || !to) return { status: 'unknown', transitMins: null, driveMins: null };

  // 2dp ≈ 1.1km: a whole town shares one probe.
  const r2 = (n) => Math.round(Number(n) * 100) / 100;
  const day = String(departISO || '').slice(0, 10);
  const key = `transit:${r2(from.lat)},${r2(from.lng)}>${r2(to.lat)},${r2(to.lng)}@${day}`;

  const cached = cacheGet(key);
  if (cached) return cached;

  // Both in parallel — 2 elements, cached per region+day so it amortises to near nothing
  // across users in the same place. The DRIVE leg does double duty: it is the comparison
  // baseline AND the way we tell "reachable, no transit route" apart from "could not reach
  // the API at all". Reporting "no transit here" because of a network blip is exactly the
  // confidently-wrong answer this feature must not give.
  const [transitRow, driveRow] = await Promise.all([
    routePair(from, to, 'TRANSIT'),
    routePair(from, to, 'DRIVE'),
  ]);

  const transitMins = transitRow?.duration ? durationToMins(transitRow.duration) : null;
  const driveMins   = driveRow?.duration   ? durationToMins(driveRow.duration)   : null;

  const status = transitMins != null ? 'yes' : (driveRow ? 'no' : 'unknown');
  const answer = { status, transitMins, driveMins };
  cacheSet(key, answer, TRANSIT_TTL);
  return answer;
}

/**
 * All modes for a SINGLE leg — the "show me the other options" escape hatch behind a tap.
 *
 * Deliberately not called during generation: this is 3 elements, and paying that for every leg
 * of every itinerary is exactly the cost blowout the ambiguous-band design avoids. It fires
 * only when a traveller actually asks.
 */
export async function legAlternatives(from, to) {
  if (!ROUTES_KEY || !from || !to) return null;

  const key = `alts:${pointKey(from)}>${pointKey(to)}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const modes = ['WALK', 'BICYCLE', 'DRIVE'];
  // Transit runs through computeRoutes rather than the matrix so it can name the line.
  // Without it, tapping a leg in a city offered walk/bike/drive and silently omitted the
  // subway — the one surface built to show alternatives, missing the likeliest one.
  const [results, transit] = await Promise.all([
    Promise.all(modes.map((m) => routePair(from, to, m))),
    transitRoute(from, to),
  ]);

  const options = [];
  modes.forEach((m, idx) => {
    const row = results[idx];
    if (!row) return;
    const mins = durationToMins(row.duration);
    if (mins == null) return;
    options.push({
      mode: m.toLowerCase() === 'bicycle' ? 'bike' : m.toLowerCase(),
      mins,
      miles: Number.isFinite(row.distanceMeters)
        ? Math.round((row.distanceMeters / 1609.34) * 10) / 10
        : null,
    });
  });

  if (transit) {
    options.push({
      mode: 'transit',
      mins: transit.mins,
      miles: transit.miles,
      // e.g. ['6', 'M14'] — rendered as "via 6 → M14" so the traveller knows what to board.
      lines: transit.lines?.length ? transit.lines : null,
    });
  }

  const payload = { options };
  cacheSet(key, payload, LEG_TTL);
  return payload;
}

export function routesConfigured() {
  return !!ROUTES_KEY;
}
