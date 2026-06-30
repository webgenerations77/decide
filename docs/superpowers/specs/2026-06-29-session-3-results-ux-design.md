# Session 3 — Itinerary Results UX & History Detail (Design Spec)

> Status: **approved design**, ready for writing-plans.
> Batch: `cheddar-bug-fixes-and-features.md`, Session 3 of 6, Tasks 9–10.
> Branch: `session-3-results-ux`. Client-only (no `api/` changes).
> Supersedes the open questions in `docs/superpowers/specs/SESSION-3-KICKOFF.md` (now resolved).

## Goal

Two UX improvements to the itinerary experience:

1. **Task 9** — Edit the time window directly on the RESULTS page and "Refresh Itinerary"
   (re-generate with the new window, preserving every other input), with a loading state.
2. **Task 10** — Make History itinerary entries tappable into a FULL detail view that renders
   identically to the post-generation results (all stop cards, place details, pricing, weather).

## Resolved design decisions (from brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Does Refresh cost a decision credit? | **No** — treated as an *edit*. Skips the limit check + `incrementDecisionCount()`. |
| 2 | Editor placement | **Inline `TimePickerPill`s** in the meta header + a conditional "Refresh Itinerary" button. |
| 3 | Old summary-only History entries | **Not tappable**; keep today's summary card unchanged. |
| 4 | How detail renders identically | **Extract shared components** into `components/itinerary/`, consumed by both `plan.js` and the new detail route. |
| 5 | Refresh abuse guardrail | **Pro = unlimited; free = capped at 3 refreshes per itinerary**, then the next change routes to the paywall. |
| 6 | History on refresh | **Update the current entry in place** (same `id`), not a new entry. |
| — | Swap in History detail | **Read-only** — swap affordance hidden; place-detail modal, feedback 👍/👎, and Navigate still work. |

---

## Task 9 — Time-window editor + Refresh

### UI
In the itinerary view's meta header (`plan.js:1096-1127`), replace the static
`🕐 {meta.time_window}` chip (currently `plan.js:1102-1106`) with two `TimePickerPill`s
(Start / End) bound to the existing `startTime` / `endTime` state and the existing
`START_TIMES` / `END_TIMES` option arrays.

Below the pills, a **"Refresh Itinerary"** button (cobalt — `CTAButton variant="cobalt"`)
that renders **only when** both:
- the window differs from the window that generated the on-screen itinerary, AND
- the window is valid (≥ 180 min).

While a refresh is in flight, reuse the existing full-screen `LoadingAnimation` overlay
(`plan.js:1196-1199`, driven by the existing `loading` state).

If the window is edited to something invalid, show the existing
`timeValidationHint` ("Please allow at least 3 hours") and do not show the Refresh button.

### New component state (in `PlanScreen`)
- `generatedStart`, `generatedEnd` — the window the **current on-screen** itinerary was built
  with. Set on every successful `generate()` (fresh or refresh). Drives the "changed?" check.
- `refreshCount` — number of refreshes applied to the current itinerary. Reset to `0` on a
  fresh generate; incremented on each successful refresh.
- `currentItineraryId` — the `id` of the History entry for the on-screen itinerary, so a
  refresh updates it in place. Set on fresh generate.

### `generate({ asEdit = false })`
Single function, branched by `asEdit`:

**Fresh (`asEdit: false`)** — current behavior, plus bookkeeping:
1. `if (await isAtDecisionLimit()) { router.push('/paywall'); return; }` (unchanged, `plan.js:832`).
2. Generate, set view to itinerary (unchanged).
3. History: **prepend** a new entry storing the **full itinerary** (see Task 10 storage).
   Capture the new `id` → `currentItineraryId`.
4. `await incrementDecisionCount()` (unchanged, `plan.js:897`).
5. `refreshCount = 0`; `generatedStart = startTime`; `generatedEnd = endTime`.

**Refresh (`asEdit: true`):**
1. **Skip** `isAtDecisionLimit()` and **skip** `incrementDecisionCount()`.
2. Guardrail: resolve `isPro()` and `demo_mode`. If
   `!canRefresh({ isPro, isDemo, refreshCount })` → `router.push('/paywall'); return;`
   (`canRefresh` returns `true` when Pro, demo, or `refreshCount < cap`).
3. Generate with the edited `startTime` / `endTime` (all other inputs read from state exactly
   as today — `coords`, `pace`/`budget`/`groupType`, `cuisines`, `sensitivities`, `planDate`,
   `tripNote`, and the AsyncStorage-sourced `max_distance`/`activity_styles`/`dietary`).
4. History: **update the existing entry** whose `id === currentItineraryId` (replace
   `itinerary`/`meta`/`weather`/`stops`, keep `id`/`timestamp`/`feedback`/`feedbackReason`).
   If no matching entry is found (e.g. evicted by the 50-cap), fall back to prepend.
5. `refreshCount += 1`; `generatedStart = startTime`; `generatedEnd = endTime`.

`incrementDecisionCount` only fires on the fresh path, so the per-day decision counter is
untouched by refreshes; the refresh cap is the only gate on the refresh path.

### Edge cases
- Refresh button is hidden when `loading` is true (prevents double-fire).
- "Change plan preferences" (`resetToConfiguring`, `plan.js:942-946`) is unchanged; the edited
  `startTime`/`endTime` carry back into the form, which is correct.
- Demo mode and Pro both yield unlimited refreshes (mirrors `isAtDecisionLimit`'s bypasses).

---

## Task 10 — History → full itinerary detail

### Storage change (`plan.js` history save, ~879-896)
Entry shape becomes:
```js
{
  id, timestamp, meta, weather,
  stops: [{ name, category }],   // kept for the summary card + back-compat
  itinerary: [ ...full stops ],  // NEW — full stop objects
  v: 2,                          // NEW — version flag
  feedback: null, feedbackReason: null,
}
```
- Old entries (no `itinerary` / `v < 2`) are never rewritten; they remain summary-only.
- The 50-entry cap is unchanged.

### New route — `app/itinerary/[id].js`
- Reads `@decide/itineraries`, finds the entry by `id` (`useLocalSearchParams`).
- Renders the full detail using the shared `components/itinerary/` modules:
  `WeatherPill` (header) + `ItineraryMeta` (static) + `StopCard` list + `PlaceDetailModal`.
- A back affordance returns to History.
- Not found, or entry has no `itinerary` array → graceful empty state
  ("This plan is no longer available.") with a back action. (Defensive — the list only links
  entries that have the array, but the route is reachable directly.)
- Read-only: `StopCard` gets **no** `onSwap`, so the swap affordance is hidden. Place-detail
  modal, per-place feedback 👍/👎, and Navigate all work (they're keyed by `place_id`, not
  tied to the live plan).

### History list (`history.js` `ItineraryEntry`, ~117-191)
- If the entry has a full `itinerary` array, wrap the card so tapping it routes to
  `/itinerary/${entry.id}` (`useRouter()` is already imported, `history.js:217`). The existing
  👍/👎 buttons keep their own press handlers (stop propagation so a thumb tap doesn't navigate).
- Summary-only (old) entries: no tap affordance, card renders exactly as today.

---

## Shared extraction — `components/itinerary/`

Pull these out of the 1726-line `plan.js` so the results view and the detail route render from
the same source. Each is a focused module that takes everything it needs via props (no reliance
on `PlanScreen` local state).

| Module | Contains | Key props |
|--------|----------|-----------|
| `StopCard.js` | `StopCard` + its `FeedbackModal` | `stop`, `index`, `isLast`, `onViewDetails`, `weather`, `planDate`, `sensitivities`, **optional** `onSwap`/`isSwapping` (swap UI hidden when `onSwap` absent) |
| `PlaceDetailModal.js` | `PlaceDetailModal` + `PriceLegendModal` | `visible`, `stop`, `onClose` |
| `ItineraryMeta.js` | meta header block (day/date/city/chips/cost/live-data note) | `meta`, `stopCount`, `research`; plus **editor props** for the results view: `editable`, `startTime`, `endTime`, `onChangeStart`, `onChangeEnd`, `canRefresh` (show button), `onRefresh`, `isValid`. When `editable` is false (detail route) it renders the static time chip. |
| `WeatherPill.js` | the header weather pill | `weather`, `timeWindow` (string; decouples from live `startTime`/`endTime`) |

Helper/style dependencies that move with them:
- `openMaps` and `highlightConfig` → relocate next to their consumers (a small shared
  `components/itinerary/helpers.js`, or co-located in the module that uses them).
- Styles: extracted components own their style keys, co-located per module (idiomatic RN).
  Small shared primitives (`modalOverlay`, `modalCard`, `modalOption*`) may be duplicated
  where both `plan.js` (which keeps `TimePickerPill`) and an extracted modal need them — value
  parity is what matters, not a single source object.
- Already-shared deps stay where they are: `getLocalKnowledge`/`getAllergyAlerts`
  (`constants/localKnowledge`), `fetchPlaceDetails` (`services/placesService`), brand
  primitives (`SectionLabel`, etc.), theme tokens (`constants/theme`).

`TimePickerPill` stays in `plan.js` (still used by the configuring form and the results editor;
the detail route doesn't need it).

**Acceptance for the refactor:** the results view renders pixel-identically to before the
extraction, and the detail route renders the same stop cards / meta / weather as the results view.

---

## Pure logic — `lib/refreshPolicy.js` (TDD via `node __tests__/verify.mjs`)

No React Native imports, so `verify.mjs` can import it directly (same pattern as
`lib/itineraryHelpers.js`). `plan.js` imports the same functions.

```js
export const FREE_REFRESHES_PER_ITINERARY = 3;

// moved out of plan.js (currently inline ~plan.js:61-67)
export function timeToMinutes(timeStr) { /* ... */ }

// replaces inline isValidTimeWindow (~plan.js:663)
export function isValidWindow(start, end, minMinutes = 180) {
  return timeToMinutes(end) - timeToMinutes(start) >= minMinutes;
}

export function windowChanged(genStart, genEnd, curStart, curEnd) {
  return genStart !== curStart || genEnd !== curEnd;
}

export function canRefresh({ isPro, isDemo, refreshCount, cap = FREE_REFRESHES_PER_ITINERARY }) {
  if (isPro || isDemo) return true;
  return refreshCount < cap;
}
```

`plan.js` derives `isValidTimeWindow = isValidWindow(startTime, endTime)` and the Refresh
button's visibility from `windowChanged(...) && isValidTimeWindow`.

### Test cases (add to `verify.mjs`)
- `timeToMinutes`: `'8:00 AM'→480`, `'12:00 PM'→720`, `'12:00 AM'→0`, `'10:00 PM'→1320`.
- `isValidWindow`: exactly 180 min → true; 179 → false; `'11:00 AM'`–`'8:00 PM'` → true.
- `windowChanged`: same/same → false; different start → true; different end → true.
- `canRefresh`: Pro → true at any count; demo → true at any count; free `count<3` → true;
  free `count===3` → false; custom `cap`.

---

## Constraints (carried into S3)

- **Cobalt-led, no orange CTAs.** Refresh button is cobalt. Orange only for the logo dot and
  the food category. No hardcoded hex — all colors from `constants/theme.js`. Use real tokens
  (`FONTS.bodySemiBold`, `RADII.sm6`/`md10`/etc.); `FONTS.body600`/`RADII.sm` style invented
  names do **not** exist.
- AI assistant is **"Cheddar"** in all user-facing copy.
- **No `api/` files** created or moved (Vercel counts `api/*.js` as functions). Shared code
  goes in `components/` or `lib/`/`services/`. See `[[project-vercel-deploy-gotchas]]`.
- TDD: pure logic via `node __tests__/verify.mjs`; RN-coupled UI verified by running the app.
- Finish per `[[feedback-finish-branch-merge-and-push]]`: merge to main + push main + push
  branch. Client-only, so no Vercel deploy required, but confirm the web export still builds.

## Out of scope
- RevenueCat wiring (Phase 4). The guardrail uses the existing local `isPro()` shim.
- Backfilling old summary-only History entries into full itineraries (impossible — the data
  was discarded at save time).
- Any change to the generation pipeline / `api/` handlers / `lib/smart`.
