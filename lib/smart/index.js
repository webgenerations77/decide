import { runScout as _scout } from './scout.js';
import { runDiscovery as _discovery } from './discovery.js';
import { pickAnchors as _anchors } from './anchors.js';
import { runSynthesis as _synthesis } from './synthesis.js';
import { runEvents as _events } from './events.js';

export async function runSmartEngine({ ctx, places }, deps = {}) {
  const runScout = deps.runScout || _scout;
  const runDiscovery = deps.runDiscovery || _discovery;
  const pickAnchors = deps.pickAnchors || _anchors;
  const runSynthesis = deps.runSynthesis || _synthesis;
  const runEvents = deps.runEvents || _events;
  const empty = { itinerary: null, anchors: [], finds: [], hadLiveData: false, localHappenings: null };
  try {
    const [hunts, eventFinds] = await Promise.all([
      runScout(ctx),
      Promise.resolve().then(() => runEvents(ctx)).catch((e) => { console.warn('[smart-engine] events failed:', e.message); return []; }),
    ]);
    const scoutFinds = hunts.length ? await runDiscovery(hunts, ctx) : [];
    const finds = [...scoutFinds, ...eventFinds];
    const anchors = scoutFinds.length ? await pickAnchors(scoutFinds, ctx) : [];

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

    const stops = await runSynthesis({ places, finds, anchors, ctx });
    const hadLiveData = finds.length > 0;
    if (!stops.length) return { ...empty, finds, anchors, hadLiveData, localHappenings };
    return { itinerary: stops, anchors, finds, hadLiveData, localHappenings };
  } catch (e) {
    console.error('[smart-engine] unexpected:', e.message);
    return empty;
  }
}
