import { runScout as _scout } from './scout.js';
import { runDiscovery as _discovery } from './discovery.js';
import { pickAnchors as _anchors } from './anchors.js';
import { runSynthesis as _synthesis } from './synthesis.js';
import { runEvents as _events } from './events.js';
import { annotateEventTimes as _eventTimes } from './eventTimes.js';
import { verifyEventTimes as _verifyTimes } from './verifyTimes.js';
import { applySunsetGuard as _sunsetGuard } from './sunsetGuard.js';
import { verifyVenueTimes as _venueTimes } from './verifyVenueTimes.js';

// Drop promoted event-venues from the places buckets so a venue isn't represented both as a Google
// place and as a verified find. Same id key the venue module uses (place_id, else name).
function stripPlaceIds(places, ids) {
  if (!ids || !ids.size) return places;
  const out = {};
  for (const [k, v] of Object.entries(places || {})) {
    out[k] = Array.isArray(v) ? v.filter((p) => !ids.has(p.place_id || p.name)) : v;
  }
  return out;
}

export async function runSmartEngine({ ctx, places }, deps = {}) {
  const runScout = deps.runScout || _scout;
  const runDiscovery = deps.runDiscovery || _discovery;
  const pickAnchors = deps.pickAnchors || _anchors;
  const runSynthesis = deps.runSynthesis || _synthesis;
  const runEvents = deps.runEvents || _events;
  const annotateEventTimes = deps.annotateEventTimes || _eventTimes;
  const verifyEventTimes = deps.verifyEventTimes || _verifyTimes;
  const verifyVenueTimes = deps.verifyVenueTimes || _venueTimes;
  const applySunsetGuard = deps.applySunsetGuard || _sunsetGuard;
  const empty = { itinerary: null, anchors: [], finds: [], hadLiveData: false, localHappenings: null };
  try {
    const [hunts, eventFinds] = await Promise.all([
      runScout(ctx),
      Promise.resolve().then(() => runEvents(ctx)).catch((e) => { console.warn('[smart-engine] events failed:', e.message); return []; }),
    ]);
    const scoutFinds = hunts.length ? await runDiscovery(hunts, ctx) : [];
    const finds = [...scoutFinds, ...eventFinds];
    // Extract real start times (mutates finds in place) so anchors — which hold references
    // to these same objects — and synthesis can schedule around verified times.
    await annotateEventTimes(finds, ctx.travelDates?.start);

    // Verify time-sensitive event start times against source pages (mutates finds in place).
    // Bounded so a slow scrape never stalls generation — if it doesn't finish in time we proceed
    // with whatever it has set so far (fail-open to the honest hedge downstream).
    // In the same bounded window, also verify scheduled-event VENUES from the Places pool (racetracks,
    // theaters…) whose standing schedules Places doesn't return — the Ocean Downs case. Confirmed ones
    // are promoted onto the finds/anchor rail below so synthesis schedules them at the real time.
    const VERIFY_PHASE_TIMEOUT_MS = deps.verifyTimeoutMs || 8000;
    let venue = { promotedFinds: [], removePlaceIds: new Set() };
    await Promise.race([
      Promise.all([
        Promise.resolve().then(() => verifyEventTimes(finds, ctx)).catch((e) => { console.warn('[smart-engine] verify failed:', e.message); }),
        Promise.resolve().then(() => verifyVenueTimes(places, ctx)).then((r) => { if (r) venue = r; }).catch((e) => { console.warn('[smart-engine] venue verify failed:', e.message); }),
      ]),
      new Promise((resolve) => setTimeout(resolve, VERIFY_PHASE_TIMEOUT_MS)),
    ]);

    // Promote confirmed venues to verified finds and remove them from places (no double-representation).
    if (venue.promotedFinds.length) {
      finds.push(...venue.promotedFinds);
      places = stripPlaceIds(places, venue.removePlaceIds);
    }

    // Promoted venues are eligible as anchors (let the ranker decide — not hard-pinned).
    const anchorPool = venue.promotedFinds.length ? [...scoutFinds, ...venue.promotedFinds] : scoutFinds;
    const anchors = anchorPool.length ? await pickAnchors(anchorPool, ctx) : [];

    const holiday = ctx.holiday || null;
    const localHappenings = (eventFinds.length || holiday) ? {
      holiday,
      events: eventFinds.slice(0, 5).map((f) => ({ title: f.title, url: f.url || null, when: f.when || null })),
      note: (holiday && eventFinds.length === 0)
        ? `No confirmed ${holiday} events surfaced — check local tourism listings before you go.`
        : null,
    } : null;

    // Nothing real to build from (no live finds AND no Google places) — skip the Sonnet
    // synthesis call (it could only invent venues with bogus place_ids) and let the caller
    // fall back to buildFallbackItinerary. Also covers a transient scout failure (hunts=0).
    const hasPlaces = Object.values(places || {}).some((arr) => Array.isArray(arr) && arr.length > 0);
    if (finds.length === 0 && !hasPlaces) return { ...empty, localHappenings };

    const rawStops = await runSynthesis({ places, finds, anchors, ctx });
    // Deterministically correct/flag sunset-mistimed stops the model produced (fail-open).
    const stops = applySunsetGuard(rawStops, ctx.sun, ctx);
    const hadLiveData = finds.length > 0;
    if (!stops.length) return { ...empty, finds, anchors, hadLiveData, localHappenings };
    return { itinerary: stops, anchors, finds, hadLiveData, localHappenings };
  } catch (e) {
    console.error('[smart-engine] unexpected:', e.message);
    return empty;
  }
}
