# Design — Cheddar Smart Discovery & Synthesis Engine

**Date:** 2026-06-28
**Status:** Approved (design); ready for implementation planning
**Scope:** Sub-project #1 of a 4-part effort to make Cheddar's itineraries dramatically smarter.

---

## Problem

The live research phase (`api/researchPhase.js`) fetches real events and injects
them as text, but the itinerary comes out as a generic Google Places shuffle —
the live data is decoration, not intelligence. Observed directly in testing: a
research run found 6 real Ocean City events, `hadLiveData: true`, yet the
generated plan contained **zero** event-anchored stops.

Three root causes:

1. The prompt hands Haiku a large Google Places JSON blob plus a small events
   paragraph and says "only use places from the data above." Haiku takes the
   path of least resistance and shuffles the Places blob.
2. Events lack `place_id`/`lat`/`lng`, so emitting them as stops is awkward and
   the model avoids it.
3. There is no notion of the user's *specific* interests. The user wants
   long-tail discovery — "is there a pinball spot near dinner?", arcades, record
   stores — sourced from the *right* specialized place (e.g. Pinball Map), not a
   generic top-10 list.

## Goal

Cheddar discovers hyper-specific, time-sensitive, interest-matched "finds" and
builds an **opinionated** day that is genuinely anchored on them — and the output
visibly changes with the user's interests, dates, and per-trip input.

## Non-goals (handled by sibling sub-projects, out of scope here)

- **#2 Taste Profile** — onboarding question additions + an always-editable
  "teach Cheddar" interests screen + storage. This spec fuels the scout from
  *existing* saved prefs + a per-trip note only.
- **#3 Discovery transparency UI** — showing *what* was found and *why* on the
  itinerary. This spec *emits* the provenance data; rendering it is #3.
- **#4 Loading screen** — Lottie `loading.json` + rotating widgets (3-day
  weather, famous birthday, motivational quote). Frontend-only, ~$0 API cost,
  independent. Not part of this engine.

---

## Architecture

Replaces today's "fetch 5 beach sites → summarize → inject text → Haiku builds
plan" with an interest-driven pipeline. **The Sonnet synthesis step replaces the
current Haiku itinerary call** — one brain builds the day from Google Places +
finds together.

```
inputs: location, dates, group, weather, saved interests, per-trip note
  → SCOUT (Haiku)       : interests + context → ranked "hunts"
  → DISCOVERY (parallel): registry sources + web-search fallback → normalized "finds"
  → ANCHORS (Haiku)     : pick the 1–3 finds that should shape the day
  → SYNTHESIS (Sonnet)  : build the opinionated day around anchors + Places
  → itinerary (existing schema) + per-stop provenance
```

Everything else in `api/itinerary.js` stays: Google Places / weather / geocode /
NPS / RIDB fetch, driving-time enrichment, and `buildFallbackItinerary` as the
safety net.

### Model assignment (cost-controlled — approved budget ~$0.13/itinerary)

| Step | Model | Why |
|---|---|---|
| Scout | `claude-haiku-4-5` | Cheap interest expansion |
| Anchor selection | `claude-haiku-4-5` | Cheap ranking/filtering |
| Synthesis | `claude-sonnet-4-6` | The opinionated build — quality matters |

Registry APIs (Pinball Map etc.) are free; Firecrawl credits apply only to
scrapes/searches and are capped (see Cost controls).

---

## New modules

All backend, ESM, mirror existing `api/*.js` conventions (module-scope `{data,
ts}` TTL caches, `process.env` keys, never throw out of the top-level entry).

### `api/smart/scout.js`
- **Input:** `{ location, travelDates, group_type, weather, activityStyles[], cuisines[], likedPlaces[], tripNote }`
- **Does:** one Haiku call → ranked interest *hunts*. Does **not** pick URLs.
- **Output (schema-validated):**
  ```
  { hunts: [ { interest: string, why: string, priority: number, suggestedQuery: string } ] }
  ```
- Caps to top ~8 hunts; priority drives which get expensive web searches.

### `api/smart/sourceRegistry.js`
- Code, not LLM. Deterministic interest→source routing keeps the LLM from
  guessing canonical sources.
- A registry of source definitions, each:
  ```
  { key, match: [tags...], type: 'api' | 'firecrawl-scrape' | 'firecrawl-search', run(ctx) → Find[] }
  ```
- Reference entries:
  - **Pinball Map** (`api`): `GET https://pinballmap.com/api/v1/locations/closest_by_lat_lon.json?lat={lat}&lon={lng}&send_all_within_distance=1&max_distance={miles}` — free, returns machines + lat/lng.
  - Beach-corridor event sites (`firecrawl-scrape`) — carried over from
    `researchPhase.js` as the always-on baseline for covered geographies.
  - Generic interest fallback (`firecrawl-search`) using the hunt's
    `suggestedQuery`.
- Fuzzy, case-insensitive tag match. Unknown interest → `firecrawl-search`.
- `// add new interest→source mappings here as the app expands`.

### `api/smart/discovery.js`
- Resolves hunts → source defs (registry + fallback), runs all in parallel
  (`Promise.all`, never throws), normalizes to one shape:
  ```
  Find = { title, category, interest, lat?, lng?, address?, when?, cost?,
           needsTickets?, url?, snippet, sourceLabel }
  ```
- Pinball Map / API sources yield real lat/lng → real map pins. Scrape/search
  results get light extraction (heuristic + optional Haiku) into Finds.
- Dedupes finds; caps niche web-searches to the top ~4 hunts (credit guard).

### `api/smart/anchors.js`
- One Haiku call. Input: finds + trip context. Output: the 1–3 finds that should
  *shape the day*, each with a `rationale`. Cheap filter/rank.
  ```
  { anchors: [ { findIndex: number, rationale: string } ] }
  ```

### `api/smart/synthesis.js`
- One Sonnet 4.6 call. Input: Google Places (food/activity/shopping/outdoor),
  anchors, all finds, weather, prefs, time window, feedback.
- Builds the full itinerary in Cheddar's voice, weaving anchors as real stops
  (their lat/lng; `find_`-prefixed `place_id`), filling gaps from Places.
- Output: existing stop schema **plus** optional per-stop
  `provenance: { interest, sourceLabel, why }` (consumed later by #3).
- On failure → caller falls back to `buildFallbackItinerary`.

### `api/smart/index.js` (orchestrator)
- `runSmartEngine({ location, travelDates, coords, places, weather, prefs, feedback, tripNote })`
  → `{ itinerary, anchors, finds, hadLiveData }`. Wraps the whole pipeline,
  never throws, returns `hadLiveData:false` + null itinerary on total failure so
  the caller degrades cleanly.

---

## Integration

### `api/itinerary.js` and `app/api/itinerary+api.js`
- Keep Places/weather/geocode/NPS/RIDB fetch unchanged.
- Replace the current Haiku `messages.create` itinerary call with
  `runSmartEngine(...)`. If it returns an itinerary, use it; else
  `buildFallbackItinerary`.
- Response gains `research`/`discovery` metadata (finds count, anchors,
  hadLiveData) — superset of the current `research` block.
- Both handlers stay in sync (per `project-itinerary-api-handlers` — Vercel prod
  vs Expo dev).

### Client (`services/itineraryService.js`, `app/(tabs)/plan.js`)
- Add an **"into anything specific this trip?"** free-text box on the plan
  screen → `tripNote` in the request body.
- Start sending `activity_styles` (`@decide/activity_styles`) and `dietary`
  (`@decide/dietary`) — already stored, not currently sent — alongside existing
  `preferences`/`feedback`.
- **No itinerary stop-card changes** (honors the backend/prompt-layer constraint).

---

## Caching

- Discovery/finds cached **4h** per cache key `=(location + hash(interest set))`.
  Interests change the finds, so location alone would serve stale results.
- Google Places cache (1h) unchanged.
- Scout/anchors/synthesis are per-generation (not cached); cost model assumes
  this.

## Cost controls

- Scout + anchors on Haiku; one Sonnet synthesis call.
- Cap niche `firecrawl-search` hunts to top ~4 by priority.
- Prefer free registry APIs (Pinball Map) over scrapes/searches.
- Lands at the approved **~$0.13/itinerary** Claude + capped Firecrawl credits.

## Error handling / degradation (never block a plan)

| Failure | Behavior |
|---|---|
| Scout fails | Skip discovery; Places-only itinerary (today's behavior) |
| A source/API/scrape fails | Drop those finds; continue |
| Discovery empty | Places-only itinerary |
| Anchors fail | Synthesis proceeds with finds, no explicit anchors |
| Synthesis (Sonnet) fails | `buildFallbackItinerary` |
| `FIRECRAWL_API_KEY` missing | Registry APIs still run; scrapes/searches skipped |

Every external call wrapped; the orchestrator never throws.

## Testing strategy

- **Unit:** `sourceRegistry` fuzzy matching; `discovery` normalization + dedupe;
  Find/Hunt/Anchor schema validation; cache key includes interest hash.
- **Integration (live, gated):** run the orchestrator for Ocean City, MD with a
  `tripNote` of "we love pinball and vinyl" and assert ≥1 `find_` stop with real
  lat/lng appears; assert a generic note (no interests) still yields a valid
  Places-based plan.
- **Degradation:** force each failure mode (no Firecrawl key, Sonnet error) and
  assert a valid itinerary still returns.
- **Cost smoke:** log per-step token usage to confirm ~$0.13 envelope.

## Out of scope (this spec)

Sub-projects #2 (Taste Profile UI/storage), #3 (discovery transparency
rendering), #4 (loading screen). Each gets its own spec → plan → build.
