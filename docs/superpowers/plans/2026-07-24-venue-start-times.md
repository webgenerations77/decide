# Implementation Plan — Venue Start-Time Verification

**Date:** 2026-07-24
**Spec:** `docs/superpowers/specs/2026-07-24-venue-start-times-design.md`
**Estimated size:** medium (~1 day). New pure-ish module (network via injected deps) + a shared
extraction core refactor + engine wire-in + tests. No new dependency, no new env var, no new
serverless function.

**Depends on:** nothing new — reuses `firecrawl.js`, the Anthropic Haiku client pattern, and the
existing verified-finds → synthesis rail. Ships independently of the Sunset Guard (already merged).

---

## Phase 0 — Extract the shared verify core (refactor, no behavior change)

**File:** `lib/smart/verifyTimes.js`

`verifyOne` currently hardcodes the event extraction prompt + "this specific date only" acceptance.
Pull the reusable machine out so both the event and venue paths share it:

1. Extract `resolveAndScrape(seed, ctx, deps)` → `{ url, markdown }` — the search-when-no-URL +
   Firecrawl scrape + 4000-char slice (verbatim from current `verifyOne`).
2. Extract `extractStartTime({ markdown, url, ctx, promptFor, accept }, deps)` — runs Haiku with a
   caller-supplied `promptFor(slice, ctx)` and `accept(parsed, ctx)` predicate; returns
   `{ startTime, source } | null`.
3. Rewrite `verifyOne` to call the two helpers with the **existing** event prompt + `high`-only
   acceptance. Assert `verifyTimes.test.mjs` still passes unchanged — this phase is pure refactor.

**Verify:** `node --test lib/smart/verifyTimes.test.mjs` green (no test edits).
**Commit:** `refactor(smart): extract shared search/scrape/extract core from verifyOne`

---

## Phase 1 — Venue module + tests

**Files:** `lib/smart/verifyVenueTimes.js` (new), `lib/smart/verifyVenueTimes.test.mjs` (new)

1. `VENUE_EVENT_RE` — the §5 keyword set, word-boundary, case-insensitive.
2. `selectEventVenues(places)` → flattens the `{ food, activity, shopping, outdoor }` place buckets
   (or accepts an array), keeps name/summary matches, ranks name-match over summary-match, caps at
   `MAX_VENUE_VERIFY = 2`. Pure.
3. `verifyVenueTimes(places, ctx, deps)`:
   - Select candidates; for each, `resolveAndScrape` (search seeded per §6.1) then
     `extractStartTime` with the **venue-tuned** prompt + acceptance (recurring match for
     `ctx.dayOfWeek` counts as `high`).
   - Confirmed → build the synthetic verified `find` (§6.3) and mark the source place for removal.
   - Return `{ promotedFinds, removePlaceIds: Set }` (let the caller apply removal so `index.js`
     owns the places/finds mutation). Fully defensive — try/catch per venue, bounded, never throws.
   - DI seams: `deps.search`, `deps.scrape`, `deps.createMessage` (mirror verifyTimes) so tests run
     offline with no keys.
4. Tests: all 10 cases from spec §9 (case 10 lives in `index.test.mjs`, Phase 2).

**Verify:** `node --test lib/smart/verifyVenueTimes.test.mjs` green.
**Commit:** `feat(smart): verify scheduled-event venue start times (Ocean Downs case)`

---

## Phase 2 — Wire into the engine

**File:** `lib/smart/index.js` (+ a case in `index.test.mjs`)

1. Add `verifyVenueTimes` (with `deps.verifyVenueTimes` override) alongside the other injected steps.
2. In the bounded verify phase, run it in parallel with `verifyEventTimes` inside the same
   `VERIFY_PHASE_TIMEOUT_MS` race. After the race:
   - `finds.push(...promotedFinds)`
   - filter promoted venues out of each `places` bucket by `removePlaceIds`.
3. Feed promoted venues into the anchor candidate pool:
   `pickAnchors([...scoutFinds, ...promotedFinds], ctx)` (per Open Question §10.1 — eligible, not
   pinned). Guard: only when `promotedFinds.length` so the no-venue path is unchanged.
4. `runSynthesis` and the existing `applySunsetGuard` line are untouched downstream.
5. New `index.test.mjs` case: inject a `verifyVenueTimes` stub returning one promoted find; assert it
   reaches synthesis's `finds`/`anchors` and appears as a `verified` stop (case §9.10).

**Verify:** `node --test lib/smart/index.test.mjs` green; `find api -name '*.js' | wc -l` ≤ 12.
**Commit:** `feat(smart): promote verified event-venues onto the finds/anchor rail`

---

## Phase 3 — Build verify + manual QA + docs

1. `npx expo export --platform web` → `Exported: dist`.
2. Manual repro: generate for a location/date with a real scheduled-event venue in range (a racetrack
   race night, or a cinema/theater with fixed showtimes). Confirm the stop lands at the real start
   time with a ✓ Verified chip **or** carries an honest "confirm this time" hedge — never a silent
   round-number guess. Confirm a day with no such venue is byte-for-byte unaffected.
3. Update `docs/superpowers/BACKLOG.md`: mark venue start-times done (note on-device QA state per the
   repo's honesty convention), and close the "sibling follow-up" note left by the Sunset Guard entry.

**Commit:** `docs: mark venue start-time verification shipped in BACKLOG`

---

## Rollout / risk

- **Blast radius:** confined to the pre-synthesis verify phase, fail-open. Worst case = today's
  behavior (hedge or guess). Never blocks or corrupts an itinerary.
- **Cost:** ≤ 2 extra Firecrawl searches + scrapes + 2 Haiku extractions per generation, only when an
  event venue is actually present, all inside the existing 8s bounded phase.
- **No new deps / env vars / serverless functions.**
- **Reversible:** remove the one `verifyVenueTimes` call + the anchor-pool tweak in `index.js`.

## Task checklist

- [ ] Phase 0 — shared verify core extracted; `verifyTimes.test.mjs` green unchanged
- [ ] Phase 1 — `verifyVenueTimes.js` + tests (recurring-weekday = high confidence)
- [ ] Phase 2 — engine wire-in; promoted venues reach finds + anchor pool; no double-representation
- [ ] Phase 3 — clean web export, manual repro of the Ocean Downs case, BACKLOG updated, fn count ≤ 12
