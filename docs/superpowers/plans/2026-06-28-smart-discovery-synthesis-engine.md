# Smart Discovery & Synthesis Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic Places-shuffle itinerary with an interest-driven engine that discovers hyper-specific finds (pinball, arcades, breweries, surf/tide windows…) and builds an opinionated day genuinely anchored on them.

**Architecture:** A backend pipeline under `api/smart/`: a Haiku **scout** turns interests + trip context into ranked hunts → **discovery** runs a deterministic source registry (free geo APIs + Firecrawl fallback) in parallel into normalized "finds" → a Haiku **anchors** pass picks the 1–3 finds that should shape the day → a Sonnet **synthesis** pass builds the itinerary around anchors + Google Places. The synthesis call **replaces** the current Haiku itinerary call; `buildFallbackItinerary` stays as the safety net. Wired into both `api/itinerary.js` (Vercel) and `app/api/itinerary+api.js` (Expo).

**Tech Stack:** Node ESM, `@anthropic-ai/sdk` 0.104.1, Firecrawl REST v2, OpenStreetMap Overpass, Pinball Map, Open Brewery DB, Open-Meteo Marine, NOAA CO-OPS, sunrise-sunset.org. Tests are plain `.mjs` scripts run with `node` (project convention — there is no jest).

**Reference spec:** `docs/superpowers/specs/2026-06-28-smart-discovery-synthesis-engine-design.md`

## Global Constraints

- Expo SDK 56; install packages with `npm install <pkg> --legacy-peer-deps`.
- Client-side env vars must use the `EXPO_PUBLIC_` prefix; `ANTHROPIC_API_KEY` and `FIRECRAWL_API_KEY` are server-side only.
- User-facing AI is **"Cheddar"** — never "AI" / "artificial intelligence".
- No hardcoded hex in components — colors come from `constants/theme.js`.
- Models: scout + anchors = `claude-haiku-4-5-20251001`; synthesis = `claude-sonnet-4-6`.
- Every external call is wrapped; **the engine must never throw** out of `runSmartEngine` — on total failure it returns `{ itinerary: null, ... }` so the caller falls back.
- Both itinerary handlers (`api/itinerary.js`, `app/api/itinerary+api.js`) must stay in sync.
- Do **not** change itinerary stop-card UI (backend/prompt + one input box only).
- Test idiom: a `.mjs` file in `__tests__/` with the `assert(label, condition, detail)` helper from `__tests__/verify.mjs`; run with `node __tests__/<name>.mjs`; success = `failed === 0`.
- Stop schema (unchanged, produced by synthesis): `{ time, duration_mins, category, name, place_id, address, lat, lng, reason, excitement_score, provenance? }`.

### Shared data shapes (used across tasks)

```
Hunt   = { interest: string, why: string, priority: number, suggestedQuery: string }
Find   = { title, category, interest, lat, lng, address, when, cost, needsTickets, url, snippet, sourceLabel }
Anchor = { find: Find, rationale: string }
Ctx    = { location, travelDates:{start,end}, coords:{latitude,longitude}, maxMiles,
           weather, prefs:{pace,budget,group_type,cuisines,activityStyles,dietary}, feedback, tripNote }
EngineResult = { itinerary: Stop[]|null, anchors: Anchor[], finds: Find[], hadLiveData: boolean }
```

---

### Task 1: Firecrawl REST helper

Extract the Firecrawl primitives into a reusable module (currently embedded in `api/researchPhase.js`).

**Files:**
- Create: `api/smart/firecrawl.js`
- Test: `__tests__/smart-firecrawl.mjs`

**Interfaces:**
- Produces: `fetchWithTimeout(url, options, timeoutMs) → Promise<Response>`; `firecrawlScrape(url) → Promise<string>` (markdown, throws on failure); `firecrawlSearch(query, limit=5) → Promise<{title,url,description}[]>`

- [ ] **Step 1: Write the failing test**

```js
// __tests__/smart-firecrawl.mjs — run: node __tests__/smart-firecrawl.mjs
import { fetchWithTimeout } from '../api/smart/firecrawl.js';

let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

(async () => {
  // fetchWithTimeout aborts a hung request
  const orig = globalThis.fetch;
  globalThis.fetch = (_u, opts) => new Promise((_res, rej) => {
    opts.signal.addEventListener('abort', () => rej(new Error('aborted')));
  });
  let threw = false;
  try { await fetchWithTimeout('https://x', {}, 50); } catch { threw = true; }
  globalThis.fetch = orig;
  assert('fetchWithTimeout aborts after timeout', threw);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node __tests__/smart-firecrawl.mjs`
Expected: FAIL — `Cannot find module '../api/smart/firecrawl.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// api/smart/firecrawl.js
const FIRECRAWL_KEY  = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_BASE = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
const SCRAPE_TIMEOUT_MS = 25000;
const SEARCH_TIMEOUT_MS = 20000;
const MAX_CONTENT_CHARS = 6000;

export async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function firecrawlScrape(url) {
  const res = await fetchWithTimeout(`${FIRECRAWL_BASE}/v2/scrape`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true, timeout: SCRAPE_TIMEOUT_MS }),
  }, SCRAPE_TIMEOUT_MS + 2000);
  if (!res.ok) throw new Error(`scrape HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'scrape failed');
  return (data.data?.markdown || '').slice(0, MAX_CONTENT_CHARS);
}

export async function firecrawlSearch(query, limit = 5) {
  const res = await fetchWithTimeout(`${FIRECRAWL_BASE}/v2/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  }, SEARCH_TIMEOUT_MS);
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'search failed');
  const web = data.data?.web || data.data || [];
  return web.map((r) => ({ title: r.title || '', url: r.url || '', description: r.description || '' }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node __tests__/smart-firecrawl.mjs`
Expected: PASS — `1 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add api/smart/firecrawl.js __tests__/smart-firecrawl.mjs
git commit -m "feat(smart): firecrawl REST helper"
```

---

### Task 2: Verify source endpoints (no code — capture real payloads first)

Per the spec's verify-before-wiring rule. This task produces a throwaway script that confirms each registry endpoint's shape so Task 3/4 normalizers match reality.

**Files:**
- Create: `__tests__/verify-sources.mjs`

**Interfaces:** none (diagnostic only).

- [ ] **Step 1: Write the probe script**

```js
// __tests__/verify-sources.mjs — run: node __tests__/verify-sources.mjs
// Ocean City, MD reference coords.
const LAT = 38.3365, LNG = -75.0849;
const get = async (label, url, opts) => {
  try {
    const r = await fetch(url, opts);
    const t = await r.text();
    console.log(`\n=== ${label} (${r.status}) ===\n${t.slice(0, 600)}`);
  } catch (e) { console.error(`\n=== ${label} FAILED: ${e.message}`); }
};
await get('Pinball Map', `https://pinballmap.com/api/v1/locations/closest_by_lat_lon.json?lat=${LAT}&lon=${LNG}&send_all_within_distance=1&max_distance=25`);
await get('Open Brewery DB', `https://api.openbrewerydb.org/v1/breweries?by_dist=${LAT},${LNG}&per_page=5`);
await get('Open-Meteo Marine', `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LNG}&daily=wave_height_max&forecast_days=3&timezone=auto`);
await get('Overpass (arcades)', 'https://overpass-api.de/api/interpreter', { method: 'POST', body: `[out:json][timeout:20];node["leisure"="amusement_arcade"](around:25000,${LAT},${LNG});out body 10;` });
```

- [ ] **Step 2: Run it and read output**

Run: `node __tests__/verify-sources.mjs`
Expected: 200s with JSON bodies. Note the exact field names (Pinball: `locations[].name/lat/lon`; Brewery: `[].name/latitude/longitude/city`; Open-Meteo: `daily.time[]/wave_height_max[]`; Overpass: `elements[].lat/lon/tags.name`). If a status is non-200 or rate-limited, record it — Task 3/4 adapters must tolerate it.

- [ ] **Step 3: Commit**

```bash
git add __tests__/verify-sources.mjs
git commit -m "chore(smart): source endpoint verification probe"
```

---

### Task 3: Source registry — Overpass backbone + Pinball + search fallback

**Files:**
- Create: `api/smart/sourceRegistry.js`
- Test: `__tests__/smart-registry.mjs`

**Interfaces:**
- Consumes: `firecrawlSearch` from Task 1.
- Produces: `matchesInterest(source, interest) → boolean`; `selectSources(interest) → SourceDescriptor[]`; each `SourceDescriptor = { key, match: string[], run(ctx, interest) → Promise<Find[]> }`; `INTEREST_OSM_TAGS` (object). `ctx` carries `{ coords:{latitude,longitude}, maxMiles, location }` plus the hunt's `suggestedQuery` passed as `interest.query` — see Task 5 for how discovery builds it.

- [ ] **Step 1: Write the failing test**

```js
// __tests__/smart-registry.mjs — run: node __tests__/smart-registry.mjs
import { selectSources, matchesInterest, INTEREST_OSM_TAGS } from '../api/smart/sourceRegistry.js';

let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

assert('pinball matches the pinball source', selectSources('pinball').some((s) => s.key === 'pinball'));
assert('arcades resolves to overpass via OSM tag', !!INTEREST_OSM_TAGS['arcades'] && selectSources('arcades').some((s) => s.key === 'overpass'));
assert('match is fuzzy/case-insensitive', matchesInterest({ match: ['pinball'] }, 'PINBALL machines'));
assert('unknown interest falls back to search', selectSources('underwater basket weaving').length === 1 && selectSources('underwater basket weaving')[0].key === 'search');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node __tests__/smart-registry.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// api/smart/sourceRegistry.js
import { firecrawlSearch } from './firecrawl.js';

// Interest tag → OSM tag the Overpass backbone queries. Add new rows here.
export const INTEREST_OSM_TAGS = {
  'arcades': 'leisure=amusement_arcade',
  'mini golf': 'leisure=miniature_golf',
  'disc golf': 'leisure=disc_golf_course',
  'climbing': 'sport=climbing',
  'skate parks': 'leisure=skatepark',
  'record stores': 'shop=music',
  'book stores': 'shop=books',
  'board game cafes': 'amenity=cafe',
  'lighthouses': 'man_made=lighthouse',
  'viewpoints': 'tourism=viewpoint',
};

const norm = (s) => (s || '').toLowerCase().trim();

export function matchesInterest(source, interest) {
  const n = norm(interest);
  return (source.match || []).some((tag) => n.includes(norm(tag)) || norm(tag).includes(n));
}

async function runOverpass(ctx, interest) {
  const tag = INTEREST_OSM_TAGS[norm(interest)];
  if (!tag) return [];
  const [k, v] = tag.split('=');
  const { latitude, longitude } = ctx.coords;
  const radius = Math.round((ctx.maxMiles || 25) * 1609);
  const q = `[out:json][timeout:20];node["${k}"="${v}"](around:${radius},${latitude},${longitude});out body 12;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const data = await res.json();
  return (data.elements || []).filter((e) => e.tags?.name).map((e) => ({
    title: e.tags.name, category: 'activity', interest, lat: e.lat, lng: e.lon,
    address: [e.tags['addr:street'], e.tags['addr:city']].filter(Boolean).join(', '),
    url: e.tags.website || '', snippet: '', sourceLabel: 'OpenStreetMap',
  }));
}

async function runPinball(ctx, interest) {
  const { latitude, longitude } = ctx.coords;
  const res = await fetch(`https://pinballmap.com/api/v1/locations/closest_by_lat_lon.json?lat=${latitude}&lon=${longitude}&send_all_within_distance=1&max_distance=${ctx.maxMiles || 25}`);
  if (!res.ok) throw new Error(`pinball ${res.status}`);
  const data = await res.json();
  return (data.locations || []).slice(0, 10).map((l) => ({
    title: l.name, category: 'activity', interest, lat: parseFloat(l.lat), lng: parseFloat(l.lon),
    address: l.street ? `${l.street}, ${l.city}` : l.city, url: l.website || '',
    snippet: l.num_machines ? `${l.num_machines} machines` : '', sourceLabel: 'Pinball Map',
  }));
}

async function runSearch(ctx, interest) {
  const results = await firecrawlSearch(ctx.query || `${interest} near ${ctx.location}`, 5);
  return results.map((r) => ({
    title: r.title, category: 'activity', interest, lat: null, lng: null, address: '',
    url: r.url, snippet: r.description, sourceLabel: 'Web',
  }));
}

const SEARCH_FALLBACK = { key: 'search', match: [], run: runSearch };

export const SOURCES = [
  { key: 'pinball',  match: ['pinball'], run: runPinball },
  { key: 'overpass', match: Object.keys(INTEREST_OSM_TAGS), run: runOverpass },
  SEARCH_FALLBACK,
];

export function selectSources(interest) {
  const hits = SOURCES.filter((s) => s.key !== 'search' && matchesInterest(s, interest));
  return hits.length ? hits : [SEARCH_FALLBACK];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node __tests__/smart-registry.mjs`
Expected: PASS — `4 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add api/smart/sourceRegistry.js __tests__/smart-registry.mjs
git commit -m "feat(smart): source registry — overpass backbone + pinball + search fallback"
```

---

### Task 4: Keyless data adapters — brewery, surf, tides, golden hour

Adds the beach-relevant free APIs as registry sources. These are "ambient" sources matched by interest tag and (for surf/tides/golden hour) also runnable as always-on context in Task 5.

**Files:**
- Modify: `api/smart/sourceRegistry.js`
- Test: `__tests__/smart-adapters.mjs`

**Interfaces:**
- Produces: appended entries in `SOURCES` with keys `brewery`, `surf`, `tides`, `goldenhour`; each `run(ctx, interest) → Promise<Find[]>`.

- [ ] **Step 1: Write the failing test**

```js
// __tests__/smart-adapters.mjs — run: node __tests__/smart-adapters.mjs
import { selectSources } from '../api/smart/sourceRegistry.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);
assert('breweries → brewery source', selectSources('breweries').some((s) => s.key === 'brewery'));
assert('surf → surf source', selectSources('surf').some((s) => s.key === 'surf'));
assert('tides → tides source', selectSources('tides').some((s) => s.key === 'tides'));
assert('sunset → goldenhour source', selectSources('sunset').some((s) => s.key === 'goldenhour'));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node __tests__/smart-adapters.mjs`
Expected: FAIL — none of these keys exist yet.

- [ ] **Step 3: Add the adapters**

Insert these functions above `export const SOURCES`:

```js
async function runBrewery(ctx, interest) {
  const { latitude, longitude } = ctx.coords;
  const res = await fetch(`https://api.openbrewerydb.org/v1/breweries?by_dist=${latitude},${longitude}&per_page=8`);
  if (!res.ok) throw new Error(`brewery ${res.status}`);
  const data = await res.json();
  return (data || []).filter((b) => b.latitude && b.longitude).map((b) => ({
    title: b.name, category: 'food', interest, lat: parseFloat(b.latitude), lng: parseFloat(b.longitude),
    address: [b.street, b.city].filter(Boolean).join(', '), url: b.website_url || '',
    snippet: b.brewery_type ? `${b.brewery_type} brewery` : '', sourceLabel: 'Open Brewery DB',
  }));
}

async function runSurf(ctx, interest) {
  const { latitude, longitude } = ctx.coords;
  const res = await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&daily=wave_height_max&forecast_days=3&timezone=auto`);
  if (!res.ok) throw new Error(`surf ${res.status}`);
  const d = (await res.json()).daily || {};
  return (d.time || []).map((day, i) => ({
    title: `Surf forecast — ${day}`, category: 'outdoor', interest, lat: latitude, lng: longitude,
    address: '', when: day, url: '', snippet: `Max wave height ~${d.wave_height_max?.[i]}m`, sourceLabel: 'Open-Meteo',
  }));
}

async function runTides(ctx, interest) {
  const { latitude, longitude } = ctx.coords;
  const begin = (ctx.travelDates?.start || '').replace(/-/g, '');
  const res = await fetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&datum=MLLW&interval=hilo&units=english&time_zone=lst_ldt&format=json&application=decide&begin_date=${begin}&range=24&lat=${latitude}&lon=${longitude}`);
  if (!res.ok) throw new Error(`tides ${res.status}`);
  const preds = (await res.json()).predictions || [];
  return preds.map((p) => ({
    title: `${p.type === 'H' ? 'High' : 'Low'} tide`, category: 'outdoor', interest, lat: latitude, lng: longitude,
    address: '', when: p.t, url: '', snippet: `${p.v} ft`, sourceLabel: 'NOAA Tides',
  }));
}

async function runGoldenHour(ctx, interest) {
  const { latitude, longitude } = ctx.coords;
  const date = ctx.travelDates?.start || '';
  const res = await fetch(`https://api.sunrise-sunset.org/json?lat=${latitude}&lng=${longitude}&date=${date}&formatted=0`);
  if (!res.ok) throw new Error(`goldenhour ${res.status}`);
  const r = (await res.json()).results || {};
  return [{
    title: 'Golden hour', category: 'outdoor', interest, lat: latitude, lng: longitude, address: '',
    when: r.sunset, url: '', snippet: `Sunset ${r.sunset ? new Date(r.sunset).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}`,
    sourceLabel: 'sunrise-sunset.org',
  }];
}
```

Then extend the `SOURCES` array (before `SEARCH_FALLBACK`):

```js
  { key: 'brewery',    match: ['brewery', 'breweries', 'craft beer', 'beer'], run: runBrewery },
  { key: 'surf',       match: ['surf', 'surfing', 'waves'], run: runSurf },
  { key: 'tides',      match: ['tides', 'tide', 'beach walk', 'tide pools'], run: runTides },
  { key: 'goldenhour', match: ['sunset', 'sunrise', 'golden hour', 'stargazing'], run: runGoldenHour },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node __tests__/smart-adapters.mjs`
Expected: PASS — `4 passed, 0 failed`. Also re-run `node __tests__/smart-registry.mjs` (still passes).

- [ ] **Step 5: Commit**

```bash
git add api/smart/sourceRegistry.js __tests__/smart-adapters.mjs
git commit -m "feat(smart): keyless adapters — brewery, surf, tides, golden hour"
```

---

### Task 5: Discovery — normalize, dedupe, cache, run hunts in parallel

**Files:**
- Create: `api/smart/discovery.js`
- Test: `__tests__/smart-discovery.mjs`

**Interfaces:**
- Consumes: `selectSources` (Task 3/4).
- Produces: `normalizeFind(partial) → Find`; `dedupeFinds(finds) → Find[]`; `discoveryCacheKey(location, interests) → string`; `runDiscovery(hunts, ctx) → Promise<Find[]>` (never throws).

- [ ] **Step 1: Write the failing test**

```js
// __tests__/smart-discovery.mjs — run: node __tests__/smart-discovery.mjs
import { normalizeFind, dedupeFinds, discoveryCacheKey } from '../api/smart/discovery.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const f = normalizeFind({ title: 'X', interest: 'pinball', sourceLabel: 'Pinball Map' });
assert('normalizeFind fills defaults', f.category === 'activity' && f.lat === null && f.url === '');
const deduped = dedupeFinds([{ title: 'Joe Pizza', sourceLabel: 'a' }, { title: 'joe pizza', sourceLabel: 'b' }]);
assert('dedupeFinds collapses by title (case-insensitive)', deduped.length === 1);
assert('cache key includes interest hash', discoveryCacheKey('Ocean City', ['pinball']) !== discoveryCacheKey('Ocean City', ['surf']));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node __tests__/smart-discovery.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// api/smart/discovery.js
import { selectSources } from './sourceRegistry.js';

const CACHE_TTL = 4 * 60 * 60 * 1000;
const discoveryCache = new Map();

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
  const hash = [...interests].map((i) => i.toLowerCase().trim()).sort().join('|');
  return `${(location || '').toLowerCase().trim()}::${hash}`;
}

export async function runDiscovery(hunts, ctx) {
  try {
    const interests = hunts.map((h) => h.interest);
    const cacheKey = discoveryCacheKey(ctx.location, interests);
    const cached = discoveryCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.finds;

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
    discoveryCache.set(cacheKey, { finds, ts: Date.now() });
    return finds;
  } catch (e) {
    console.error('[discovery] unexpected:', e.message);
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node __tests__/smart-discovery.mjs`
Expected: PASS — `3 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add api/smart/discovery.js __tests__/smart-discovery.mjs
git commit -m "feat(smart): discovery — normalize, dedupe, 4h cache, parallel run"
```

---

### Task 6: Scout (Haiku) — interests → ranked hunts

**Files:**
- Create: `api/smart/scout.js`
- Test: `__tests__/smart-scout.mjs`

**Interfaces:**
- Produces: `buildScoutPrompt(ctx) → string`; `validateHunts(raw) → Hunt[]`; `runScout(ctx) → Promise<Hunt[]>` (never throws — returns `[]` on failure).

- [ ] **Step 1: Write the failing test**

```js
// __tests__/smart-scout.mjs — run: node __tests__/smart-scout.mjs
import { buildScoutPrompt, validateHunts } from '../api/smart/scout.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const ctx = { location: 'Ocean City, MD', prefs: { activityStyles: ['arcades'], cuisines: [] }, tripNote: 'we love pinball' };
const prompt = buildScoutPrompt(ctx);
assert('prompt includes the trip note', prompt.includes('pinball'));
assert('prompt includes location', prompt.includes('Ocean City, MD'));

const hunts = validateHunts({ hunts: [
  { interest: 'pinball', why: 'mentioned', priority: 9, suggestedQuery: 'pinball ocean city' },
  { bogus: true },
] });
assert('validateHunts keeps valid, drops invalid', hunts.length === 1 && hunts[0].interest === 'pinball');
assert('validateHunts coerces priority to number', typeof hunts[0].priority === 'number');
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node __tests__/smart-scout.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// api/smart/scout.js
import Anthropic from '@anthropic-ai/sdk';

function extractJSON(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

export function buildScoutPrompt(ctx) {
  const p = ctx.prefs || {};
  return `Traveler is visiting ${ctx.location} (${ctx.travelDates?.start || 'soon'}).
Group: ${p.group_type || 'unknown'}. Pace: ${p.pace || 'moderate'}.
Activity styles: ${(p.activityStyles || []).join(', ') || 'none given'}.
Cuisines: ${(p.cuisines || []).join(', ') || 'none given'}.
Liked before: ${(ctx.feedback?.likedPlaces || []).join(', ') || 'none'}.
This trip they said: "${ctx.tripNote || ''}".

List up to 8 specific, hunt-able interests this person would light up about — niche and concrete (e.g. "pinball", "arcades", "record stores", "breweries", "surf", "tides", "sunset"), not generic ("food"). Rank by how strongly the signals point to each.

Return ONLY JSON: {"hunts":[{"interest":"","why":"one short reason","priority":1-10,"suggestedQuery":"a web search query for this interest near the location"}]}`;
}

export function validateHunts(raw) {
  const arr = Array.isArray(raw?.hunts) ? raw.hunts : [];
  return arr
    .filter((h) => h && typeof h.interest === 'string' && h.interest.trim())
    .map((h) => ({
      interest: h.interest.trim(),
      why: typeof h.why === 'string' ? h.why : '',
      priority: Number(h.priority) || 1,
      suggestedQuery: typeof h.suggestedQuery === 'string' ? h.suggestedQuery : h.interest,
    }))
    .slice(0, 8);
}

export async function runScout(ctx) {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
      system: 'You surface a traveler’s niche interests as hunt-able tags. Return only JSON.',
      messages: [{ role: 'user', content: buildScoutPrompt(ctx) }],
    });
    return validateHunts(JSON.parse(extractJSON(msg.content[0]?.text ?? '{}')));
  } catch (e) {
    console.warn('[scout] failed:', e.message);
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node __tests__/smart-scout.mjs`
Expected: PASS — `4 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add api/smart/scout.js __tests__/smart-scout.mjs
git commit -m "feat(smart): scout — interests to ranked hunts (haiku)"
```

---

### Task 7: Anchors (Haiku) — pick the 1–3 day-shaping finds

**Files:**
- Create: `api/smart/anchors.js`
- Test: `__tests__/smart-anchors.mjs`

**Interfaces:**
- Produces: `buildAnchorPrompt(finds, ctx) → string`; `validateAnchors(raw, finds) → Anchor[]`; `pickAnchors(finds, ctx) → Promise<Anchor[]>` (never throws — returns `[]`).

- [ ] **Step 1: Write the failing test**

```js
// __tests__/smart-anchors.mjs — run: node __tests__/smart-anchors.mjs
import { buildAnchorPrompt, validateAnchors } from '../api/smart/anchors.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const finds = [{ title: 'Old Pro Golf' }, { title: 'Seacrets' }];
assert('prompt lists finds with indexes', buildAnchorPrompt(finds, { location: 'OC' }).includes('[1] Seacrets') || buildAnchorPrompt(finds, { location: 'OC' }).includes('Seacrets'));
const anchors = validateAnchors({ anchors: [{ findIndex: 0, rationale: 'fun' }, { findIndex: 99, rationale: 'bad' }] }, finds);
assert('valid index resolves to its find', anchors.length === 1 && anchors[0].find.title === 'Old Pro Golf');
assert('anchor carries rationale', anchors[0].rationale === 'fun');
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node __tests__/smart-anchors.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// api/smart/anchors.js
import Anthropic from '@anthropic-ai/sdk';

function extractJSON(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

export function buildAnchorPrompt(finds, ctx) {
  const list = finds.map((f, i) => `[${i}] ${f.title}${f.snippet ? ` — ${f.snippet}` : ''} (${f.sourceLabel || ''})`).join('\n');
  return `Trip to ${ctx.location}. Candidate live finds:\n${list}\n\nPick the 1–3 that should ANCHOR the day — the most time-sensitive, unique, or delightful ones worth building around. Skip generic filler.\n\nReturn ONLY JSON: {"anchors":[{"findIndex":0,"rationale":"why this anchors the day"}]}`;
}

export function validateAnchors(raw, finds) {
  const arr = Array.isArray(raw?.anchors) ? raw.anchors : [];
  return arr
    .filter((a) => a && Number.isInteger(a.findIndex) && finds[a.findIndex])
    .map((a) => ({ find: finds[a.findIndex], rationale: typeof a.rationale === 'string' ? a.rationale : '' }))
    .slice(0, 3);
}

export async function pickAnchors(finds, ctx) {
  try {
    if (!finds.length) return [];
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
      system: 'You choose which live finds should anchor a day plan. Return only JSON.',
      messages: [{ role: 'user', content: buildAnchorPrompt(finds, ctx) }],
    });
    return validateAnchors(JSON.parse(extractJSON(msg.content[0]?.text ?? '{}')), finds);
  } catch (e) {
    console.warn('[anchors] failed:', e.message);
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node __tests__/smart-anchors.mjs`
Expected: PASS — `3 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add api/smart/anchors.js __tests__/smart-anchors.mjs
git commit -m "feat(smart): anchors — pick day-shaping finds (haiku)"
```

---

### Task 8: Synthesis (Sonnet) — build the opinionated itinerary

**Files:**
- Create: `api/smart/synthesis.js`
- Test: `__tests__/smart-synthesis.mjs`

**Interfaces:**
- Produces: `buildSynthesisPrompt({ places, finds, anchors, ctx }) → { system, user }`; `validateStops(raw) → Stop[]`; `runSynthesis({ places, finds, anchors, ctx }) → Promise<Stop[]>` (never throws — returns `[]` so the caller can fall back).

- [ ] **Step 1: Write the failing test**

```js
// __tests__/smart-synthesis.mjs — run: node __tests__/smart-synthesis.mjs
import { buildSynthesisPrompt, validateStops } from '../api/smart/synthesis.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const anchors = [{ find: { title: 'Old Pro Golf', lat: 38.4, lng: -75.05 }, rationale: 'mini golf icon' }];
const { system, user } = buildSynthesisPrompt({ places: { food: [], activity: [], shopping: [], outdoor: [] }, finds: [], anchors, ctx: { location: 'OC', prefs: {}, startTime: '11:00 AM', endTime: '8:00 PM' } });
assert('synthesis is Cheddar, opinionated', system.toLowerCase().includes('cheddar'));
assert('prompt injects the anchor', user.includes('Old Pro Golf'));

const stops = validateStops([
  { time: '11:00 AM', category: 'activity', name: 'X', place_id: 'find_old', lat: 38.4, lng: -75.05, reason: 'r', excitement_score: 90 },
  { name: 'no time' },
]);
assert('validateStops keeps complete stops', stops.length === 1 && stops[0].name === 'X');
assert('validateStops preserves provenance when present', validateStops([{ time: 't', category: 'activity', name: 'Y', place_id: 'find_y', lat: 1, lng: 2, reason: 'r', excitement_score: 50, provenance: { interest: 'pinball' } }])[0].provenance.interest === 'pinball');
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node __tests__/smart-synthesis.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// api/smart/synthesis.js
import Anthropic from '@anthropic-ai/sdk';

function extractJSON(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

export function buildSynthesisPrompt({ places, finds, anchors, ctx }) {
  const p = ctx.prefs || {};
  const anchorBlock = anchors.length
    ? anchors.map((a, i) => `ANCHOR ${i + 1}: ${a.find.title} @ (${a.find.lat},${a.find.lng}) — ${a.rationale} [${a.find.sourceLabel}]`).join('\n')
    : '(none — build from places and any finds below)';
  const findBlock = finds.slice(0, 20).map((f) => `- ${f.title}${f.snippet ? ` (${f.snippet})` : ''} @ (${f.lat},${f.lng}) [${f.interest}/${f.sourceLabel}]`).join('\n') || '(none)';

  const system = 'You are Cheddar, a warm, opinionated local friend who builds day plans. You make confident calls and lead with what makes the day special. Return ONLY a JSON array of stops, no prose.';

  const user = `City: ${ctx.location}
Window: ${ctx.startTime} to ${ctx.endTime}. Group: ${p.group_type || 'couple'}. Pace: ${p.pace || 'moderate'}. Budget: ${p.budget || '$$'}.
Dietary: ${(p.dietary || []).join(', ') || 'none'}.

## Anchors — build the day around these (they are the point)
${anchorBlock}

## Other live finds you may weave in
${findBlock}

## Nearby places (Google) to fill gaps
${JSON.stringify(places, null, 0).slice(0, 9000)}

Rules:
- Lead with the anchors — they shape the day, not the other way around. Put each anchor in at the right time.
- For an anchor or find used as a stop: set place_id to "find_" + a slug of its name, use its lat/lng, set category to its category, and add "provenance": {"interest","sourceLabel","why"}.
- Fill remaining stops from the Google places (use their exact place_id/lat/lng).
- Include lunch if midday is in the window and dinner if evening is. Match budget. Don't repeat a place.
- ${p.pace === 'relaxed' ? '4–5' : p.pace === 'packed' ? '7–8' : '5–6'} stops.

Return a JSON array. Each stop: time, duration_mins, category, name, place_id, address, lat, lng, reason, excitement_score, and provenance (only for anchor/find stops).`;

  return { system, user };
}

export function validateStops(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.filter((s) =>
    s && s.time && s.name && s.category &&
    (s.lat === 0 || typeof s.lat === 'number') && (s.lng === 0 || typeof s.lng === 'number')
  ).map((s) => ({
    time: s.time, duration_mins: Number(s.duration_mins) || 60, category: s.category,
    name: s.name, place_id: s.place_id || `stop_${Math.round((s.lat || 0) * 1000)}`,
    address: s.address || '', lat: s.lat, lng: s.lng,
    reason: s.reason || '', excitement_score: Number(s.excitement_score) || 70,
    ...(s.provenance ? { provenance: s.provenance } : {}),
  }));
}

export async function runSynthesis({ places, finds, anchors, ctx }) {
  try {
    const { system, user } = buildSynthesisPrompt({ places, finds, anchors, ctx });
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 4096,
      output_config: { effort: 'medium' },
      system, messages: [{ role: 'user', content: user }],
    });
    const stops = validateStops(JSON.parse(extractJSON(msg.content[0]?.text ?? '[]')));
    return stops;
  } catch (e) {
    console.warn('[synthesis] failed:', e.message);
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node __tests__/smart-synthesis.mjs`
Expected: PASS — `4 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add api/smart/synthesis.js __tests__/smart-synthesis.mjs
git commit -m "feat(smart): synthesis — opinionated itinerary build (sonnet)"
```

---

### Task 9: Orchestrator — runSmartEngine (never throws, degrades)

**Files:**
- Create: `api/smart/index.js`
- Test: `__tests__/smart-engine.mjs`

**Interfaces:**
- Consumes: `runScout`, `runDiscovery`, `pickAnchors`, `runSynthesis`.
- Produces: `runSmartEngine(args) → Promise<EngineResult>` where `args = { ctx, places }` and `EngineResult = { itinerary: Stop[]|null, anchors, finds, hadLiveData }`. Accepts an optional `deps` override (5th-style) for testing: `runSmartEngine(args, deps)` where `deps = { runScout, runDiscovery, pickAnchors, runSynthesis }`.

- [ ] **Step 1: Write the failing test**

```js
// __tests__/smart-engine.mjs — run: node __tests__/smart-engine.mjs
import { runSmartEngine } from '../api/smart/index.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

(async () => {
  const ctx = { location: 'OC', prefs: {}, coords: { latitude: 1, longitude: 2 } };
  const places = { food: [], activity: [], shopping: [], outdoor: [] };

  // Happy path with injected fakes
  const ok = await runSmartEngine({ ctx, places }, {
    runScout: async () => [{ interest: 'pinball', priority: 9, suggestedQuery: 'q' }],
    runDiscovery: async () => [{ title: 'Pin Bar', lat: 1, lng: 2 }],
    pickAnchors: async () => [{ find: { title: 'Pin Bar' }, rationale: 'r' }],
    runSynthesis: async () => [{ time: '11:00 AM', name: 'Pin Bar', category: 'activity', lat: 1, lng: 2, place_id: 'find_pin', reason: 'r', excitement_score: 90 }],
  });
  assert('returns itinerary on success', Array.isArray(ok.itinerary) && ok.itinerary.length === 1);
  assert('hadLiveData true when finds present', ok.hadLiveData === true);

  // Synthesis failure → itinerary null (caller falls back)
  const bad = await runSmartEngine({ ctx, places }, {
    runScout: async () => [{ interest: 'pinball', priority: 9, suggestedQuery: 'q' }],
    runDiscovery: async () => [{ title: 'Pin Bar' }],
    pickAnchors: async () => [],
    runSynthesis: async () => [],
  });
  assert('itinerary null when synthesis empty', bad.itinerary === null);

  // Total failure never throws
  const safe = await runSmartEngine({ ctx, places }, { runScout: async () => { throw new Error('boom'); } });
  assert('never throws; degrades to null', safe.itinerary === null && safe.hadLiveData === false);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node __tests__/smart-engine.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// api/smart/index.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node __tests__/smart-engine.mjs`
Expected: PASS — `5 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add api/smart/index.js __tests__/smart-engine.mjs
git commit -m "feat(smart): orchestrator — runSmartEngine with graceful degradation"
```

---

### Task 10: Integrate into the Vercel handler (`api/itinerary.js`)

Replace the Haiku itinerary call (and the old `runResearchPhase`) with `runSmartEngine`. Keep `buildFallbackItinerary`, driving-time enrichment, and the response shape (superset).

**Files:**
- Modify: `api/itinerary.js`

**Interfaces:**
- Consumes: `runSmartEngine` (Task 9).

- [ ] **Step 1: Swap the import**

Replace the top import line:
```js
import { runResearchPhase, formatResearchSummary } from './researchPhase.js';
```
with:
```js
import { runSmartEngine } from './smart/index.js';
```

- [ ] **Step 2: Build ctx and call the engine**

Find the block that currently runs `runResearchPhase` inside the `Promise.all` (the `const [npsParks, ridbFacilities, research] = await Promise.all([...])`). Replace the research entry and the later Claude `messages.create` itinerary call with the engine. Concretely, after `const allOutdoor=[...]` and after `npsParks`/`ridbFacilities` resolve, insert:

```js
    const ctx = {
      location: cityStr,
      travelDates: { start: travelDateISO, end: travelDateISO },
      coords: { latitude, longitude },
      maxMiles: 25,
      weather,
      prefs: { pace, budget, group_type, cuisines, activityStyles, dietary },
      feedback: { likedPlaces, dislikedPlaces, dislikedReasons },
      tripNote,
      startTime, endTime,
    };
    const smart = await runSmartEngine({
      ctx,
      places: { food, activity, shopping, outdoor: allOutdoor },
    });
```

(`activityStyles`, `dietary`, `tripNote` come from `req.body` — see Step 3.)

- [ ] **Step 3: Read the new request fields**

In the destructure of `req.body`, add `activityStyles = []`, `dietary = []`, `tripNote = ''` (preferences may also carry them — read whichever the client sends; default to `preferences.activity_styles` etc. if present):
```js
const { latitude, longitude, date, preferences = {}, startTime = '11:00 AM', endTime = '8:00 PM', feedback = {}, tripNote = '' } = req.body;
const { pace='moderate', budget='$$', group_type='couple', cuisines=[], activityStyles=[], dietary=[] } = preferences;
```

- [ ] **Step 4: Use the engine result, else fallback**

Replace the `let itinerary; let isFallback=false; try { ...Claude call... } catch { ...fallback... }` block with:
```js
    let itinerary, isFallback = false;
    if (smart.itinerary && smart.itinerary.length) {
      itinerary = smart.itinerary;
    } else {
      itinerary = buildFallbackItinerary({ food, activity, shopping, outdoor: allOutdoor, startTime, endTime, pace, lat: latitude, lng: longitude });
      isFallback = true;
    }
```

- [ ] **Step 5: Update the response metadata**

Replace the `research:{...}` object in the final `res.json(...)` with:
```js
      discovery: { hadLiveData: smart.hadLiveData, findCount: smart.finds.length, anchorCount: smart.anchors.length, anchors: smart.anchors.map((a) => ({ title: a.find?.title, interest: a.find?.interest, why: a.rationale })) },
```

- [ ] **Step 6: Verify it imports and runs**

Run: `node --check api/itinerary.js`
Expected: no output (valid). Then a live smoke (needs `.env` — see Task 12) is covered separately.

- [ ] **Step 7: Commit**

```bash
git add api/itinerary.js
git commit -m "feat(smart): wire engine into Vercel itinerary handler"
```

---

### Task 11: Integrate into the Expo Router handler (`app/api/itinerary+api.js`)

Mirror Task 10 in the Expo dev handler so local testing matches prod.

**Files:**
- Modify: `app/api/itinerary+api.js`

- [ ] **Step 1: Swap the import**

Replace:
```js
import { runResearchPhase, formatResearchSummary } from '../../api/researchPhase.js';
```
with:
```js
import { runSmartEngine } from '../../api/smart/index.js';
```

- [ ] **Step 2: Read new request fields**

In the `await request.json()` destructure add `tripNote = ''`; in the `preferences` destructure add `activityStyles = [], dietary = []` (alongside existing `cuisines`, `sensitivities`).

- [ ] **Step 3: Call the engine**

After `allOutdoor` is built and `npsParks`/`ridbFacilities` resolve, add the same `ctx` + `runSmartEngine` block as Task 10 Step 2 (use this file's variable names: it has `searchRadiusMeters` — set `maxMiles: Math.min(maxDistanceMiles, 50)`).

- [ ] **Step 4: Use engine result, else fallback**

Replace this file's Claude `messages.create` itinerary try/catch with the same engine-result-or-fallback logic as Task 10 Step 4 (this file's `buildFallbackItinerary` signature is identical).

- [ ] **Step 5: Update response metadata**

Add the same `discovery: {...}` object (Task 10 Step 5) to this file's `Response.json({...})`.

- [ ] **Step 6: Verify**

Run: `node --check "app/api/itinerary+api.js"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add "app/api/itinerary+api.js"
git commit -m "feat(smart): wire engine into Expo Router itinerary handler"
```

---

### Task 12: Client — send tripNote, activityStyles, dietary

**Files:**
- Modify: `services/itineraryService.js`
- Modify: `app/(tabs)/plan.js`

**Interfaces:**
- `generateItinerary` gains optional params `tripNote`, `activityStyles`, `dietary` and forwards them in the POST body.

- [ ] **Step 1: Extend `generateItinerary` signature + body**

In `services/itineraryService.js`, add `tripNote = '', activityStyles = [], dietary = []` to the destructured options, and include them in the `JSON.stringify({...})` body (put `activityStyles`/`dietary` inside `preferences` and `tripNote` at top level):
```js
body: JSON.stringify({ latitude, longitude, date, preferences: { ...preferences, activityStyles, dietary }, startTime, endTime, feedback, maxDistanceMiles, tripNote }),
```

- [ ] **Step 2: Add the trip-note input state in `plan.js`**

Near the other `useState` declarations, add:
```js
const [tripNote, setTripNote] = useState('');
```

- [ ] **Step 3: Render the input on the configuring view**

In the configuring view (where pace/budget controls render), add a single-line input (use existing themed styles; `COLORS` from `constants/theme.js`):
```jsx
<Text style={styles.fieldLabel}>Into anything specific this trip?</Text>
<TextInput
  style={styles.tripNoteInput}
  placeholder="e.g. pinball, vinyl, breweries, surf"
  placeholderTextColor={COLORS.textMuted}
  value={tripNote}
  onChangeText={setTripNote}
/>
```
Add a matching style:
```js
tripNoteInput: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: RADII.md, color: COLORS.textPrimary, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
```
(Import `RADII` from `constants/theme.js` if not already imported.)

- [ ] **Step 4: Load saved interest prefs and pass everything to generate**

In `generate()`, after the existing `AsyncStorage` reads, load activity styles + dietary and pass them:
```js
const [stylesRaw, dietRaw] = await Promise.all([
  AsyncStorage.getItem('@decide/activity_styles'),
  AsyncStorage.getItem('@decide/dietary'),
]);
const activityStyles = stylesRaw ? JSON.parse(stylesRaw) : [];
const dietary = dietRaw ? JSON.parse(dietRaw) : [];
```
Then add `tripNote, activityStyles, dietary` to the `generateItinerary({...})` call args.

- [ ] **Step 5: Reset tripNote with the other resets**

Add `setTripNote('');` to both `goToLanding` and `resetToConfiguring`.

- [ ] **Step 6: Verify**

Run: `node --check "app/(tabs)/plan.js" && node --check services/itineraryService.js`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/plan.js" services/itineraryService.js
git commit -m "feat(smart): client sends tripNote + activity styles + dietary"
```

---

### Task 13: Live end-to-end integration (gated)

A real run against live APIs for Ocean City, MD — proves interest-driven discovery actually surfaces `find_` stops, and proves the degradation path.

**Files:**
- Create: `__tests__/smart-engine-e2e.mjs`

- [ ] **Step 1: Write the e2e script (mirrors `__tests__/e2e-sim.mjs` env loading)**

```js
// __tests__/smart-engine-e2e.mjs — run: node __tests__/smart-engine-e2e.mjs
import fs from 'node:fs';
import path from 'node:path';
for (const line of fs.readFileSync(path.resolve('.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/\r$/, '').replace(/^"|"$/g, '');
}
const { runSmartEngine } = await import('file:///' + path.resolve('api/smart/index.js').replace(/\\/g, '/'));

let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const ctx = {
  location: 'Ocean City, MD', travelDates: { start: '2026-06-28', end: '2026-06-28' },
  coords: { latitude: 38.3365, longitude: -75.0849 }, maxMiles: 25, weather: null,
  prefs: { pace: 'moderate', budget: '$$', group_type: 'family', cuisines: [], activityStyles: ['arcades'], dietary: [] },
  feedback: {}, tripNote: 'we love pinball and vinyl', startTime: '11:00 AM', endTime: '8:00 PM',
};
const places = { food: [], activity: [], shopping: [], outdoor: [] };

const t = Date.now();
const res = await runSmartEngine({ ctx, places });
console.log(`took ${Date.now() - t}ms · finds=${res.finds.length} · anchors=${res.anchors.length} · hadLiveData=${res.hadLiveData}`);
console.log('anchors:', res.anchors.map((a) => a.find?.title));
assert('discovery surfaced finds', res.finds.length > 0);
assert('built an itinerary', Array.isArray(res.itinerary) && res.itinerary.length > 0);
assert('at least one interest-driven (find_) stop', (res.itinerary || []).some((s) => String(s.place_id).startsWith('find_')));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it**

Run: `node __tests__/smart-engine-e2e.mjs`
Expected: PASS — finds > 0, an itinerary built, and ≥1 `find_` stop (pinball/arcade). If the `find_` assertion fails but finds > 0, inspect the synthesis prompt — anchors may be empty; check `res.anchors`. Note: this consumes Anthropic tokens + a few Firecrawl credits.

- [ ] **Step 3: Commit**

```bash
git add __tests__/smart-engine-e2e.mjs
git commit -m "test(smart): live end-to-end discovery + synthesis"
```

---

### Task 14: Retire `researchPhase.js`

The engine supersedes it. Remove the dead module and its CLAUDE.md pointer.

**Files:**
- Delete: `api/researchPhase.js`
- Modify: `CLAUDE.md` (Live Research Phase section)

- [ ] **Step 1: Confirm no remaining imports**

Run: `grep -rn "researchPhase" api app services --include=*.js`
Expected: no results (Tasks 10–11 removed them). If any remain, fix them first.

- [ ] **Step 2: Delete the file**

```bash
git rm api/researchPhase.js
```

- [ ] **Step 3: Update CLAUDE.md**

In the `## Live Research Phase` section, replace the implementation line with:
```
Implementation: `api/smart/` (scout → registry/search discovery → anchors → Sonnet
synthesis), wired into both `app/api/itinerary+api.js` and `api/itinerary.js`.
Requires `FIRECRAWL_API_KEY`. Supersedes the old researchPhase module.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "refactor(smart): retire researchPhase in favor of the engine"
```

---

## Self-Review

- **Spec coverage:** scout (T6), sourceRegistry incl. Overpass/Pinball/fallback (T3) + keyless adapters (T4), discovery normalize/dedupe/4h-cache-with-interest-hash/parallel/search-cap (T5), anchors (T7), synthesis replacing Haiku call (T8, T10/11), orchestrator never-throws + degradation (T9), dual-handler integration (T10/11), client tripNote + activity_styles/dietary (T12), caching (T5), endpoint verification (T2), degradation behaviors (T9 test), cost guards — Haiku scout/anchors + Sonnet synthesis + search cap of 4 (T5/T8). All covered.
- **Placeholder scan:** every code step has complete code; no TBD/TODO; no "similar to Task N".
- **Type consistency:** `Find`/`Hunt`/`Anchor`/`Stop` shapes match across `normalizeFind`, `validateHunts`, `validateAnchors`, `validateStops`; `selectSources`/`run(ctx, interest)` signature consistent between registry (T3/T4) and discovery (T5); `runSmartEngine({ctx, places}, deps)` consistent between T9 and T10/11.
- **Note for executor:** the live tasks (T2, T13) need a valid `.env` with `FIRECRAWL_API_KEY` (fc- key) and `ANTHROPIC_API_KEY`; the unit tasks (T1, T3–T9) run offline.
