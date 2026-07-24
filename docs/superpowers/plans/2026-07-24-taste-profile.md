# Implementation Plan — Taste Profile

**Date:** 2026-07-24
**Spec:** `docs/superpowers/specs/2026-07-24-taste-profile-design.md`
**Estimated size:** medium (~1–1.5 days). Storage + request wiring + two prompt touch-ups + Settings
card + one onboarding step. No new dependency, no new env var, **no new serverless function** (rides
`/api/itinerary`).

**Order rationale:** wire the *engine value* first (storage → request → prompts, all unit-testable),
so the feature works end-to-end before any pixels. UI (Settings, onboarding) comes after and just
edits the storage the engine already reads. Each phase is independently shippable behind the fact that
empty arrays = today's behavior.

**⚠ Decide before Phase 2:** Open Question §10.1 (feed depth to synthesis). Plan assumes the
recommended **interests+loved → scout-only, avoided → scout+synthesis**.

---

## Phase 1 — Storage + loader

**File:** `services/settingsService.js`

1. Add to `KEYS`: `INTERESTS: '@decide/interests'`, `LOVED_PLACES: '@decide/loved_places'`,
   `AVOIDED_PLACES: '@decide/avoided_places'`.
2. Add to `DEFAULTS`: `interests: []`, `lovedPlaces: []`, `avoidedPlaces: []`; include them in
   `loadAllSettings()`.
3. New `loadTasteProfile()` → `{ interests, lovedPlaces, avoidedPlaces }`, each `[]`-default and
   `try/catch`-safe (mirror `loadPlanDefaults`). Coerce non-arrays to `[]`.

**Commit:** `feat(settings): taste-profile storage keys + loadTasteProfile()`

---

## Phase 2 — Request + engine wiring (the value)

**Files:** `services/itineraryService.js`, `app/(tabs)/plan.js`, `app/api/itinerary+api.js`,
`api/itinerary.js` (twin), `lib/smart/scout.js`, `lib/smart/synthesis.js`

1. **plan.js**: `loadTasteProfile()` at generate time; pass `interests`, and union
   `lovedPlaces`/`avoidedPlaces` into the `feedback` object already sent (per-trip feedback, if any,
   takes union — never drop the standing lists).
2. **itineraryService.js**: thread `interests` into `preferences`, `likedPlaces`/`dislikedPlaces`
   into `feedback`. Cap to 15 each before send (log if truncated).
3. **Both API twins**: read `preferences.interests` → `ctx.prefs.interests` (default `[]`). `feedback`
   already maps to `ctx.feedback`. Keep the two handlers byte-for-byte in step.
4. **scout.js `buildScoutPrompt`**: add curated-interests + loved + avoid lines and the
   "trip-note-leads, standing interests are additional fuel" instruction; preserve the equal-weight /
   collapse-duplicates rule. Empty arrays render `none`-style (no `undefined`).
5. **synthesis.js `buildSynthesisPrompt`**: add one rule line — never include a stop listed under
   avoid — rendered only when `dislikedPlaces` non-empty (no dangling empty rule).

**Tests:** new `lib/smart/scout.test.mjs` (prompt contains the new signals; clean empties); extend
`lib/smart/synthesis.test.mjs` (avoid line present/absent). `node --test lib/smart/*.test.mjs` green.

**Commit:** `feat(smart): feed curated taste profile into scout + avoid-list into synthesis`

---

## Phase 3 — Settings "Taste Profile" card

**Files:** `screens/SettingsScreen.js` (+ maybe a small `components/` chip-editor if it earns reuse)

1. New `CollapsibleCard` titled "Taste Profile" (persisted collapse via `KEYS.COLLAPSED_SECTIONS`).
2. **Interests**: chip editor = curated suggestion chips (starter set from spec §10.4) + a free-text
   `TextInput` "add your own" + tap-to-remove on selected chips. Persist to `KEYS.INTERESTS` via
   `save()` on change.
3. **Loved places** / **Places to avoid**: two minimal free-text add/remove lists → `KEYS.LOVED_PLACES`
   / `KEYS.AVOIDED_PLACES`.
4. Copy: "Teach Decide what you love." No "AI"/"Cheddar"; theme tokens only; reuse existing chip/list
   styles (match the cuisines/activityStyles editors already in this screen).

**Verify:** `npx expo export --platform web` clean; eyeball card in light + dark.
**Commit:** `feat(settings): add editable Taste Profile card (interests, loved, avoid)`

---

## Phase 4 — Onboarding interests step

**File:** `app/onboarding/index.js`

1. Add a "What lights you up?" block after cuisines — reuse the in-file `ChipGrid` for the starter
   suggestion set + a free-add input; keep it skippable.
2. Save `@decide/interests` in the existing `complete()` `Promise.all` batch (and `skip()` leaves it
   `[]`).
3. Don't let the single scroll get unwieldy — concise heading, no new required interaction.

**Verify:** clean web export; run onboarding → confirm interests persist and appear in Settings.
**Commit:** `feat(onboarding): seed interests in the first-run taste step`

---

## Phase 5 — QA + docs

1. `npx expo export --platform web` → `Exported: dist`; `find api -name '*.js' | wc -l` ≤ 12.
2. On-device: add an interest ("pinball") → generate → confirm discovery visibly leans that way
   (the `discovery.anchors` / "What we found this week" reflects it). Add an avoid → confirm that
   place never appears as a stop. Confirm an empty profile is byte-identical to prior behavior.
3. Twin-parity re-check on `preferences.interests`.
4. Update `docs/superpowers/BACKLOG.md`: mark Taste Profile (§6 #2) done; note the two follow-ups
   surfaced (Firestore sync of the profile; auto-capture loved-places from history / stop affordance).

**Commit:** `docs: mark Taste Profile shipped in BACKLOG`

---

## Rollout / risk

- **Blast radius:** additive. Empty profile ⇒ identical scout/synthesis output to today. The only
  always-on wiring change is *activating* the already-referenced `likedPlaces` line and a new
  interests line — both degrade to "none".
- **Cost:** a few extra short tokens in the (cheap Haiku) scout prompt; one conditional line in the
  Sonnet prompt only when an avoid-list exists. Negligible.
- **No new deps / env vars / serverless functions.** Twin parity is the main correctness watch-item.
- **Reversible:** stop sending `interests`/profile `feedback` from the client to fully neutralize.

## Task checklist

- [ ] Phase 1 — keys + `loadTasteProfile()`, `[]`-safe
- [ ] Phase 2 — client send + both twins + scout/synthesis prompts + tests (trip-note-leads; avoid = hard rule)
- [ ] Phase 3 — Settings Taste Profile card (chips + free-add + loved/avoid), on-brand, both themes
- [ ] Phase 4 — onboarding interests step, skippable
- [ ] Phase 5 — web export clean, fn count ≤12, on-device discovery-shift + avoid check, BACKLOG updated
