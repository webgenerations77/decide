import { runScout as _scout } from './scout.js';
import { runDiscovery as _discovery } from './discovery.js';
import { pickAnchors as _anchors } from './anchors.js';
import { runSynthesis as _synthesis } from './synthesis.js';

export async function runSmartEngine({ ctx, places }, deps = {}) {
  const runScout = deps.runScout || _scout;
  const runDiscovery = deps.runDiscovery || _discovery;
  const pickAnchors = deps.pickAnchors || _anchors;
  const runSynthesis = deps.runSynthesis || _synthesis;
  const empty = { itinerary: null, anchors: [], finds: [], hadLiveData: false };
  try {
    const hunts = await runScout(ctx);
    const finds = hunts.length ? await runDiscovery(hunts, ctx) : [];
    const anchors = finds.length ? await pickAnchors(finds, ctx) : [];
    const stops = await runSynthesis({ places, finds, anchors, ctx });
    if (!stops.length) return { ...empty, finds, anchors, hadLiveData: finds.length > 0 };
    return { itinerary: stops, anchors, finds, hadLiveData: finds.length > 0 };
  } catch (e) {
    console.error('[smart-engine] unexpected:', e.message);
    return empty;
  }
}
