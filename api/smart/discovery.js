import { selectSources } from './sourceRegistry.js';

const CACHE_TTL = 4 * 60 * 60 * 1000;
const CACHE_MAX = 200; // hard cap so a long-running process can't grow this Map unbounded
const discoveryCache = new Map();

// Map preserves insertion order, so the first key is the oldest — evict it when at capacity.
function cacheSet(key, value) {
  if (discoveryCache.size >= CACHE_MAX && !discoveryCache.has(key)) {
    discoveryCache.delete(discoveryCache.keys().next().value);
  }
  discoveryCache.set(key, value);
}

export function normalizeFind(p) {
  return {
    title: p.title || '', category: p.category || 'activity', interest: p.interest || '',
    lat: p.lat ?? null, lng: p.lng ?? null, address: p.address || '',
    when: p.when || '', cost: p.cost || '', needsTickets: !!p.needsTickets,
    url: p.url || '', snippet: p.snippet || '', sourceLabel: p.sourceLabel || '',
  };
}

export function dedupeFinds(finds) {
  const seen = new Set(), out = [];
  for (const f of finds) {
    const key = (f.title || '').toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key); out.push(f);
  }
  return out;
}

export function discoveryCacheKey(location, interests) {
  const hash = [...new Set(interests.map((i) => i.toLowerCase().trim()))].sort().join('|');
  return `${(location || '').toLowerCase().trim()}::${hash}`;
}

export async function runDiscovery(hunts, ctx) {
  try {
    const interests = hunts.map((h) => h.interest);
    const cacheKey = discoveryCacheKey(ctx.location, interests);
    const cached = discoveryCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.finds;
    if (cached) discoveryCache.delete(cacheKey); // expired — drop so it doesn't linger

    // Cap paid web-search hunts to the top 4 by priority; API/registry sources are free.
    const ranked = [...hunts].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    let searchBudget = 4;
    const tasks = [];
    for (const hunt of ranked) {
      const sources = selectSources(hunt.interest);
      for (const src of sources) {
        if (src.key === 'search') { if (searchBudget-- <= 0) continue; }
        tasks.push(
          src.run({ ...ctx, query: hunt.suggestedQuery }, hunt.interest)
            .then((arr) => (arr || []).map(normalizeFind))
            .catch((e) => { console.warn(`[discovery] ${src.key}/${hunt.interest} failed: ${e.message}`); return []; })
        );
      }
    }
    const results = await Promise.all(tasks);
    const finds = dedupeFinds(results.flat());
    cacheSet(cacheKey, { finds, ts: Date.now() });
    return finds;
  } catch (e) {
    console.error('[discovery] unexpected:', e.message);
    return [];
  }
}
