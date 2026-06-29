# Session 2 — Itinerary Generation Quality — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix seven itinerary-quality issues — activity-type bias, alcohol bias, missing live-music detection, missing website/phone links, missing pricing coverage, wrong-day weather, and navigation origin.

**Architecture:** The itinerary "brain" is the shared `api/smart/` engine (scout → discovery → anchors → synthesis), imported by **both** handlers (`api/itinerary.js` prod, `app/api/itinerary+api.js` Expo). Prompt/bias fixes edit the shared engine once. Pricing/weather/link logic is duplicated per handler, so new pure helpers go in a shared `api/itineraryHelpers.js` imported by both handlers and by the `__tests__/verify.mjs` TDD harness. Client UI changes live in `app/(tabs)/plan.js` and `screens/SpinScreen.js`.

**Tech Stack:** Expo SDK 56, expo-router, Node ESM serverless handlers, Anthropic SDK (haiku for scout/anchors/parse, sonnet for synthesis), Firecrawl, Google Places v1, wttr.in. Tests: `node __tests__/verify.mjs` (plain-Node assertion harness; pure functions only, no RN imports).

## Global Constraints

- **Expo SDK 56** — reference https://docs.expo.dev/versions/v56.0.0/ for any RN API.
- **Dual handlers stay in sync** — every handler-level change lands in BOTH `api/itinerary.js` and `app/api/itinerary+api.js`.
- **Cobalt-led, no orange CTAs** — new buttons/links use `COLORS.primary` (cobalt). Orange reserved for logo dot + food category.
- **No hardcoded hex** — all colors from `constants/theme.js` (`COLORS`).
- **Server-only keys** — Google (`GOOGLE_PLACES_API_KEY || EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`), Firecrawl (`FIRECRAWL_API_KEY`), Anthropic (`ANTHROPIC_API_KEY`) never reach the client.
- **AI assistant is "Cheddar"** in all user-facing copy — never "AI".
- **TDD harness** — `node __tests__/verify.mjs`; exits non-zero on failure. Pure helpers tested by importing from `api/` (no RN); RN-coupled logic verified manually.
- **Intent rule (Task 3 ↔ 8):** alcohol venues are blocked as filler, but allowed back when the venue is the live-music draw on the itinerary date.

---

## Task 1: Gate alcohol bias (spec Task 8)

**Files:**
- Modify: `api/smart/scout.js` (remove `"breweries"` seed example)
- Modify: `api/smart/sourceRegistry.js` (export `wantsAlcohol`, gate brewery source)
- Modify: `api/smart/discovery.js` (pass `ctx` so brewery source can be gated)
- Modify: `api/smart/synthesis.js` (hard-negative with live-music carve-out)
- Test: `__tests__/verify.mjs`

**Interfaces:**
- Produces: `wantsAlcohol(prefs, tripNote) -> boolean` exported from `api/smart/sourceRegistry.js`.

- [ ] **Step 1: Write the failing test for `wantsAlcohol`**

Add to `__tests__/verify.mjs` near the top, after the existing `import`-free helpers (this file imports nothing today; add a real import at the very top):

```js
import { wantsAlcohol } from '../api/smart/sourceRegistry.js';
```

Then add a test block before the Summary section:

```js
// ─── SESSION 2 — Alcohol gating ───────────────────────────────────────────────
console.log('\nSESSION 2 — wantsAlcohol gating:');
assert('Bars & Breweries style → true',  wantsAlcohol({ activityStyles: ['Bars & Breweries'] }, '') === true);
assert('tripNote mentions beer → true',  wantsAlcohol({}, 'want to grab a beer') === true);
assert('tripNote mentions brewery → true', wantsAlcohol({}, 'a brewery tour') === true);
assert('No drink signal → false',        wantsAlcohol({ activityStyles: ['Arcades'] }, 'pinball and parks') === false);
assert('Empty → false',                  wantsAlcohol({}, '') === false);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node __tests__/verify.mjs`
Expected: FAIL — `SyntaxError`/`does not provide an export named 'wantsAlcohol'`.

- [ ] **Step 3: Implement `wantsAlcohol` and gate the brewery source in `sourceRegistry.js`**

Add near the top of `api/smart/sourceRegistry.js` (after `const norm = ...`):

```js
const ALCOHOL_STYLE_RE = /bar|brewer|beer|wine|cocktail|drink|pub|distiller/i;

// True only when the user explicitly asked for drinking venues — via an activity
// style or a mention in their trip note. Used to gate the brewery data source so
// breweries are not injected as default filler.
export function wantsAlcohol(prefs = {}, tripNote = '') {
  const styles = (prefs.activityStyles || []).join(' ');
  return ALCOHOL_STYLE_RE.test(styles) || ALCOHOL_STYLE_RE.test(tripNote || '');
}
```

Change the brewery `run` so it short-circuits unless alcohol was requested. Replace the body's first line of `runBrewery` (currently `const { latitude, longitude } = ctx.coords;`) with:

```js
async function runBrewery(ctx, interest) {
  if (!wantsAlcohol(ctx.prefs, ctx.tripNote)) return [];
  const { latitude, longitude } = ctx.coords;
```

(Leave the rest of `runBrewery` unchanged.)

- [ ] **Step 4: Remove the `"breweries"` seed example from the scout prompt**

In `api/smart/scout.js`, the list inside `buildScoutPrompt` (line ~17) reads:

```
niche and concrete (e.g. "pinball", "arcades", "record stores", "breweries", "surf", "tides", "sunset"), not generic ("food").
```

Replace with (drop `"breweries"`):

```
niche and concrete (e.g. "pinball", "arcades", "record stores", "live music", "surf", "tides", "sunset"), not generic ("food").
```

- [ ] **Step 5: Add the synthesis hard-negative with the live-music carve-out**

In `api/smart/synthesis.js`, the `Rules:` block in `buildSynthesisPrompt` (lines ~30-35). Add one rule line immediately after the `- Include lunch ... Don't repeat a place.` line:

```
- Do not include bars, breweries, or alcohol-serving venues as stops unless the user explicitly requested them OR the venue is hosting live music on this date (a stop whose provenance interest is "live music").
```

- [ ] **Step 6: Confirm `ctx` reaches the brewery gate**

`runDiscovery` already calls `src.run({ ...ctx, query: hunt.suggestedQuery }, hunt.interest)` (`discovery.js:56`), and both handlers put `prefs` and `tripNote` on `ctx` (`api/itinerary.js:219,221`; `app/api/itinerary+api.js:354,356`). No change needed — verify by reading those lines.

- [ ] **Step 7: Run the test to verify it passes**

Run: `node __tests__/verify.mjs`
Expected: PASS — all `wantsAlcohol` assertions green, existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add api/smart/scout.js api/smart/sourceRegistry.js api/smart/synthesis.js __tests__/verify.mjs
git commit -m "fix: remove alcohol bias from itinerary generation prompt"
```

---

## Task 2: Cap activity-type bias / proportional representation (spec Task 2)

**Files:**
- Modify: `api/smart/scout.js` (equal-weighting + de-dup instruction)
- Modify: `api/smart/synthesis.js` (per-type cap rule + pass raw `tripNote`/`activityStyles`)
- Test: `__tests__/verify.mjs` (assert prompt text guards)

**Interfaces:**
- Consumes: `buildSynthesisPrompt({ places, finds, anchors, ctx })` from Task 1 (same file).
- Produces: `buildScoutPrompt(ctx)` and `buildSynthesisPrompt(...)` strings now contain cap/equal-weight language (asserted in tests).

- [ ] **Step 1: Write failing guard tests**

Add to `__tests__/verify.mjs`:

```js
import { buildScoutPrompt } from '../api/smart/scout.js';
import { buildSynthesisPrompt } from '../api/smart/synthesis.js';
```

```js
// ─── SESSION 2 — Activity-type balance guards ─────────────────────────────────
console.log('\nSESSION 2 — Activity-type balance:');
const scoutP = buildScoutPrompt({ location: 'X', tripNote: 'pinball and live music', prefs: {} });
assert('Scout asks for equal weight', /equal|do not let repetition|distinct/i.test(scoutP));
const synthP = buildSynthesisPrompt({
  places: {}, finds: [], anchors: [],
  ctx: { location: 'X', startTime: '11:00 AM', endTime: '8:00 PM', tripNote: 'pinball and live music', prefs: { activityStyles: ['Live Music'] } },
}).user;
assert('Synthesis caps a single type',  /at most 1.?2 stops|cap any single|no more than (1|2)/i.test(synthP));
assert('Synthesis sees the trip note',  synthP.includes('pinball and live music'));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node __tests__/verify.mjs`
Expected: FAIL — the three new assertions fail (text not present yet).

- [ ] **Step 3: Add equal-weighting to the scout prompt**

In `api/smart/scout.js`, replace the instruction sentence (line ~17, the `List up to 8 ...` line) with:

```
List up to 8 specific, hunt-able interests this person would light up about — niche and concrete (e.g. "pinball", "arcades", "record stores", "live music", "surf", "tides", "sunset"), not generic ("food"). Treat each distinct interest with equal weight: do not let repetition or emphasis of one interest inflate it — collapse repeated mentions of the same thing into a single interest. If several different interests appear, surface all of them.
```

- [ ] **Step 4: Add the per-type cap and pass raw intent to synthesis**

In `api/smart/synthesis.js`, inside `buildSynthesisPrompt`, add two lines to the `user` template. First, just below the `Dietary:` line (line ~19), add the raw intent so the builder sees it directly:

```js
Requested activity styles: ${(p.activityStyles || []).join(', ') || 'none'}.
What they said for this trip: "${ctx.tripNote || ''}".
```

Then in the `Rules:` block, add after the stop-count rule (line ~35):

```
- Balance activity types: include at most 1–2 stops of any single activity type, no matter how strongly it was requested. If the traveler asked for multiple activity types, represent each of them across the day rather than over-filling one.
- If a requested activity type cannot be sourced from the anchors, finds, or places, add a short note stop or call it out in a stop's reason rather than silently dropping it.
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node __tests__/verify.mjs`
Expected: PASS — equal-weight, cap, and trip-note assertions green.

- [ ] **Step 6: Commit**

```bash
git add api/smart/scout.js api/smart/synthesis.js __tests__/verify.mjs
git commit -m "fix: cap activity type repetition and enforce proportional representation in itinerary generation"
```

---

## Task 3: Live music detection (spec Task 3)

**Files:**
- Create: `api/smart/liveMusic.js`
- Modify: `api/smart/sourceRegistry.js` (register gated live-music source)
- Modify: `api/smart/discovery.js` (inject a guaranteed live-music hunt when requested)
- Modify: `app/(tabs)/plan.js` (render `live_music` info on stop card + detail modal)
- Test: `__tests__/verify.mjs`

**Interfaces:**
- Consumes: `firecrawlSearch`, `firecrawlScrape` from `api/smart/firecrawl.js`; `wantsAlcohol` pattern from Task 1.
- Produces:
  - `wantsLiveMusic(prefs, tripNote) -> boolean`
  - `summarizeShow(show) -> string` (formats a parsed show into a card snippet)
  - `runLiveMusic(ctx, interest) -> Promise<Find[]>` (source-shaped; finds carry `when`, `live_music: { artist, showtime, confirmed }`, `needsTickets`)
  - Each find: `{ title, category:'activity', interest:'live music', lat, lng, address, when, url, snippet, sourceLabel, live_music }`

- [ ] **Step 1: Write failing tests for the pure helpers**

Add to `__tests__/verify.mjs`:

```js
import { wantsLiveMusic, summarizeShow } from '../api/smart/liveMusic.js';
```

```js
// ─── SESSION 2 — Live music ───────────────────────────────────────────────────
console.log('\nSESSION 2 — Live music:');
assert('Live Music style → true',     wantsLiveMusic({ activityStyles: ['Live Music'] }, '') === true);
assert('tripNote concert → true',      wantsLiveMusic({}, 'see a concert tonight') === true);
assert('tripNote band → true',         wantsLiveMusic({}, 'catch a band') === true);
assert('No music signal → false',      wantsLiveMusic({ activityStyles: ['Arcades'] }, 'pinball') === false);
assert('Confirmed show snippet',       summarizeShow({ artist: 'The Beths', showtime: '8 PM', confirmed: true }) === '🎵 The Beths · 8 PM');
assert('Unconfirmed → likely note',    /Live music likely/i.test(summarizeShow({ confirmed: false, url: 'https://v.com' })));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node __tests__/verify.mjs`
Expected: FAIL — module `api/smart/liveMusic.js` does not exist.

- [ ] **Step 3: Create `api/smart/liveMusic.js`**

```js
import Anthropic from '@anthropic-ai/sdk';
import { firecrawlSearch, firecrawlScrape } from './firecrawl.js';

const MUSIC_STYLE_RE = /live music|concert|\bgig\b|\bband\b|\bshow\b|music venue|\bdj\b/i;
const MAX_VENUES = 4; // cap concurrent scrapes — keeps latency to one scrape round

function extractJSON(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

// True only when live music was explicitly requested. Gates the whole feature so
// it never adds latency to a build that did not ask for it.
export function wantsLiveMusic(prefs = {}, tripNote = '') {
  const styles = (prefs.activityStyles || []).join(' ');
  return MUSIC_STYLE_RE.test(styles) || MUSIC_STYLE_RE.test(tripNote || '');
}

// Card-ready one-liner for a parsed show.
export function summarizeShow(show) {
  if (show && show.confirmed && show.artist) {
    return `🎵 ${show.artist}${show.showtime ? ` · ${show.showtime}` : ''}`;
  }
  const where = show?.url ? ` — check ${show.url}` : '';
  return `Live music likely${where} for the current schedule`;
}

// Ask haiku to pull confirmed shows for the date out of scraped venue pages.
// deps.client is injectable for tests. Returns [] on any failure.
export async function parseShows(pages, dateISO, deps = {}) {
  const usable = (pages || []).filter((p) => p && p.content);
  if (!usable.length) return [];
  try {
    const client = deps.client || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const blocks = usable
      .map((p, i) => `[${i}] ${p.title} <${p.url}>\n${p.content.slice(0, 2500)}`)
      .join('\n\n');
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
      system: 'You extract live-music shows for a specific date from scraped venue pages. Return only JSON.',
      messages: [{ role: 'user', content:
        `Date of interest: ${dateISO}. Venue pages:\n\n${blocks}\n\n` +
        `For each page that lists a show on that exact date, return the act and start time. ` +
        `Return ONLY JSON: {"shows":[{"pageIndex":0,"artist":"","showtime":""}]}` }],
    });
    const raw = JSON.parse(extractJSON(msg.content[0]?.text ?? '{}'));
    const out = [];
    for (const s of raw.shows || []) {
      const p = usable[s.pageIndex];
      if (p && s.artist) out.push({ url: p.url, artist: String(s.artist), showtime: String(s.showtime || ''), confirmed: true });
    }
    return out;
  } catch (e) {
    console.warn('[livemusic] parse failed:', e.message);
    return [];
  }
}

// Source-shaped runner. Searches the web for live music on the date, scrapes the
// top candidate venue pages concurrently, and returns finds. Confirmed shows get
// artist/showtime; unconfirmed candidates become "live music likely" finds.
export async function runLiveMusic(ctx, interest, deps = {}) {
  const search = deps.firecrawlSearch || firecrawlSearch;
  const scrape = deps.firecrawlScrape || firecrawlScrape;
  const date = ctx.travelDates?.start || '';
  try {
    const results = await search(`live music in ${ctx.location} on ${date}`, MAX_VENUES);
    const candidates = (results || []).filter((r) => r.url).slice(0, MAX_VENUES);
    if (!candidates.length) return [];

    const pages = await Promise.all(candidates.map(async (c) => {
      try { return { title: c.title, url: c.url, content: await scrape(c.url) }; }
      catch (e) { console.warn(`[livemusic] scrape ${c.url} failed: ${e.message}`); return { title: c.title, url: c.url, content: '' }; }
    }));

    const shows = await parseShows(pages, date, deps);
    const showByUrl = new Map(shows.map((s) => [s.url, s]));

    return candidates.map((c) => {
      const show = showByUrl.get(c.url) || { confirmed: false, url: c.url };
      return {
        title: c.title, category: 'activity', interest: 'live music',
        lat: null, lng: null, address: '', when: date,
        url: c.url, snippet: summarizeShow(show), sourceLabel: 'Live music',
        needsTickets: !!show.confirmed,
        live_music: { artist: show.artist || null, showtime: show.showtime || null, confirmed: !!show.confirmed },
      };
    });
  } catch (e) {
    console.warn('[livemusic] failed:', e.message);
    return [];
  }
}
```

- [ ] **Step 4: Run the helper tests to verify they pass**

Run: `node __tests__/verify.mjs`
Expected: PASS — `wantsLiveMusic` and `summarizeShow` assertions green.

- [ ] **Step 5: Register the live-music source (gated) in `sourceRegistry.js`**

At the top of `api/smart/sourceRegistry.js`, add the import:

```js
import { runLiveMusic, wantsLiveMusic } from './liveMusic.js';
```

Add a source entry to the `SOURCES` array (before `SEARCH_FALLBACK`):

```js
  { key: 'livemusic', match: ['live music', 'concert', 'show', 'band', 'gig', 'dj'],
    run: async (ctx, interest) => (wantsLiveMusic(ctx.prefs, ctx.tripNote) ? runLiveMusic(ctx, interest) : []) },
```

- [ ] **Step 6: Inject a guaranteed live-music hunt in `discovery.js`**

In `api/smart/runDiscovery` (`discovery.js`), right after `const interests = hunts.map((h) => h.interest);` (line ~41), add a guaranteed hunt so the feature fires even if scout didn't surface it:

```js
    // Guarantee a live-music hunt when explicitly requested (scout may miss it).
    const askedMusic = (ctx.prefs?.activityStyles || []).join(' ').match(/live music/i)
      || (ctx.tripNote || '').match(/live music|concert|\bband\b|\bgig\b/i);
    if (askedMusic && !interests.some((i) => /live music|concert/i.test(i))) {
      hunts = [...hunts, { interest: 'live music', why: 'requested', priority: 9, suggestedQuery: `live music ${ctx.location}` }];
    }
```

Change the function signature line `export async function runDiscovery(hunts, ctx) {` so `hunts` is reassignable — it already is a parameter (`let` not needed; reassigning a param is fine). Recompute `interests` after the injection: move `const interests = hunts.map((h) => h.interest);` to AFTER this block, or add `const interestsAfter = hunts.map((h) => h.interest);` and use it for the cache key. Simplest: place the injection block FIRST, then compute `interests`. Final order:

```js
  try {
    let huntList = hunts;
    const askedMusic = (ctx.prefs?.activityStyles || []).join(' ').match(/live music/i)
      || (ctx.tripNote || '').match(/live music|concert|\bband\b|\bgig\b/i);
    if (askedMusic && !huntList.some((h) => /live music|concert/i.test(h.interest))) {
      huntList = [...huntList, { interest: 'live music', why: 'requested', priority: 9, suggestedQuery: `live music ${ctx.location}` }];
    }
    const interests = huntList.map((h) => h.interest);
    const cacheKey = discoveryCacheKey(ctx.location, interests);
```

…and replace the later `const ranked = [...hunts]...` with `const ranked = [...huntList]...`.

- [ ] **Step 7: Render live-music info on the stop card and detail modal**

Live-music finds flow through synthesis as stops with `provenance.interest === 'live music'`; synthesis is told to keep provenance. To surface artist/showtime, the synthesis prompt should copy the find snippet into the stop. Add to the synthesis `Rules:` block (in `api/smart/synthesis.js`, the same place edited in Task 2) one line:

```
- If a stop is a live-music venue (provenance interest "live music"), copy its show info into a "live_music" field on the stop: {"note": the find's snippet}.
```

Then in `api/smart/synthesis.js` `validateStops`, preserve the field — add to the mapped object (after the `provenance` spread, line ~53):

```js
    ...(s.live_music ? { live_music: s.live_music } : {}),
```

In `app/(tabs)/plan.js` `StopCard`, render the note. After the `admissionBadge` block (line ~477), add:

```jsx
          {stop.live_music?.note ? (
            <View style={styles.liveMusicBadge}>
              <Ionicons name="musical-notes-outline" size={12} color={COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={styles.liveMusicTxt} numberOfLines={1}>{stop.live_music.note}</Text>
            </View>
          ) : null}
```

Add styles to the `StyleSheet.create({...})` in `plan.js` (near `admissionBadge`):

```js
  liveMusicBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADII.sm6, backgroundColor: COLORS.sky100 },
  liveMusicTxt:   { fontFamily: FONTS.body500, fontSize: 12, color: COLORS.primary },
```

(Confirm `RADII` and `FONTS` are already imported in `plan.js` — they are used throughout; if `FONTS.body500` is not the exact token, match the variant used by `admissionBadgeTxt`.)

In the `PlaceDetailModal`, surface the same note. After the `admissionRow` block (line ~309), add:

```jsx
              {stop.live_music?.note ? (
                <View style={styles.admissionRow}>
                  <Ionicons name="musical-notes-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.admissionLabel}>Live music</Text>
                  <Text style={styles.admissionValue}>{stop.live_music.note}</Text>
                </View>
              ) : null}
```

- [ ] **Step 8: Run tests + sanity-check the engine compiles**

Run: `node __tests__/verify.mjs`
Expected: PASS.
Run: `node -e "import('./api/smart/index.js').then(()=>console.log('engine ok'))"`
Expected: prints `engine ok` (no import/syntax errors).

- [ ] **Step 9: Commit**

```bash
git add api/smart/liveMusic.js api/smart/sourceRegistry.js api/smart/discovery.js api/smart/synthesis.js "app/(tabs)/plan.js" __tests__/verify.mjs
git commit -m "feat: add live music detection and artist info to qualifying itinerary stops"
```

---

## Task 4: Pricing advisor everywhere (spec Task 5)

**Files:**
- Create: `api/itineraryHelpers.js` (shared pure helper)
- Modify: `api/itinerary.js` + `app/api/itinerary+api.js` (compute `cost_summary`, return in `meta`)
- Modify: `app/(tabs)/plan.js` (render day-total in `itineraryMeta`)
- Modify: `screens/SpinScreen.js` (price tier on result card)
- Test: `__tests__/verify.mjs`

**Interfaces:**
- Produces: `computeCostSummary(stops) -> { low:number, high:number, label:string } | null` from `api/itineraryHelpers.js`. `label` like `"~$40–$75 for the day"`; returns `null` when no priced stops.
- Produces (handlers): `meta.cost_summary` string (the `label`, or omitted when null).

- [ ] **Step 1: Write the failing test for `computeCostSummary`**

Add to `__tests__/verify.mjs`:

```js
import { computeCostSummary } from '../api/itineraryHelpers.js';
```

```js
// ─── SESSION 2 — Cost summary ─────────────────────────────────────────────────
console.log('\nSESSION 2 — Cost summary:');
const cs = computeCostSummary([
  { category: 'activity', admission_cost: '$15/adult' },
  { category: 'food', price_level: 2 },
  { category: 'outdoor', admission_cost: 'Free' },
  { category: 'food', price_level: 3 },
]);
assert('Returns a label', typeof cs?.label === 'string' && cs.label.includes('for the day'));
assert('Low ≤ high',       cs.low <= cs.high);
assert('Free contributes 0 low', cs.low >= 15); // 15 admission + food mins
assert('No priced stops → null', computeCostSummary([{ category: 'outdoor' }]) === null);
assert('Empty → null',           computeCostSummary([]) === null);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node __tests__/verify.mjs`
Expected: FAIL — `api/itineraryHelpers.js` not found.

- [ ] **Step 3: Create `api/itineraryHelpers.js`**

```js
// Shared pure helpers for both itinerary handlers (no RN, no SDK imports).

// Per-person price-level → rough USD [low, high] for a food/drink stop.
const PRICE_LEVEL_USD = { 1: [8, 15], 2: [15, 30], 3: [30, 60], 4: [60, 120] };

function admissionUSD(text) {
  if (!text || /free/i.test(text)) return [0, 0];
  const nums = String(text).match(/\d+(\.\d+)?/g);
  if (!nums) return null; // "Prices vary — check website" → unknown, skip
  const vals = nums.map(Number);
  return [Math.min(...vals), Math.max(...vals)];
}

// Sum a [low, high] day-cost range across stops. Returns null when nothing is priced.
export function computeCostSummary(stops) {
  let low = 0, high = 0, priced = 0;
  for (const s of stops || []) {
    let range = null;
    if (s.admission_cost != null) range = admissionUSD(s.admission_cost);
    if (!range && s.price_level && PRICE_LEVEL_USD[s.price_level]) range = PRICE_LEVEL_USD[s.price_level];
    if (!range) continue;
    low += range[0]; high += range[1]; priced++;
  }
  if (!priced) return null;
  const fmt = (n) => `$${Math.round(n)}`;
  const label = low === high ? `~${fmt(low)} for the day` : `~${fmt(low)}–${fmt(high)} for the day`;
  return { low, high, label };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node __tests__/verify.mjs`
Expected: PASS — cost-summary assertions green.

- [ ] **Step 5: Wire `cost_summary` into the prod handler `api/itinerary.js`**

Add the import at the top (after line 1):

```js
import { computeCostSummary } from './itineraryHelpers.js';
```

In the response (`return res.json({...})`, line ~237), compute and add to `meta`. Just before the `return res.json`, add:

```js
    const costSummary = computeCostSummary(enriched);
```

Then add `cost_summary: costSummary?.label ?? null` inside the `meta:{...}` object.

- [ ] **Step 6: Mirror into the Expo handler `app/api/itinerary+api.js`**

Add the import at the top (after line 1):

```js
import { computeCostSummary } from '../../api/itineraryHelpers.js';
```

Before the `return Response.json({...})` (line ~387), add:

```js
    const costSummary = computeCostSummary(enriched);
```

Add `cost_summary: costSummary?.label ?? null` inside the `meta:{...}` object (line ~390-396).

- [ ] **Step 7: Render the day-total in `plan.js` header**

In `app/(tabs)/plan.js` `itineraryMeta` block, after the `metaChips` `</View>` (line ~1077) and before the `research?.hadLiveData` note, add:

```jsx
                  {meta.cost_summary ? (
                    <View style={styles.costSummaryRow}>
                      <Ionicons name="wallet-outline" size={14} color={COLORS.primary} style={{ marginRight: 5 }} />
                      <Text style={styles.costSummaryTxt}>{meta.cost_summary}</Text>
                    </View>
                  ) : null}
```

Add styles near `itineraryMeta`:

```js
  costSummaryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  costSummaryTxt: { fontFamily: FONTS.body600, fontSize: 13, color: COLORS.primary },
```

(Match `FONTS.body600` to the variant used by nearby meta text if the token name differs.)

- [ ] **Step 8: Add a price tier to the Quick Spin result card**

First confirm the Spin path carries `price_level`. In `screens/SpinScreen.js`, the result spread is `setResult({ ...pick, ... })` (line ~143) where `pick` comes from `fetchNearbyPlaces`. Verify `fetchNearbyPlaces` (in `services/placesService.js`) maps `price_level`/`priceLevel`; if the field mask omits it, add `places.priceLevel` to the mask and `price_level: p.priceLevel ?? null` to the mapping. Then render it after the rating block (line ~243):

```jsx
                {result.price_level ? (
                  <Text style={styles.resultPrice}>{['', '$', '$$', '$$$', '$$$$'][result.price_level] ?? ''}</Text>
                ) : null}
```

Add the style near `resultRating` in `SpinScreen.js`:

```js
  resultPrice: { fontFamily: FONTS.body600, fontSize: 14, color: COLORS.primary },
```

(Confirm `FONTS` is imported in `SpinScreen.js`; match the token to `resultRating`'s family if needed.)

- [ ] **Step 9: Run tests + commit**

Run: `node __tests__/verify.mjs`
Expected: PASS.

```bash
git add api/itineraryHelpers.js api/itinerary.js "app/api/itinerary+api.js" "app/(tabs)/plan.js" screens/SpinScreen.js services/placesService.js __tests__/verify.mjs
git commit -m "feat: ensure pricing advisor is present on all itinerary types"
```

---

## Task 5: Weather tied to itinerary date (spec Task 6)

**Files:**
- Modify: `api/itineraryHelpers.js` (add `pickForecastForDate`)
- Modify: `api/itinerary.js` + `app/api/itinerary+api.js` (use date in `fetchWeather`, fix traffic month)
- Modify: `app/(tabs)/plan.js` (render extended-forecast fallback)
- Test: `__tests__/verify.mjs`

**Interfaces:**
- Produces: `pickForecastForDate(j1, dateISO) -> { condition, temp_f, feels_like_f, wind_speed_mph, wind_dir, beyondForecast:boolean } | null`. Uses `j1.weather[]` matched by `date`; falls back to `current_condition[0]` only when `dateISO` is today; sets `beyondForecast:true` when the date is past the forecast window.

- [ ] **Step 1: Write the failing test for `pickForecastForDate`**

Add to `__tests__/verify.mjs`:

```js
import { pickForecastForDate } from '../api/itineraryHelpers.js';
```

```js
// ─── SESSION 2 — Weather by date ──────────────────────────────────────────────
console.log('\nSESSION 2 — Weather by date:');
const j1 = {
  current_condition: [{ weatherDesc: [{ value: 'Sunny' }], temp_F: '70', FeelsLikeF: '69', windspeedMiles: '5', winddir16Point: 'N' }],
  weather: [
    { date: '2026-07-01', hourly: [{ weatherDesc: [{ value: 'Cloudy' }], tempF: '66', FeelsLikeF: '64', windspeedMiles: '10', winddir16Point: 'E', time: '1200' }] },
    { date: '2026-07-02', hourly: [{ weatherDesc: [{ value: 'Rain' }],   tempF: '60', FeelsLikeF: '58', windspeedMiles: '14', winddir16Point: 'S', time: '1200' }] },
  ],
};
const day1 = pickForecastForDate(j1, '2026-07-02');
assert('Matches the requested date', day1?.condition === 'Rain');
assert('Not flagged beyond',         day1?.beyondForecast === false);
const far = pickForecastForDate(j1, '2026-09-01');
assert('Beyond window flagged',      far?.beyondForecast === true);
assert('Null data → null',           pickForecastForDate(null, '2026-07-02') === null);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node __tests__/verify.mjs`
Expected: FAIL — `pickForecastForDate` not exported.

- [ ] **Step 3: Add `pickForecastForDate` to `api/itineraryHelpers.js`**

```js
// Pick the forecast for a specific date from a wttr.in j1 payload. Prefers the
// midday hourly entry of the matching day; flags dates past the forecast window.
export function pickForecastForDate(j1, dateISO) {
  if (!j1) return null;
  const days = Array.isArray(j1.weather) ? j1.weather : [];
  const match = days.find((d) => d.date === dateISO);
  if (match) {
    const hours = match.hourly || [];
    const noon = hours.find((h) => h.time === '1200') || hours[Math.floor(hours.length / 2)] || hours[0] || {};
    return {
      condition: noon.weatherDesc?.[0]?.value ?? 'Clear',
      temp_f: noon.tempF, feels_like_f: noon.FeelsLikeF,
      wind_speed_mph: noon.windspeedMiles ?? null, wind_dir: noon.winddir16Point ?? null,
      beyondForecast: false,
    };
  }
  // Date not in the forecast window. If it's the last covered day or earlier we'd
  // have matched; otherwise it's beyond. Use current_condition only as a today fallback.
  const lastDate = days.length ? days[days.length - 1].date : null;
  const beyond = lastDate ? dateISO > lastDate : true;
  if (beyond) return { condition: null, temp_f: null, feels_like_f: null, wind_speed_mph: null, wind_dir: null, beyondForecast: true };
  const c = j1.current_condition?.[0];
  if (!c) return null;
  return {
    condition: c.weatherDesc?.[0]?.value ?? 'Clear',
    temp_f: c.temp_F, feels_like_f: c.FeelsLikeF,
    wind_speed_mph: c.windspeedMiles ?? null, wind_dir: c.winddir16Point ?? null,
    beyondForecast: false,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node __tests__/verify.mjs`
Expected: PASS.

- [ ] **Step 5: Use the date in the prod handler `api/itinerary.js`**

Add to the import from `./itineraryHelpers.js` (Task 4 added `computeCostSummary`): make it `import { computeCostSummary, pickForecastForDate } from './itineraryHelpers.js';` and import the emoji helper is already local (`getWeatherEmoji`).

Change `fetchWeather` (line ~97) to accept a date and use the forecast picker:

```js
async function fetchWeather(lat, lng, dateISO) {
  const key = `${cacheKey(lat, lng)}@${dateISO}`;
  const cached = cacheGet(weatherCache, key);
  if (cached) return cached;
  try {
    const res = await fetch(`https://wttr.in/${lat},${lng}?format=j1`);
    const data = await res.json();
    const f = pickForecastForDate(data, dateISO);
    if (!f) return null;
    if (f.beyondForecast) {
      const result = { beyondForecast: true, condition: null, emoji: '🗓', temp_f: null, feels_like_f: null, wind_speed_mph: null, wind_dir: null };
      cacheSet(weatherCache, key, result);
      return result;
    }
    const result = { condition: f.condition, emoji: getWeatherEmoji(f.condition), temp_f: f.temp_f, feels_like_f: f.feels_like_f, wind_speed_mph: f.wind_speed_mph, wind_dir: f.wind_dir, beyondForecast: false };
    cacheSet(weatherCache, key, result);
    return result;
  } catch { return null; }
}
```

The handler computes `travelDateISO` at line ~204 but calls `fetchWeather` at line ~192 (before that). Move the `dateObj`/`travelDateISO` derivation (lines ~198-204) ABOVE the `Promise.all` (line ~190), then change the weather call to `fetchWeather(latitude, longitude, travelDateISO)`.

Fix the seasonal/traffic month: this handler delegates distance enrichment to OpenRoute only and does not compute a `trafficNote` inline (that's the Expo handler). No month fix needed here. Confirm by reading — `api/itinerary.js` has no `getMonth()`.

- [ ] **Step 6: Mirror into the Expo handler `app/api/itinerary+api.js`**

Update the import to `import { computeCostSummary, pickForecastForDate } from '../../api/itineraryHelpers.js';`.

The Expo handler computes `travelDateISO` at line ~330 but calls `fetchWeather` in the `Promise.all` at line ~319. Move the `dateObj`/`dayOfWeek`/`formattedDate`/`travelDateISO` block (lines ~325-330) ABOVE the `Promise.all` (line ~314). Change `fetchWeather` to:

```js
async function fetchWeather(lat, lng, dateISO) {
  try {
    const res  = await fetch(`https://wttr.in/${lat},${lng}?format=j1`);
    const data = await res.json();
    const f = pickForecastForDate(data, dateISO);
    if (!f) return null;
    if (f.beyondForecast) return { beyondForecast: true, condition: null, emoji: '🗓', temp_f: null, feels_like_f: null, wind_speed_mph: null, wind_dir: null };
    return { condition: f.condition, emoji: getWeatherEmoji(f.condition), temp_f: f.temp_f, feels_like_f: f.feels_like_f, wind_speed_mph: f.wind_speed_mph, wind_dir: f.wind_dir, beyondForecast: false };
  } catch { return null; }
}
```

Update the call to `fetchPlaces(...)` siblings: change the weather line in the `Promise.all` to `fetchWeather(latitude, longitude, travelDateISO)`.

Fix the traffic-note month (line ~376) to use the itinerary date, not today:

```js
      const planMonth = dateObj.getMonth();
      const trafficNote = (weather?.wind_speed_mph > 20 || (planMonth >= 5 && planMonth <= 8))
        ? ' (traffic may vary)' : '';
```

- [ ] **Step 7: Render the extended-forecast fallback in `plan.js`**

In `app/(tabs)/plan.js`, the `weatherPillText` (line ~915). Update to honor `beyondForecast`:

```js
  const weatherPillText  = weather?.beyondForecast
    ? `🗓 Extended forecast not available — check back closer to your trip · ${meta?.time_window ?? `${startTime} – ${endTime}`}`
    : weather
    ? `${weather.emoji ?? ''} ${weather.condition} · ${weather.temp_f}°F${weather.wind_speed_mph ? ` · 💨 ${weather.wind_speed_mph}mph` : ''} · ${meta?.time_window ?? `${startTime} – ${endTime}`}`
    : `${startTime} – ${endTime}`;
```

- [ ] **Step 8: Run tests + commit**

Run: `node __tests__/verify.mjs`
Expected: PASS.

```bash
git add api/itineraryHelpers.js api/itinerary.js "app/api/itinerary+api.js" "app/(tabs)/plan.js" __tests__/verify.mjs
git commit -m "fix: ensure weather reflects itinerary date, not current day"
```

---

## Task 6: Restore Website & Call links on every stop card (spec Task 4)

**Files:**
- Modify: `api/itinerary.js` + `app/api/itinerary+api.js` (enrich stops with `website`/`phone`)
- Modify: `app/(tabs)/plan.js` (`StopCard` Website/Call links)
- (Reuse: `api/places/details` endpoint already used by the detail modal)

**Interfaces:**
- Consumes: Google Places Details (legacy JSON) fields `website`, `formatted_phone_number`.
- Produces: each stop object gains `website: string|null` and `phone: string|null` (only for Google `place_id`s; synthetic ids untouched).

- [ ] **Step 1: Add a server-side details enricher to the prod handler `api/itinerary.js`**

After `enrichWithDrivingTimes` (line ~160), add:

```js
async function fetchStopDetails(placeId) {
  if (!GOOGLE_KEY || !placeId || /^(demo_|nps_|ridb_|fallback_|find_|stop_)/.test(placeId)) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,formatted_phone_number&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    return { website: data.result?.website ?? null, phone: data.result?.formatted_phone_number ?? null };
  } catch { return null; }
}

async function enrichWithContactLinks(itinerary) {
  const out = await Promise.all(itinerary.map(async (stop) => {
    if (stop.website || stop.phone) return stop;
    const d = await fetchStopDetails(stop.place_id);
    return d ? { ...stop, website: d.website, phone: d.phone } : stop;
  }));
  return out;
}
```

- [ ] **Step 2: Call the enricher in the prod handler response path**

In `api/itinerary.js`, change `const enriched=await enrichWithDrivingTimes(itinerary);` (line ~236) to:

```js
    const withLinks = await enrichWithContactLinks(itinerary);
    const enriched = await enrichWithDrivingTimes(withLinks);
```

- [ ] **Step 3: Mirror the enricher into the Expo handler `app/api/itinerary+api.js`**

Add the same `fetchStopDetails` + `enrichWithContactLinks` functions after `enrichWithDrivingTimes` (line ~215). Then in the response path, the Expo handler builds `withDistance` then `enriched = await enrichWithDrivingTimes(withDistance)` (line ~385). Change to:

```js
    const withLinks = await enrichWithContactLinks(withDistance);
    const enriched = await enrichWithDrivingTimes(withLinks);
```

- [ ] **Step 4: Add Website/Call links to `StopCard` in `plan.js`**

`StopCard` already receives `stop` with `stop.website`/`stop.phone` now populated. After the `pricePill` block (line ~483) and before the `reasonRow`, add:

```jsx
          {(stop.website || stop.phone) ? (
            <View style={styles.contactRow}>
              {stop.phone ? (
                <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${stop.phone}`)} activeOpacity={0.7}>
                  <Ionicons name="call-outline" size={13} color={COLORS.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.contactBtnTxt}>Call</Text>
                </TouchableOpacity>
              ) : null}
              {stop.website ? (
                <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(stop.website)} activeOpacity={0.7}>
                  <Ionicons name="globe-outline" size={13} color={COLORS.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.contactBtnTxt}>Website</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
```

Add styles near `distancePill`:

```js
  contactRow:    { flexDirection: 'row', gap: 8, marginTop: 8 },
  contactBtn:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADII.sm6, borderWidth: 1, borderColor: COLORS.borderLight, backgroundColor: COLORS.surface },
  contactBtnTxt: { fontFamily: FONTS.body600, fontSize: 12, color: COLORS.primary },
```

(`Linking` is already imported in `plan.js` — confirm; it is used by `openMaps` and the modal. `RADII`/`FONTS`/`COLORS` already imported.)

- [ ] **Step 5: Sanity-check engine + commit (no new pure unit test — manual verify)**

Run: `node __tests__/verify.mjs`
Expected: PASS (unchanged tests).
Manual: build an itinerary in the running app; confirm cards show Call/Website where Places has them and omit individually when absent.

```bash
git add api/itinerary.js "app/api/itinerary+api.js" "app/(tabs)/plan.js"
git commit -m "fix: restore website and phone call links on all itinerary stop cards"
```

---

## Task 7: Navigation includes user's starting point (spec Task 7)

**Files:**
- Modify: `app/(tabs)/plan.js` (`handleNavigateFullDay`)
- Modify: `__tests__/verify.mjs` (`buildNavURL` copy + assertions)

**Interfaces:**
- Produces: `buildNavURL(itinerary, origin)` — when `origin` (`{latitude,longitude}`) is present, it becomes the route origin and the first stop moves into the waypoints; when null, behavior is unchanged (first stop is origin).

- [ ] **Step 1: Update the `buildNavURL` copy + tests in `verify.mjs`**

Replace the `buildNavURL` function (lines ~40-49) with the origin-aware version:

```js
function buildNavURL(itinerary, origin) {
  if (!itinerary?.length) return null;
  const encode = (s) => s.lat && s.lng
    ? `${s.lat},${s.lng}`
    : encodeURIComponent(s.address || s.name);
  const stopStrs = itinerary.map(encode);
  const originStr = origin?.latitude && origin?.longitude
    ? `${origin.latitude},${origin.longitude}` : null;
  const points = originStr ? [originStr, ...stopStrs] : stopStrs;
  let url = `https://www.google.com/maps/dir/?api=1&origin=${points[0]}&destination=${points[points.length - 1]}&travelmode=driving`;
  if (points.length > 2) url += `&waypoints=${points.slice(1, -1).join('|')}`;
  return url;
}
```

Update the existing PRIORITY 5 assertions to pass `undefined` origin (unchanged behavior) and add new origin cases:

```js
// existing calls become buildNavURL(stopsN) — undefined origin keeps old behavior
// add:
console.log('\nSESSION 2 — Nav origin:');
const origin = { latitude: 38.0, longitude: -75.0 };
assert('Origin becomes route origin', (() => {
  const url = buildNavURL(stops2, origin);
  return url.includes('origin=38,-75') && url.includes('destination=37.78,-122.42');
})());
assert('First stop moves to waypoints', (() => {
  const url = buildNavURL(stops2, origin);
  return url.includes('waypoints=37.77,-122.41');
})());
assert('Null origin → unchanged', (() => {
  const url = buildNavURL(stops2);
  return url.includes('origin=37.77,-122.41') && !url.includes('waypoints');
})());
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node __tests__/verify.mjs`
Expected: FAIL — new origin assertions fail (old `buildNavURL` ignored the arg) until the copy is replaced; if you replaced the copy in Step 1, this step verifies the NEW assertions pass and old ones still pass. (If they already pass, good — proceed.)

- [ ] **Step 3: Update the real `handleNavigateFullDay` in `plan.js`**

Replace `handleNavigateFullDay` (lines ~896-905) with:

```js
  const handleNavigateFullDay = () => {
    if (!itinerary?.length) return;
    const encode = (s) => s.lat && s.lng
      ? `${s.lat},${s.lng}`
      : encodeURIComponent(s.address || s.name);
    const stopStrs = itinerary.map(encode);
    const originStr = coords?.latitude && coords?.longitude
      ? `${coords.latitude},${coords.longitude}` : null;
    const points = originStr ? [originStr, ...stopStrs] : stopStrs;
    let url = `https://www.google.com/maps/dir/?api=1&origin=${points[0]}&destination=${points[points.length - 1]}&travelmode=driving`;
    if (points.length > 2) url += `&waypoints=${points.slice(1, -1).join('|')}`;
    Linking.openURL(url);
  };
```

(`coords` state is in scope — `plan.js:608`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `node __tests__/verify.mjs`
Expected: PASS — all nav assertions (old + new) green.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/plan.js" __tests__/verify.mjs
git commit -m "fix: include user starting point as first waypoint in itinerary navigation"
```

---

## Task 8: Correct CLAUDE.md model reference

**Files:**
- Modify: `decide-app/CLAUDE.md`

- [ ] **Step 1: Fix the synthesis model line**

In `CLAUDE.md`, the "Anthropic Key — Server-Side Only" section says `Model: claude-haiku-4-5-20251001` for itinerary. Update to note the split:

```
Model: scout + anchors use claude-haiku-4-5-20251001; the itinerary synthesis
(api/smart/synthesis.js) uses claude-sonnet-4-6. Swap (itinerary-swap) uses haiku.
Client never calls Anthropic directly.
```

Also update the Stack line `Anthropic API — claude-haiku-4-5-20251001 (itinerary + swap, server-side only)` to:

```
- Anthropic API — haiku-4-5 (scout/anchors/swap) + sonnet-4-6 (itinerary synthesis), server-side only
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: correct itinerary synthesis model (sonnet) in CLAUDE.md"
```

---

## Final verification (Session 2 close)

- [ ] Run `node __tests__/verify.mjs` — all green.
- [ ] `node -e "import('./api/smart/index.js').then(()=>console.log('ok'))"` — engine imports clean.
- [ ] Manual in running app (`npx expo start`):
  - "pinball and live music" → both represented; no single type exceeds 1–2 stops.
  - A live-music venue/bar on a known date → artist/showtime or "likely" note shown.
  - Every stop card shows Website + Call (omitting individually when missing).
  - Day-total cost range in the header; Quick Spin cards show a price tier.
  - Weather matches the itinerary date (or shows the extended-forecast line for far dates).
  - "Navigate full day" route starts at the user's location, not the first stop.
  - A plain itinerary (no drinks requested) has no bar/brewery filler.
- [ ] Finish the branch per [[feedback-finish-branch-merge-and-push]]: merge `session-2-itinerary-quality` to `main` locally, push `main`, push the branch.
- [ ] After merge, verify the live Vercel prod build succeeds (`.npmrc` legacy-peer-deps) per [[project-vercel-deploy-gotchas]].

## Self-Review notes

- **Spec coverage:** Task 2→plan Task 2; Task 3→plan Task 3; Task 4→plan Task 6; Task 5→plan Task 4; Task 6→plan Task 5; Task 7→plan Task 7; Task 8→plan Task 1; plus CLAUDE.md correction (plan Task 8). All eight spec items mapped.
- **Type consistency:** `computeCostSummary`/`pickForecastForDate` live in `api/itineraryHelpers.js`, imported by both handlers and `verify.mjs`. `wantsAlcohol` in `sourceRegistry.js`; `wantsLiveMusic`/`summarizeShow`/`runLiveMusic`/`parseShows` in `liveMusic.js`. Stop fields added: `website`, `phone`, `live_music`. `meta.cost_summary` and `weather.beyondForecast` are the new payload fields the UI reads.
- **Ordering note:** Tasks 1, 2, 3 all edit `api/smart/synthesis.js`'s `Rules:` block — apply them in order (1 → 2 → 3) so the additions stack cleanly.
