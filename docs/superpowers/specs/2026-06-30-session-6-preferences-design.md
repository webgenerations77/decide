# Session 6 — Preferences Additions — Design Spec

**Date:** 2026-06-30
**Batch:** Cheddar Bug Fixes & Features — Session 6 of 6 (final session), `cheddar-bug-fixes-and-features.md` Tasks 16–18.

## Goal

Add three new user-preference options and wire them so they actually influence itinerary generation:

1. A **"Neurodivergent-friendly"** option under Environmental preferences that injects a soft constraint into Cheddar's itinerary-generation prompt.
2. Four new **Activity Styles** — Live Music, Arcades, Theme Parks, Mini-Golf.
3. **Chinese** as a cuisine option.

These are additive. No existing preference behavior changes.

## Architecture context (current wiring — verified)

- **Option lists** users pick from are plain string arrays:
  - `CUISINES` — duplicated **byte-identical** in `screens/SettingsScreen.js:25` and `app/onboarding/index.js:36`. Persisted to `@decide/cuisines` (`KEYS.CUISINES`).
  - `ACTIVITY_STYLES` — only in `screens/SettingsScreen.js:27` (onboarding has no activity-style step). Persisted to `@decide/activity_styles` (`KEYS.ACTIVITY_STYLES`).
  - `FOOD_SENSITIVITIES` (`SettingsScreen.js:29`) + `ENV_SENSITIVITIES` (`SettingsScreen.js:30`) both render into ONE `sensitivities` state and toggle ONE key `@decide/sensitivities` (`KEYS.SENSITIVITIES`).
- **Payload path:** `app/(tabs)/plan.js` `generate()` reads `@decide/activity_styles` and `@decide/dietary` directly from AsyncStorage at call time and passes `activityStyles` / `dietary` as top-level args to `generateItinerary()`. `services/itineraryService.js:36` folds them into the POST `preferences` object: `preferences: { ...preferences, activityStyles, dietary }`.
- **Prompt usage (shared smart engine in `lib/smart/`, used by BOTH handlers):**
  - `lib/smart/scout.js:10–20` (haiku) injects `activityStyles` and `cuisines` as free text.
  - `lib/smart/synthesis.js:18–44` (sonnet, the itinerary builder) injects `activityStyles`, `dietary` as free text. **Cuisines and sensitivities are NOT in the synthesis prompt.**
  - Activity styles are **free-text keywords only** — there is no `ACTIVITY_STYLES → Google Places type` mapping. Venue sourcing happens via the scout's generated "hunts" matched against `lib/smart/sourceRegistry.js` source entries (OSM tags, etc.) and a Firecrawl web-search fallback.
- **Live-music detection** has three gates, all keyed off the literal string `live music` (case-insensitive) in `activityStyles` or in `tripNote`:
  - `lib/smart/discovery.js:42–45` (injects a live-music hunt),
  - `lib/smart/sourceRegistry.js` livemusic entry gated by `wantsLiveMusic()`,
  - `lib/smart/liveMusic.js:15–18` `wantsLiveMusic()` (`MUSIC_STYLE_RE`).
  Adding an activity style with the exact label **`Live Music`** opens all three gates with no other code change.
- **Sensitivities are dropped server-side** — destructured in the Expo handler but not placed in `ctx.prefs`; not even destructured in the Vercel handler. They currently only drive client-side StopCard allergen warnings and never reach any prompt. (This spec does NOT fix that general gap — see Non-goals.)

## Design

### Task 18 — Chinese cuisine

- Add `'Chinese'` to the `CUISINES` array in **both** `screens/SettingsScreen.js:25` and `app/onboarding/index.js:36`, positioned among the East-Asian entries (e.g. after `'Japanese'` or adjacent to `'Korean'`/`'Vietnamese'`). The two arrays must remain identical.
- No further wiring: `cuisines` already flows into the scout prompt, so "Chinese" influences hunting automatically.

### Task 17 — Four new activity styles

- Add `'Live Music'`, `'Arcades'`, `'Theme Parks'`, `'Mini-Golf'` to `ACTIVITY_STYLES` in `screens/SettingsScreen.js:27`. Exact casing matters for `'Live Music'` (regex `/live music/i`).
- `'Live Music'` → auto-triggers the existing live-music detection chain (no extra code).
- `'Arcades'` / `'Mini-Golf'` → already resolve through existing OSM source entries in `sourceRegistry.js` (`leisure=amusement_arcade`, `leisure=miniature_golf`).
- **Theme Parks** → add ONE new source entry to `lib/smart/sourceRegistry.js`, mirroring the existing arcade/mini-golf OSM entries, using OSM tag `tourism=theme_park` and `match` keywords such as `['theme park', 'amusement park']`. (Implementer confirms the exact registry record shape from the neighboring entries.)
- All four otherwise flow as free text into the scout + synthesis prompts via the existing `activityStyles` path — no `ACTIVITY_STYLES → Places type` mapping is introduced.

### Task 16 — "Neurodivergent-friendly" option (wired through to the prompt)

- **UI:** add a single selectable chip labeled **"Neurodivergent-friendly"** in the Environmental area of `screens/SettingsScreen.js`. It has its own selected state and toggle — it is NOT added to `ENV_SENSITIVITIES` / the shared `sensitivities` array. Render it consistently with existing chips (reuse `ChipGrid` or an equivalent single-chip pattern so it inherits themed styling for light + dark). Not added to onboarding.
- **Storage:** new dedicated boolean key in `services/settingsService.js`: `KEYS.NEURODIVERGENT = '@decide/neurodivergent'`. Default `false`. Load/save through the existing settings helpers; load it into `SettingsScreen` state alongside the other prefs.
- **Payload path:**
  - `app/(tabs)/plan.js` `generate()` reads `@decide/neurodivergent` from AsyncStorage (same pattern as `@decide/activity_styles`) and passes it as a top-level `neurodivergent` boolean to `generateItinerary()`.
  - `services/itineraryService.js` folds it into the POST body: `preferences: { ...preferences, activityStyles, dietary, neurodivergent }`.
- **Both API handlers (mirrored):** in `api/itinerary.js` and `app/api/itinerary+api.js`, destructure `neurodivergent = false` from `preferences` and include it in the `ctx.prefs` object that is passed to the smart engine.
- **Prompt:** in `lib/smart/synthesis.js` `buildSynthesisPrompt`, when `p.neurodivergent` is truthy, append ONE conditional line to the user prompt expressing a **soft** constraint — favor quieter, calmer, more structured and predictable venues; avoid loud, crowded, chaotic, or overstimulating places and over-packed schedules. When false/absent, the prompt is unchanged (no empty line). Because `synthesis.js` is shared, this reaches both handlers automatically.

## Non-goals

- Not fixing the general "sensitivities dropped server-side" gap — only the new dedicated `neurodivergent` signal is wired to the prompt.
- No `ACTIVITY_STYLES → Google Places type` mapping beyond the single Theme Parks source entry.
- Cuisines remain scout-only (not added to the synthesis prompt) — out of scope.
- No onboarding changes except adding "Chinese" to its CUISINES list.

## Interfaces / data shapes

- POST `/api/itinerary` body `preferences` gains `neurodivergent: boolean` (alongside the existing `cuisines`, `sensitivities`, `activityStyles`, `dietary`).
- `ctx.prefs` gains `neurodivergent: boolean`.
- New AsyncStorage key `@decide/neurodivergent` (boolean).
- `CUISINES` gains `'Chinese'`; `ACTIVITY_STYLES` gains four entries; `sourceRegistry` gains one Theme Park entry.

## Constraints

- **Mirroring:** `CUISINES` must stay identical in `SettingsScreen.js` and `onboarding/index.js`; the `neurodivergent` destructure must appear in BOTH API handlers.
- **Token discipline:** no raw hex, no `fontWeight` literals; style via `makeStyles(colors)` from `useTheme()`. The new chip must read correctly in light AND dark.
- **Copy:** user-facing strings say "Cheddar", never "AI". Label exactly "Neurodivergent-friendly".
- **Expo SDK 56** — reference https://docs.expo.dev/versions/v56.0.0/ for any API question.

## Edge cases

- `neurodivergent` defaults `false` → existing users and unset state produce the current prompt verbatim (no injected line).
- Empty/unselected activity styles and cuisines behave exactly as today.
- "Theme Parks" with no OSM result still falls back to web search — no hard failure.
- Selecting "Live Music" with no confirmable shows still degrades to the existing "live music likely — check venue" behavior.

## Verification (repo convention — no RN unit tests)

Per task: clean `npx expo export --platform web` (ends `Exported: dist`) + targeted grep confirming each addition is present in the required file(s). Plus manual smokes:
- "Chinese" appears in the cuisine list in BOTH Settings and onboarding.
- Selecting "Live Music" as a style triggers live-music detection on a generated plan.
- Toggling "Neurodivergent-friendly" on visibly biases a generated itinerary toward calmer/structured venues; off reproduces prior behavior.
- New chip legible in light and dark.
