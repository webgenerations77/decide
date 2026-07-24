import { resolveAndScrape, extractConfirmedTime } from './verifyTimes.js';

// Verify real start times for scheduled-event VENUES that arrive via Google Places (racetracks,
// theaters, cinemas, stadiums…) — the coverage gap behind the "Ocean Downs harness racing at 5pm
// when first post is 6:40pm" report. verifyTimes.js only checks Firecrawl finds; a venue with a
// standing schedule comes in as a Place with no start time, so synthesis guesses. This confirms the
// schedule and PROMOTES the venue onto the existing verified-finds rail so synthesis schedules it
// correctly (and can anchor the day around it). Unconfirmed venues are left untouched → the existing
// honest hedge applies. Fully defensive, bounded, fail-open — mirrors the verifyTimes contract.
//
// Spec: docs/superpowers/specs/2026-07-24-venue-start-times-design.md

export const MAX_VENUE_VERIFY = 2;

const RACING_RE = /\b(racetrack|raceway|speedway|dragway|downs|motor speedway)\b/i;
const PERFORMANCE_RE = /\b(theater|theatre|playhouse|opera|cinema|movie|multiplex|amphitheater|amphitheatre|concert hall|music hall|auditorium)\b/i;
const SPORTS_RE = /\b(arena|stadium|ballpark|fieldhouse|pavilion|fairgrounds)\b/i;

function venueCategory(text) {
  if (RACING_RE.test(text)) return 'racing';
  if (PERFORMANCE_RE.test(text)) return 'performance';
  if (SPORTS_RE.test(text)) return 'sports';
  return 'event';
}

function isEventVenue(text) {
  return RACING_RE.test(text) || PERFORMANCE_RE.test(text) || SPORTS_RE.test(text);
}

const placeKey = (p) => p.place_id || p.name;

// Pick the scheduled-event venues worth verifying from the Places pool. Accepts either the
// { food, activity, shopping, outdoor } bucket object or a flat array. Name matches outrank
// summary-only matches; deduped by id; capped at MAX_VENUE_VERIFY. Pure.
export function selectEventVenues(places) {
  const arr = Array.isArray(places)
    ? places
    : Object.values(places || {}).flatMap((v) => (Array.isArray(v) ? v : []));
  const seen = new Set();
  const scored = [];
  for (const p of arr) {
    if (!p || typeof p !== 'object') continue;
    const id = placeKey(p);
    if (!id || seen.has(id)) continue;
    const name = String(p.name || '');
    const summary = String(p.summary || '');
    const nameMatch = isEventVenue(name);
    const summaryMatch = !nameMatch && isEventVenue(summary);
    if (!nameMatch && !summaryMatch) continue;
    seen.add(id);
    scored.push({ place: p, rank: nameMatch ? 0 : 1, category: venueCategory(`${name} ${summary}`) });
  }
  scored.sort((a, b) => a.rank - b.rank);
  return scored.slice(0, MAX_VENUE_VERIFY);
}

function buildVenueUser(place) {
  return (slice, c) => `Plan date: ${c.travelDates?.start || 'unknown'} (${c.dayOfWeek || 'unknown weekday'}).
Venue: ${place.name || 'unknown'}

Scraped page content:
${slice}

Find the start time of the scheduled event/show/race at THIS venue on the plan date.
IMPORTANT: If the page gives a REGULAR schedule for ${c.dayOfWeek || 'that weekday'} (e.g. "Saturdays, first post 6:40 PM" or "Fri–Sat showtimes 7:00 PM"), that recurring time IS the confirmed start time for this date — return it with confidence "high". Use null only when no time for this weekday is stated or clearly implied.

Return ONLY JSON: {"startTime":"HH:MM","confidence":"high"} or {"startTime":null,"confidence":null}
- startTime: 24-hour local "HH:MM".
- confidence: "high" when an explicit time is given (a dated time OR a matching-weekday recurring schedule); "low" if only vaguely implied; else null.`;
}

// Verify one venue: find + scrape its schedule page, extract a start time (a matching recurring
// weekday schedule counts as confirmed), and on success build the synthetic verified find. Never
// throws — any failure returns null and leaves the venue in the places pool for the honest hedge.
async function verifyVenue({ place, category }, ctx, deps) {
  try {
    const searchQuery = `${place.name || ''} ${ctx.location || ''} ${ctx.dayOfWeek || ''} ${ctx.travelDates?.start || ''} schedule first post showtime start time`;
    const src = await resolveAndScrape({ seedUrl: place.website || null, searchQuery }, deps);
    if (!src) return null;

    const hit = await extractConfirmedTime({
      slice: src.slice,
      url: src.url,
      ctx,
      system: "You extract a scheduled-event venue's start time from a scraped page. A regular weekly schedule for the plan's weekday counts as a confirmed time. Return only JSON.",
      buildUser: buildVenueUser(place),
      accept: (parsed) => parsed?.confidence === 'high',
      route: 'verifyvenuetimes',
    }, deps);
    if (!hit) return null;

    return {
      title: place.name,
      lat: place.lat,
      lng: place.lng,
      place_id: place.place_id || null,
      address: place.address || '',
      category,
      interest: category,
      sourceLabel: 'Venue schedule',
      verifiedTime: hit.startTime,
      verifiedSource: hit.source,
      timeConfidence: 'verified',
    };
  } catch (e) {
    console.warn('[verifyVenueTimes] venue failed:', e.message);
    return null;
  }
}

// Confirm start times for scheduled-event venues in the Places pool and return the promoted verified
// finds plus the set of place ids to remove (so the caller can drop them from `places`, avoiding
// double-representation). Bounded (≤ MAX_VENUE_VERIFY scrapes) and fail-open — on any failure it
// returns empties and the itinerary is built exactly as it would have been without this feature.
export async function verifyVenueTimes(places, ctx = {}, deps = {}) {
  const promotedFinds = [];
  const removePlaceIds = new Set();
  try {
    const candidates = selectEventVenues(places);
    if (!candidates.length) return { promotedFinds, removePlaceIds };
    const results = await Promise.all(candidates.map((c) => verifyVenue(c, ctx, deps)));
    results.forEach((find, i) => {
      if (!find) return;
      promotedFinds.push(find);
      removePlaceIds.add(placeKey(candidates[i].place));
    });
    return { promotedFinds, removePlaceIds };
  } catch (e) {
    console.warn('[verifyVenueTimes] failed:', e.message);
    return { promotedFinds, removePlaceIds };
  }
}
