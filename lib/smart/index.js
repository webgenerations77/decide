import { runScout as _scout } from './scout.js';
import { runDiscovery as _discovery } from './discovery.js';
import { pickAnchors as _anchors } from './anchors.js';
import { runSynthesis as _synthesis } from './synthesis.js';
import { runEvents as _events } from './events.js';
import { annotateEventTimes as _eventTimes } from './eventTimes.js';
import { verifyEventTimes as _verifyTimes } from './verifyTimes.js';
import { applySunsetGuard as _sunsetGuard } from './sunsetGuard.js';
import { verifyVenueTimes as _venueTimes } from './verifyVenueTimes.js';
import { logUsage } from '../usageLog.js';

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

/**
 * How much of the request's 60-second Vercel budget synthesis may consume, measured from when
 * the handler started — NOT from when synthesis starts, because everything before it varies.
 *
 * 50s leaves ~10s for what comes after: transport's Routes calls, contact-link enrichment, price
 * levels and serialising the response. A healthy generation reaches synthesis around T+11s and
 * finishes it by T+40s, so this fires only on the runs that were going to be killed anyway.
 *
 * The arithmetic lives HERE rather than in the two itinerary twins on purpose: a budget computed
 * in two places is a budget that drifts in one of them.
 */
export const SYNTHESIS_BUDGET_MS = 54_000;

/**
 * When the research phase has already eaten this much of the budget, SKIP verification.
 *
 * Verification is the most optional thing in the pipeline — it refines event start times and is
 * documented as "must only ever improve timing, never block". It costs up to 8s. Spending that
 * to sharpen a time on a day whose synthesis is then aborted trades a real itinerary for a
 * slightly better timestamp on a fallback nobody wanted.
 *
 * Measured, not guessed: a Brooklyn run with 25 finds spent 22s on research and left synthesis
 * 27s, which was not enough — it needs ~30s and more when the prompt is large. Returning
 * verification's 8s is the cheapest way to buy that back, and it only ever triggers on the runs
 * that were heading for a fallback anyway.
 */
export const SKIP_VERIFY_AFTER_MS = 15_000;

export async function runSmartEngine({ ctx, places, startedAt = null }, deps = {}) {
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
    // Give the 8s back to synthesis when research has already run long. Verification only
    // sharpens event times; synthesis decides whether there is a day at all. Trading the second
    // for the first is how a plan with 25 finds still came back as a generic fallback.
    const researchElapsed = Number.isFinite(startedAt) ? Date.now() - startedAt : 0;
    if (researchElapsed > SKIP_VERIFY_AFTER_MS) {
      console.warn(`[smart-engine] research ran ${Math.round(researchElapsed / 1000)}s — skipping verification to leave synthesis room`);
      logUsage({ route: 'itinerary', model: 'verify-skipped-low-budget' });
    } else {
      await Promise.race([
        Promise.all([
          Promise.resolve().then(() => verifyEventTimes(finds, ctx)).catch((e) => { console.warn('[smart-engine] verify failed:', e.message); }),
          Promise.resolve().then(() => verifyVenueTimes(places, ctx)).then((r) => { if (r) venue = r; }).catch((e) => { console.warn('[smart-engine] venue verify failed:', e.message); }),
        ]),
        new Promise((resolve) => setTimeout(resolve, VERIFY_PHASE_TIMEOUT_MS)),
      ]);
    }

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

    // Absolute deadline, derived once from the handler's own start time. Null when the caller
    // did not supply one (tests, and any future caller outside a serverless request), in which
    // case synthesis behaves exactly as it always did.
    const deadlineAt = Number.isFinite(startedAt) ? startedAt + SYNTHESIS_BUDGET_MS : null;
    const rawStops = await runSynthesis({ places, finds, anchors, ctx, deadlineAt });
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
