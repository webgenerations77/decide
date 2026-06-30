# Session 3 Kickoff — Itinerary Results UX & History

> **This is a HANDOFF NOTE for a fresh Claude Code session, not an approved spec.**
> Session 2 + the Vercel function-limit fix are merged to `main`. Per the batch
> convention each md-session runs as its own fresh session (`/clear` between them)
> on its own branch. Start S3 with the normal workflow: **brainstorming → spec →
> writing-plans → subagent-driven-development**. Resolve the open design questions
> below (ask the user) BEFORE writing the spec. The code-map below was gathered by
> exploration so you don't have to re-discover it — but verify line numbers, they drift.

Source batch: `cheddar-bug-fixes-and-features.md` — **Session 3 of 6, Tasks 9–10**.
Suggested branch: `session-3-results-ux`.

## The md start prompt (verbatim from the batch doc)
> "We're adding two UX improvements to the itinerary experience: the ability to adjust
> the time window directly from the results page and regenerate, and making History items
> clickable into their full itinerary detail view. Audit the itinerary results page
> component and the History list component before making any changes."

## Scope
- **Task 9** — Time-window editor on the RESULTS page + "Refresh Itinerary" that re-runs
  generation with the new window, preserving all other inputs, with a loading state.
- **Task 10** — Make History itinerary entries tappable into a FULL detail view identical
  to the post-generation results (all stop cards, links, pricing, weather).

---

## Code map (from exploration — file:line, verify before trusting)

### Task 9 — results page + generate flow (`app/(tabs)/plan.js`, 1726 lines)
- Time-window state: `startTime`/`endTime` at `plan.js:627-628`. Option arrays `START_TIMES`/`END_TIMES` at `plan.js:58-67`. Validation `isValidTimeWindow` (≥180 min) at `plan.js:663`.
- **`TimePickerPill`** component (`plan.js:135-175`) — self-contained, reusable on the results page as-is. Configuring UI wires two of them at `plan.js:1045-1053`.
- **`generate()`** at `plan.js:829-909`. Reads everything from component state (`coords`, `pace`/`budget`/`groupType`, `cuisines`, `sensitivities`, `startTime`/`endTime`, `planDate`, `tripNote`) + pulls `max_distance`/`activity_styles`/`dietary` fresh from AsyncStorage. Calls `generateItinerary(...)` (`services/itineraryService.js:16-45`), sets `itinerary`/`weather`/`meta`/`isFallback`/`research`, and already calls `setView('itinerary')` — so re-calling it from the results view Just Works. A results "Refresh" only needs edited times + re-call.
- **Decision-credit coupling (the key product question):** `generate()` blocks at the daily limit — `plan.js:832`: `if (await isAtDecisionLimit()) { router.push('/paywall'); return; }` — and consumes a credit on success — `plan.js:897` `incrementDecisionCount()`. Free tier = 5 decisions/day (`services/subscriptionService.js:3,53-58,67-71`). So a naive "Refresh" = a full new decision (costs a credit, can hit the paywall).
- Results header/meta: `itineraryMeta` block at `plan.js:1096-1127` (renders a static `🕐 {meta.time_window}` chip at 1102-1106 — natural spot to swap in editable `TimePickerPill`s). Sticky footer `stickyNavContainer` at `plan.js:1179-1193` (currently only "Navigate full day").
- No existing results-page refresh. `resetToConfiguring` (`plan.js:942-946`, button 1144-1151) clears state + returns to the form (does NOT regenerate, and wipes `tripNote`).

### Task 10 — History storage + rendering
- **CRITICAL:** itinerary history saves ONLY a summary. `app/(tabs)/plan.js:879-896`:
  `stops: data.itinerary.map(s => ({ name: s.name, category: s.category }))` — every other
  stop field is discarded. `meta` and `weather` ARE stored in full. Entry shape:
  `{ id, timestamp, meta, weather, stops:[{name,category}], feedback, feedbackReason }`,
  key `@decide/itineraries`, capped at 50.
- `app/(tabs)/history.js`: two lists (`decisions` @ `@decide/decisions`, `itineraries` @ `@decide/itineraries`), toggled by a filter pill. `ItineraryEntry` component at `history.js:117-191` renders the summary; **NOT tappable** today (only 👍/👎 buttons are pressable). `useRouter()` already imported at `history.js:217`.
- **No itinerary detail route exists** (`app/result.js` is the Quick-Spin places list, unrelated). A new route (e.g. `app/itinerary/[id].js`) would be needed.
- **Render components are all PRIVATE to `plan.js`** (only export is `default PlanScreen`):
  `StopCard` (`plan.js:402`), `PlaceDetailModal` (`plan.js:208-399`, fetches live Google
  details via `place_id`), `itineraryMeta` (inline JSX `plan.js:1096-1127`), weather pill
  (`plan.js:950-953,1080-1084`). They depend on local `styles`, `getLocalKnowledge`,
  `openMaps`, `highlightConfig`, `fetchPlaceDetails`, `PriceLegendModal`. To reuse them in a
  detail route they must be EXTRACTED into a shared module (e.g. `components/itinerary/`).

---

## Open design questions to resolve with the user BEFORE writing the spec

1. **Task 9 — does "Refresh Itinerary" cost a decision credit?** `generate()` currently
   consumes one and paywall-blocks at 5/day. Options to put to the user:
   (a) it counts as a normal decision (simplest, but re-running for a small time tweak burns
   1 of 5 free/day and can bounce them to the paywall);
   (b) time-window refresh is treated as an *edit*, NOT a new decision (no credit consumed) —
   needs a `generate()` variant/flag that skips `incrementDecisionCount` + the limit check;
   (c) refresh is Pro-only. Recommend leaning (b) or (a); this is a monetization call — ASK.

2. **Task 9 — editor placement / UX:** inline `TimePickerPill`s replacing the static time
   chip in `itineraryMeta` + a "Refresh Itinerary" button that appears only when the window
   changed (and is gated by `isValidTimeWindow`), vs. a small modal. Recommend inline pills +
   conditional Refresh button.

3. **Task 10 — persist full itinerary going forward (the clear fix):** change the save at
   `plan.js:879-896` to store the full `data.itinerary` array (+ a version flag). Confirm.
   Then: **old summary-only entries** (pre-change) — show a graceful "full detail unavailable
   for older plans" state, or hide the tap for them? Recommend: tap works only when the full
   array is present; older entries keep today's summary card. ASK.

4. **Task 10 — the architecture decision (biggest lift):** extract `StopCard` +
   `PlaceDetailModal` + `itineraryMeta` header + weather pill (and their helper/style deps)
   out of the 1726-line `plan.js` into a shared `components/itinerary/` module, consumed by
   BOTH `plan.js` and the new `app/itinerary/[id].js` detail route. This is the honest path
   to "renders identically." It's a sizable, careful refactor of a large file — confirm
   appetite, or discuss a lighter alternative. ASK / brainstorm.

## Constraints (carry into S3)
- Client-only work (no API/handler changes expected) → the dual-handler rule and the new
  Vercel `lib/` rule don't apply here, but: **any new shared module goes in `components/` or
  `services/`, never `api/`** (Vercel counts `api/*.js` as functions; see
  `[[project-vercel-deploy-gotchas]]`).
- Cobalt-led, no orange CTAs; orange only for logo dot + food category. No hardcoded hex —
  all colors from `constants/theme.js`. Match real `FONTS.*`/`RADII.*` tokens (e.g.
  `FONTS.bodySemiBold`, `RADII.sm`; `FONTS.body600`/`RADII.sm6` do NOT exist).
- AI assistant is "Cheddar" in user-facing copy.
- TDD harness: `node __tests__/verify.mjs` for any pure logic (e.g. a "did the window change"
  helper); RN-coupled UI verified by running the app.
- Finish per `[[feedback-finish-branch-merge-and-push]]`: merge to main + push main + push branch.
  Then a Vercel deploy is NOT strictly needed (client-only), but confirm the web export builds.

## Reference: prior session artifacts
- S2 spec/plan: `docs/superpowers/specs/2026-06-29-session-2-itinerary-quality-design.md`,
  `docs/superpowers/plans/2026-06-29-session-2-itinerary-quality.md`.
- SDD ledger pattern: `.superpowers/sdd/progress.md` (git-ignored scratch).
- Memory: `[[project-cheddar-batch-6-sessions]]` (batch status), `[[feedback-subagent-driven-execution]]`
  (always pick subagent-driven for plans, don't ask), `[[feedback-cobalt-led-no-orange-ctas]]`.
