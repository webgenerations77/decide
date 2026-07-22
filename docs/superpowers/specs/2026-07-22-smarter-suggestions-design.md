# Smarter Suggestions — Design

**Date:** 2026-07-22
**Branch:** `feat/smarter-suggestions`
**Theme:** Make suggestions trustworthy — right place, right price, right time, honestly labeled — plus tasteful visual polish.

---

## Problem statement

User feedback identified five gaps:

1. **Manual Location isn't smart** — wrong/ambiguous matches and weak type-ahead.
2. **Bad timing** — the model invents clock times with no ground truth (e.g. "Ocean Downs 5pm" when first post is 6:40pm; "sunset walk 6pm" when sunset is 8pm).
3. **Budget isn't enforced** — no price filtering at all; unclear whether "$$$" means "only $$$" or "up to $$$".
4. **"Surprise Me" is a dead end** — Quick Spin can't take a custom keyword like "billiards" or "live music".
5. **"Live find" label is cryptic** — users don't know what it means.

Root causes (verified in code):

- Manual location uses Google **Text Search** (New v1) with **no location bias** and **no session tokens** (`screens/SettingsScreen.js:88-110`, `services/placesService.js:15-17`). Text Search treats a partial string as a full query → weak type-ahead and cross-region ambiguity. The resolved label is discarded; only lat/lng reach the backend, which re-reverse-geocodes (`app/api/itinerary+api.js` / `api/itinerary.js:125`).
- Synthesis model receives **no ground-truth times**: no sunrise/sunset (Open-Meteo call omits `sunrise,sunset` — `api/itinerary.js:104-125`), venue hours discarded (field mask requests `currentOpeningHours` but only `openNow` boolean is extracted — `api/itinerary.js:55,63`), event times only survive if embedded in free-text firecrawl snippets (`lib/smart/events.js:26` hardcodes `when: dateISO`).
- Budget applies **no** `priceLevels` filter to Google Nearby Search (`api/itinerary.js:52-57`); the model is only told "Match budget" (`lib/smart/synthesis.js:19,38`). Budget merely back-fills a display price pill on unpriced food stops (`lib/itineraryHelpers.js:44-51`).
- Quick Spin categories map to fixed Google `includedTypes` with no text input (`screens/SpinScreen.js:51-66,68-89`). "Surprise Me" (`id: 'surprise'`) is a broad grab-bag.
- "Live find" badge (`components/itinerary/StopCard.js:156-160`) marks research-pipeline stops but the wording is opaque.

---

## Design

### 1. Manual Location — real autocomplete

- **Replace Text Search with Places Autocomplete (New)** (`places:autocomplete`), issuing predictions per debounced keystroke, plus **Place Details** to resolve the chosen prediction's coordinates.
- **Session tokens**: one token spans the autocomplete keystrokes + the final Details call (correct billing pattern, cheaper, better ranking).
- **Soft `locationBias`** toward best-known coords (current GPS → last saved location → none). Soft bias (not restriction) so a same-named town near the user ranks first ("Ocean City" → MD) while faraway trips still resolve.
- **Keep the resolved label**: persist `{ label, short, latitude, longitude }` (already the shape in `handleSelectSuggestion`) AND pass `label`/`short` through the itinerary request so the backend skips its redundant reverse-geocode.
- New server proxy endpoint for autocomplete (mirrors existing `search-text` proxy) holding the Google key; wrap in `runWithUser` for attribution.
- Location entry **stays in Settings** (not the reported pain). Optional stretch, noted not required: expose an inline "change location" affordance on the Plan pill.

**Files:** `services/placesService.js` (add `autocompletePlaces` + `getPlaceDetails`), new `api/places/autocomplete.js` (+ dev twin under `app/api/places/`), `screens/SettingsScreen.js` (`searchLocation` → autocomplete + session token), `services/itineraryService.js` + `app/(tabs)/plan.js` (thread `locationLabel` into request), backend itinerary handlers (prefer passed label over reverse-geocode).

### 2. Timing accuracy — ground truth + honest hedging

- **Sunset/sunrise**: add `sunrise,sunset` to the Open-Meteo `daily` params; pass real local sunrise/sunset into synthesis context.
- **Venue hours**: extract the real open/close periods for the **plan date's weekday** from Google `currentOpeningHours`/`regularOpeningHours` (already in the field mask) and include per-place hours in the places JSON handed to synthesis (replacing the lossy `is_open` boolean, or alongside it).
- **Event start times**: add an extraction step (cheap model — **Haiku**) that parses structured `startTime` (and confidence) from event/find snippets and titles. Attach to finds so anchors carry a real time when known.
- **Hard scheduling rules** added to the synthesis prompt (`lib/smart/synthesis.js`):
  - Never schedule a stop before a venue opens or after it closes.
  - Anchor outdoor/"sunset"/"golden hour" activities to the real sunset time.
  - Place an event at its real start time; do not invent an earlier one.
- **Safety net (honest hedging)**: when a time is unverified, the model must phrase it as approximate with a confirm nudge (e.g. "racing starts ~6:40 — confirm before you head out") rather than a confident exact time. Add an optional `time_note`/`unverified` field the UI can surface subtly.

**Files:** `api/itinerary.js` + `app/api/itinerary+api.js` (Open-Meteo params, extract hours, wire event-time extraction), `lib/smart/events.js` + `lib/smart/discovery.js` (carry parsed times), new `lib/smart/eventTimes.js` (Haiku extraction), `lib/smart/synthesis.js` (context + rules + hedging), `components/itinerary/StopCard.js` (render hedge/time note).

### 3. Budget — soft "up to" ceiling

- **Semantics: at-or-below.** Selecting `$$$` includes `$`, `$$`, `$$$`.
- **Soft cap.** Prefer at-or-below; a standout above budget may appear but MUST be flagged as a splurge in its copy. Free/unpriced places are never filtered out by budget.
- Implement by (a) passing an allowed `priceLevels` array (levels 1..selected) as a **bias** where the API supports it while keeping unpriced results, and (b) explicit synthesis instruction: "Prefer places at or below {budget}. You may include one splurge above it only if exceptional, and you MUST label it a splurge."

**Files:** `api/itinerary.js` + dev twin (price bias, pass allowed levels), `lib/smart/synthesis.js` (budget rule wording), `lib/itineraryHelpers.js` (unchanged display back-fill remains, but never exceeds real price).

### 4. Surprise Me → "Other" + keywords (Quick Spin)

- Rename pill **`id: 'surprise'` → `id: 'other'`**, label **"Other"**, icon updated (🔍/✨).
- Add a **text field** in the Spin screen shown when "Other" is selected.
  - **Keyword typed** → Google **Text Search** (`searchTextPlaces`) among nearby results (add location bias/radius), then existing weighted-random pick.
  - **Empty field** → fall back to the **old random grab-bag** behavior (broad `includedTypes`), preserving the dice-roll.
- Update AsyncStorage key handling (`@decide/spin_surprise_seen`), demo pool key + fallback (`services/demoData.js` `DEMO_SPIN_POOL.surprise`), explainer condition, and beta-guide copy (`app/beta-guide.js:97`).

**Files:** `screens/SpinScreen.js`, `services/demoData.js`, `services/placesService.js` (Text Search already present), `app/beta-guide.js`.

### 5. "Live find" label — self-explanatory

- Rename badge **📰 Live find → ✨ Found this week** (`components/itinerary/StopCard.js:156-160`).
- Keep the "What we found this week" receipts panel (`components/itinerary/DiscoveryAnchors.js`) as the explainer; ensure wording is consistent.

### 6. Visual / experience polish (tasteful, low-risk)

Scoped to delight without threatening the build. Candidates (implement the subset that lands cleanly):

- **Result reveal**: subtle staggered fade/slide-in of stop cards as an itinerary appears (RN `Animated`/`LayoutAnimation`, respecting `prefers-reduced-motion` on web).
- **Spin animation**: a brief dice/shuffle micro-animation on the Quick Spin button before the result resolves.
- **Time-note affordance**: soft, non-alarming inline treatment for hedged/approximate times (small "≈ confirm" chip), reinforcing honesty as a feature.
- **Splurge chip**: a small tasteful "splurge" tag on above-budget picks (ties to budget soft-cap).
- All motion must be **cobalt-led** per theme rules, honor dark mode via `useTheme()`, and degrade gracefully on web.

---

## Non-goals

- Journey app integration (explicitly deferred).
- Moving location entry out of Settings (only the search quality changes).
- Reworking the Quick Spin category set beyond the "Other" rename.

## Model choices

- Synthesis stays on **Sonnet**; scout/anchors stay on **Haiku**.
- New event-time extraction runs on **Haiku** (cheap, structured). Sunset and venue hours are pure API — no model.

## Testing / verification

- `node --check` is unreliable here (Node 24 passes broken JSX) — verify via `npx expo export` (web) and/or babel-preset-expo compile of changed files.
- Unit-test pure helpers where practical: event-time parsing (`lib/smart/eventTimes.js`), budget price-level mapping, hours-for-date extraction.
- Manual smoke: Settings location autocomplete returns biased predictions; a generated itinerary shows real sunset and no before-open scheduling; a $$ plan shows no unflagged $$$$ picks; Quick Spin "Other" with/without keyword.
- After merge: verify the **live Vercel build succeeds** (failed builds silently freeze prod).

## Rollout

- Single feature branch `feat/smarter-suggestions`.
- Keep `EXPO_PUBLIC_` prefix for any new client env vars (none expected — key stays server-side).
- Merge to `main` locally, push `main` + branch (gh not installed).
