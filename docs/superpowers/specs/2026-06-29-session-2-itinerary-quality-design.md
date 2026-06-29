# Session 2 — Itinerary Generation Quality — Design

**Date:** 2026-06-29
**Branch:** `session-2-itinerary-quality`
**Source batch:** `cheddar-bug-fixes-and-features.md` (Session 2 of 6, Tasks 2–8)

## Context

The itinerary "brain" is the shared `api/smart/` engine — a 4-step pipeline
(`scout → discovery → anchors → synthesis`) imported by **both** itinerary handlers:

- `api/itinerary.js` — Vercel production handler
- `app/api/itinerary+api.js` — Expo Router handler

Because the engine is shared, the prompt/bias fixes (Tasks 2, 3, 8) are made **once** in
`api/smart/*`. Weather, pricing aggregation, and link enrichment (Tasks 4, 5, 6) live in
each handler separately and must be **mirrored into both** per the dual-handler rule.

Models in use (correcting CLAUDE.md, which still says haiku for itinerary):
- `claude-haiku-4-5-20251001` — scout + anchors helper steps
- `claude-sonnet-4-6` — synthesis (the actual itinerary builder)

CLAUDE.md's "Anthropic Key — Server-Side Only" / Stack lines will be corrected to reflect
that synthesis uses Sonnet.

## Reconciliation: Task 3 (live music) ↔ Task 8 (alcohol bias)

These two tasks intentionally pull in opposite directions on bars/breweries. The rule is
**intent, not venue type**:

- **Task 8** removes alcohol venues used as *default filler* (a brewery dropped in to pad a day).
- **Task 3** allows an alcohol venue back in *only when it is the live-music draw on the itinerary date*,
  billed as a live-music stop (artist + showtime), never as a generic "grab a drink" stop.

The synthesis hard-negative therefore carries a carve-out:
> "Do not include bars, breweries, or alcohol-serving venues unless the user explicitly
> requested them **or the venue is hosting live music on this date.**"

---

## Task 2 — Cap activity-type bias / enforce proportional representation

**Root cause**
- `api/smart/scout.js` (`buildScoutPrompt`, ~lines 8–20) flattens `tripNote`, `activityStyles`,
  `cuisines`, and `likedPlaces` into one undifferentiated signal blob and tells the model to
  "rank by how strongly the signals point to each" — no per-interest cap, no de-dup, so a
  repeated/emphatic mention dominates.
- `api/smart/synthesis.js` ("build the day around these anchors") then amplifies whatever won upstream.

**Fix**
1. `scout.js`: instruct equal weighting across *distinct* interests; collapse repeated mentions of
   the same interest to a single signal (repetition must not inflate priority).
2. `synthesis.js`: add a hard rule — *"Cap any single activity type at 1–2 stops regardless of how
   strongly it was requested. If multiple activity types were requested, represent each
   proportionally across the day."*
3. `synthesis.js`: pass the raw `tripNote` and `activityStyles` into the synthesis prompt so the
   builder sees original intent directly (today it only sees already-filtered finds).
4. If a requested activity type cannot be sourced, the synthesis output should surface it as an
   explicit note rather than silently omitting it (a stop or a day-note flag).

**Files:** `api/smart/scout.js`, `api/smart/synthesis.js`
**Commit:** `fix: cap activity type repetition and enforce proportional representation in itinerary generation`

## Task 3 — Live music detection (full Firecrawl scrape)

**Root cause:** No event/showtime handling exists. Music venues are only static Google Places
type strings; concerts can only leak in via the generic web-search fallback with no date/artist parsing.

**Fix — new post-anchor enrichment step in the smart engine** (`api/smart/liveMusic.js`, wired into
`api/smart/index.js` after anchors, before/around synthesis):

1. **Trigger:** runs only when live music is requested — `activityStyles` includes "Live Music"
   **or** `tripNote` mentions live music/concert/show/band. (Avoids latency on every build.)
2. **Candidate set:**
   - Stops/finds whose Google Places type is a music venue
     (`live_music_venue`, `concert_hall`, `amphitheatre`, `performing_arts_theater`,
     `event_venue`, `opera_house`).
   - **Bars / breweries / pubs** in the candidate pool (the Task 3↔8 reconciliation) — these are
     considered *only* under the live-music trigger.
   - One Firecrawl discovery search: `"live music in {location} on {date}"` to catch venues not
     already in the pool.
3. **Scrape:** for each candidate (capped to the top ~4–5 by relevance), `firecrawlScrape` the
   venue's site/events page, scoped to the itinerary date, **run concurrently** (one scrape round,
   not N sequential). Extract artist/act name + showtime.
4. **Outcome per candidate:**
   - Confirmed music on the date → attach `live_music: { artist, showtime, source }` to the stop;
     it may be surfaced as an anchor; a bar/brewery surfaced this way is billed as a live-music stop.
   - Known music venue but unconfirmed → attach a note: *"Live music likely — check
     [venue website] for the current schedule."*
   - No signal → not added as a live-music stop (and a bare bar is still blocked by Task 8).
5. Requires `FIRECRAWL_API_KEY` (already used by the engine). Degrades gracefully if absent/over budget.

**Files:** `api/smart/liveMusic.js` (new), `api/smart/index.js`, `api/smart/synthesis.js`
(consume `live_music` field + carve-out), `api/smart/firecrawl.js` (reuse).
Stop detail rendering in `app/(tabs)/plan.js` shows artist/showtime/note when present.
**Commit:** `feat: add live music detection and artist info to qualifying itinerary stops`

## Task 4 — Restore Website & Call links on every stop card (approach A: server-side enrichment)

**Root cause:** Website/Call links exist only in the tap-through `PlaceDetailModal`
(`app/(tabs)/plan.js:359–382`). The itinerary payload's stop objects carry `place_id` and
`price_level` but **not** `website`/`phone` — the modal lazily fetches those per stop.

**Fix (approach A — server-side enrichment):**
1. During itinerary build, fetch Places Details for each stop and add `website` + `phone` to the
   stop payload. Reuse the existing details path / `api/places/details` field set
   (`formatted_phone_number`, `website`). Use server-side `GOOGLE_PLACES_API_KEY`
   (`|| EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` fallback, per S1). Honor the prod in-memory cache.
   - Skip enrichment for synthetic ids (`demo_`, `nps_`, `ridb_`) — they have no Google details.
   - Cost: ~5–8 extra Places Details calls per itinerary, cached 1hr in prod. Run concurrently.
2. `StopCard` (`app/(tabs)/plan.js:394+`): add a **Website** link (opens in browser) and a
   **Call** (`tel:`) link to every card. Omit an individual link gracefully when its value is
   missing — never remove the row entirely.

**Files:** `api/itinerary.js`, `app/api/itinerary+api.js` (both: enrich stops), `app/(tabs)/plan.js`
(StopCard links). Mirror enrichment in both handlers.
**Commit:** `fix: restore website and phone call links on all itinerary stop cards`

## Task 5 — Pricing advisor on all itinerary types

**Root cause:** Per-stop cost exists (admission badge + food `$$` pill on `StopCard`), but
(a) there is **no day-total cost range** in the itinerary summary header (`itineraryMeta`,
`app/(tabs)/plan.js:1059–1083`), and (b) **Quick Spin** (`screens/SpinScreen.js`) shows no pricing at all.

**Fix:**
1. Server-side: compute a `cost_summary` (low–high range across stops) in both handlers, derived
   from `admission_cost` + `price_level`. Server-side because `admission_cost` is free-text and
   messy to parse client-side. Surface a range like `~$40–$75 for the day`.
2. Render `cost_summary` in the `itineraryMeta` header.
3. Add a price tier (`Free`/`$`/`$$`/`$$$`) to Quick Spin result cards from the `priceLevel`
   already available on the Places result.

**Files:** `api/itinerary.js`, `app/api/itinerary+api.js` (compute `cost_summary`),
`app/(tabs)/plan.js` (header), `screens/SpinScreen.js` (spin price tier).
**Commit:** `feat: ensure pricing advisor is present on all itinerary types`

## Task 6 — Weather tied to itinerary date

**Root cause:** `fetchWeather` reads `data.current_condition[0]` (today / right-now) and ignores the
itinerary date, which the handler already has. The wind/traffic note also uses `new Date().getMonth()`
(today's month).

**Fix:**
1. Use wttr.in `j1`'s multi-day `weather[]` forecast array; select the entry matching the itinerary
   date (`travelDateISO`) instead of `current_condition`.
2. If the itinerary date is beyond wttr.in's forecast window (~3 days), return a flag the client
   renders as: *"Extended forecast not available — check back closer to your trip."*
3. Fix the traffic/seasonal note to use the **selected** itinerary date's month, not today's.

**Files:** `api/itinerary.js`, `app/api/itinerary+api.js` (mirror), `app/(tabs)/plan.js`
(weather pill renders the extended-forecast fallback string).
**Commit:** `fix: ensure weather reflects itinerary date, not current day`

## Task 7 — Navigation includes user's starting point (auto current location)

**Root cause:** `handleNavigateFullDay` (`app/(tabs)/plan.js:896–905`) sets `origin = stops[0]`
(the first itinerary stop). The user's `coords` (GPS or saved `manual_location`) is in scope but unused.

**Fix:**
1. Prepend `coords` (`{ latitude, longitude }`) as the Google Maps `origin`; move the former first
   stop into the `waypoints` list so it is no longer consumed as the origin.
2. Auto-resolve origin: GPS in auto mode, saved `manual_location` in manual mode (already resolved
   into `coords`). No prompt.
3. Fall back to the current behavior (first stop as origin) when `coords` is null.
4. Update the assertion in `__tests__/verify.mjs:101` (currently expects `origin` == first stop).

**Files:** `app/(tabs)/plan.js`, `__tests__/verify.mjs`
**Commit:** `fix: include user starting point as first waypoint in itinerary navigation`

## Task 8 — Remove alcohol bias

**Root cause:** Two structural sources —
- `"breweries"` is hardcoded as a seed example in the scout prompt (`api/smart/scout.js`).
- A dedicated Open Brewery DB source returns up to 8 named breweries per brewery hunt
  (`api/smart/sourceRegistry.js`), while other interests get vague web results — over-representing breweries.

**Fix:**
1. `scout.js`: remove `"breweries"` from the seed example list.
2. `sourceRegistry.js`: gate the Open Brewery DB source behind an explicit request — activity style
   "Bars & Breweries" or a drinks/beer mention in `tripNote`. Otherwise the source does not fire.
3. `synthesis.js`: add the hard negative *with the Task 3 carve-out* —
   *"Do not include bars, breweries, or alcohol-serving venues as stops unless the user has
   explicitly requested them or the venue is hosting live music on this date."*

**Files:** `api/smart/scout.js`, `api/smart/sourceRegistry.js`, `api/smart/synthesis.js`
**Commit:** `fix: remove alcohol bias from itinerary generation prompt`

---

## Sequencing & branch

One branch: `session-2-itinerary-quality`. Suggested order:

1. **Smart-engine prompts** — Task 8 (alcohol), Task 2 (bias cap), Task 3 (live music).
   These share `scout.js` / `synthesis.js`, so do them together to avoid churn.
2. **Handler enrichment** — Task 4 (website/phone), Task 5 (`cost_summary`), Task 6 (weather by date),
   mirrored across both handlers.
3. **Client UI** — Task 4 card links, Task 5 header range + Quick Spin tier, Task 7 nav origin.
4. **Docs** — correct CLAUDE.md model line (synthesis = Sonnet).

## Cross-cutting constraints

- **Dual handlers stay in sync** — every handler-level change lands in both `api/itinerary.js`
  and `app/api/itinerary+api.js`.
- **Cobalt-led, no orange CTAs** — any new buttons/links (Website/Call, Refresh-style controls)
  use cobalt; orange stays reserved for the logo dot + food category.
- **No hardcoded hex** — all colors from `constants/theme.js`.
- **Server-only keys** — Places + Firecrawl + Anthropic keys never reach the client.
- **Vercel deploy** — after merge, verify the live prod build (needs `.npmrc` legacy-peer-deps);
  a failed build silently freezes prod.

## Verification (Session 2 close)

- Multi-activity prompt ("pinball and live music") → both represented, neither type exceeds 1–2 stops.
- A live-music venue (incl. a music-hosting bar) on a known date → artist/showtime or "likely" note shown.
- Every stop card shows Website + Call (omitting individually when data is missing).
- Day-total cost range in header; Quick Spin cards show a price tier.
- Weather matches the itinerary date (or shows the extended-forecast fallback).
- "Navigate full day" route starts from the user's location, not the first stop.
- A plain itinerary (no drinks requested) contains no bar/brewery filler.
