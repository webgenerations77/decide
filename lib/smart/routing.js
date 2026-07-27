// Leg distances and detour detection for a built itinerary.
//
// The bug this exists to fix: distance was measured from the traveller's ORIGIN to each
// stop, so a stop that doubles back across town still showed a small, reassuring number
// ("8.2 mi from you") and the detour was invisible until they drove it. What matters on
// the road is the distance from the PREVIOUS stop, which is what these compute.
//
// Shared by both itinerary twins (api/itinerary.js and app/api/itinerary+api.js).

const EARTH_MILES = 3958.8;

export function haversineMiles(lat1, lng1, lat2, lng2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return EARTH_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Matches the estimate the twins already used, so drive times don't shift meaning.
export function estimateDriveMins(distanceMiles) {
  return Math.max(3, Math.round(distanceMiles / 0.5));
}

const hasCoords = (s) => Number.isFinite(Number(s?.lat)) && Number.isFinite(Number(s?.lng));

/**
 * A stop is a detour when visiting it costs materially more than skipping it: compare
 * prev→stop→next against prev→next directly. That excess is the real cost of the stop's
 * position, and it's what "way out of the way" actually means.
 *
 * Threshold is absolute miles rather than a ratio — a ratio flags every short hop between
 * two adjacent downtown blocks, which is noise.
 */
export const DETOUR_EXCESS_MILES = 8;

export function detourExcessMiles(prev, stop, next) {
  if (!hasCoords(prev) || !hasCoords(stop) || !hasCoords(next)) return 0;
  const via =
    haversineMiles(prev.lat, prev.lng, stop.lat, stop.lng) +
    haversineMiles(stop.lat, stop.lng, next.lat, next.lng);
  const direct = haversineMiles(prev.lat, prev.lng, next.lat, next.lng);
  return Math.max(0, via - direct);
}

/**
 * Attaches per-leg travel to each stop, measured from the previous stop (the first leg is
 * measured from the traveller's origin), and flags stops that sit well off the route.
 *
 * Preserves `distance_miles` / `drive_mins` as ORIGIN-relative, because saved history and
 * the documented itinerary spec already carry that meaning. The new leg fields are additive.
 */
export function annotateRoute(stops, originLat, originLng, { trafficNote = '' } = {}) {
  const list = Array.isArray(stops) ? stops : [];

  const withLegs = list.map((stop, i) => {
    if (!hasCoords(stop)) return stop;

    const prev = i > 0 ? list[i - 1] : null;
    const fromLat = prev && hasCoords(prev) ? prev.lat : originLat;
    const fromLng = prev && hasCoords(prev) ? prev.lng : originLng;

    const legMiles = haversineMiles(fromLat, fromLng, stop.lat, stop.lng);
    const legMins = estimateDriveMins(legMiles);
    const originMiles = haversineMiles(originLat, originLng, stop.lat, stop.lng);

    const from = prev && hasCoords(prev) ? prev.name : null;

    const base = {
      ...stop,
      // Origin-relative — unchanged meaning, kept for history and the itinerary spec.
      distance_miles: parseFloat(originMiles.toFixed(1)),
      drive_mins: estimateDriveMins(originMiles),
      // Leg-relative — what the traveller actually drives next.
      leg_miles: parseFloat(legMiles.toFixed(1)),
      leg_mins: legMins,
      leg_from: from,
    };

    // A sub-quarter-mile leg is walking distance or the same block — a "0.0 mi · ~3 min"
    // pill is noise, and it's especially silly on a first stop that IS the origin.
    if (legMiles < 0.25) return base;

    return {
      ...base,
      distance: `${legMiles.toFixed(1)} mi · ~${legMins} min${from ? ` from ${from}` : ' from your start'}${trafficNote}`,
    };
  });

  return withLegs.map((stop, i) => {
    const prev = withLegs[i - 1];
    const next = withLegs[i + 1];
    if (!prev || !next) return stop;
    const excess = detourExcessMiles(prev, stop, next);
    if (excess < DETOUR_EXCESS_MILES) return stop;
    return {
      ...stop,
      detour: true,
      detour_miles: parseFloat(excess.toFixed(1)),
      detour_note: `Adds about ${Math.round(excess)} miles of backtracking — swap it if you're tight on time.`,
    };
  });
}

/** Total miles actually driven across the day, origin included. */
export function routeTotalMiles(stops, originLat, originLng) {
  const pts = (stops || []).filter(hasCoords);
  if (!pts.length) return 0;
  let total = haversineMiles(originLat, originLng, pts[0].lat, pts[0].lng);
  for (let i = 1; i < pts.length; i++) {
    total += haversineMiles(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
  }
  return parseFloat(total.toFixed(1));
}
