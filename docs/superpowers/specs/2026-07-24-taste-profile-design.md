# Design Spec — Taste Profile

**Date:** 2026-07-24
**Status:** Proposed
**Origin:** BACKLOG §6 #2 — "onboarding additions + an always-editable 'teach' interests screen +
storage, to give the engine's scout richer fuel than the current saved prefs + per-trip note."

---

## 1. Problem

The Smart Discovery **scout** (`lib/smart/scout.js`) turns a traveler into "hunt-able interests"
(pinball, vinyl, tide pools…) that drive live discovery. Today its only fuel is:
- per-trip **prefs** (pace, group, cuisines, activityStyles) — coarse, not niche, and
- the one-off **tripNote** the user types for *this* trip.

There's no persistent picture of what a person actually loves. Two people who both pick "moderate /
couple / foodie" get near-identical hunts. The scout can't surface "this person is obsessed with
vintage arcades and third-wave coffee" because nobody ever told it — and there's nowhere to.

**Notable (corrected against the call site, `plan.js` L439–454):** `feedback.likedPlaces`/
`dislikedPlaces` are already populated — but only *implicitly*, from thumbs-up/down **history**
(up-voted decision names → `likedPlaces`, capped 10; down-voted → `dislikedPlaces`, capped 20).
`likedPlaces` is consumed by the scout (line 15); `dislikedPlaces` rides into `ctx.feedback` in both
twins yet is **consumed nowhere**. So this feature (a) adds *explicit user curation* unioned with the
implicit history signal, and (b) finally **activates the avoid constraint** — which makes the
already-collected history down-votes count too, a free win. Part new surface, part activating
half-wired plumbing → lower risk.

## 2. Goal

A persistent, user-curated **Taste Profile** — always editable, seeded at onboarding — that feeds the
discovery engine standing signals beyond a single trip:

1. **Interests** (new) — free-form niche tags the user curates. The scout's richest possible fuel:
   these *are* pre-made hunts.
2. **Loved places** (activate existing hook) — place names → `feedback.likedPlaces`, already
   referenced by the scout; just needs to be stored and sent.
3. **Places to avoid** (new signal, existing slot) — `feedback.dislikedPlaces`, wired into a negative
   constraint the scout and synthesis both honor.

The per-trip `tripNote` stays first-class and dominant for the trip at hand; the Taste Profile is
standing background context, not an override.

## 3. Non-goals

- **No new API endpoint.** Everything rides the existing `/api/itinerary` request (Vercel is at
  12/12 functions). New signals travel inside the existing `preferences` + `feedback` payload.
- **No cross-device sync in v1.** Like every other preference today, the Taste Profile lives in
  AsyncStorage (device-local). Firestore sync is a noted follow-up, not this spec.
- **Not** an automatic learning/feedback loop (thumbs-up on stops auto-training the profile). v1 is
  *explicit* curation only. Auto-capture from itinerary history is a strong follow-up.
- **Not** a redesign of the existing Preferences (cuisines/dietary/activityStyles/neurodivergent) —
  Taste Profile is additive and sits alongside them.

---

## 4. Data facts (verified against current code)

| Thing | Reality |
|---|---|
| Prefs storage | `services/settingsService.js` — flat AsyncStorage keys (`@decide/*`), `save(key,val)`, `loadAllSettings()` / `loadPlanDefaults()`. Device-local only. |
| Client → server | `services/itineraryService.js` POSTs `{ preferences:{...,activityStyles,dietary,neurodivergent}, feedback, tripNote, startTime, endTime, maxDistanceMiles }`. |
| Server ctx build | `app/api/itinerary+api.js` (~L376–433) reads `preferences` → `ctx.prefs = {pace,budget,group_type,cuisines,activityStyles,dietary,neurodivergent}` and `feedback` → `ctx.feedback = {likedPlaces,dislikedPlaces,dislikedReasons}`. **Prod twin `api/itinerary.js` must mirror any change.** |
| Scout fuel | `buildScoutPrompt(ctx)` uses `prefs.activityStyles/cuisines/group_type/pace`, `feedback.likedPlaces` (fed from thumbs-up history), `tripNote`. Pure + exportable → unit-testable. |
| likedPlaces / dislikedPlaces | populated in `plan.js` from thumbs-up/down history (10/20 cap) → `ctx.feedback`. `likedPlaces` used by scout; **`dislikedPlaces` used nowhere** — activating it is part of this feature. |
| Synthesis | `buildSynthesisPrompt` uses `ctx.prefs` (incl. `neurodivergent`) + `ctx.sun`; does **not** read `feedback`. |
| Onboarding | `app/onboarding/index.js` — single scroll screen: pace/group pills, cuisine `ChipGrid`, notif toggle → `save(KEYS.*)`. Reusable `ChipGrid` + `PillRow` components already in-file. |
| Settings | `screens/SettingsScreen.js` — collapsible sections via `components/brand/CollapsibleCard.js`; an Itinerary Preferences block already edits cuisines/dietary/activityStyles/etc. |

---

## 5. Data model (new AsyncStorage keys)

```
@decide/interests       string[]  // niche hunt-able tags, e.g. ["pinball","vinyl records","tide pools"]
@decide/loved_places    string[]  // free-text place names, e.g. ["Burley Oak","Fractured Prune"]
@decide/avoided_places  string[]  // free-text place names to never resurface
```

- All optional, default `[]`. Short strings. **Cap each at 20 stored**; feed at most **15** of each to
  the engine to bound scout token cost (log if truncated, per the no-silent-caps convention).
- Added to `KEYS`, `DEFAULTS`, `loadAllSettings()`, and a new `loadTasteProfile()` helper that
  `plan.js` calls at generate time.

## 6. Request & engine wiring

**Client** (`services/itineraryService.js`, `app/(tabs)/plan.js`): load the Taste Profile and merge
into the existing payload — `preferences.interests = interests`, and
`feedback.likedPlaces = lovedPlaces`, `feedback.dislikedPlaces = avoidedPlaces` (unioned with any
per-trip feedback). No new request shape.

**Server** (both twins): read `preferences.interests` → `ctx.prefs.interests` (default `[]`);
`feedback.likedPlaces/dislikedPlaces` already map to `ctx.feedback` — no change there beyond making
sure the values flow.

**Scout** (`lib/smart/scout.js` `buildScoutPrompt`): add two lines and one instruction —
```
Standing interests they curated: {prefs.interests join} .   // high-signal, treat as seed hunts
Places they love: {feedback.likedPlaces join} .              // (activate existing "Liked before" line)
Never suggest / avoid: {feedback.dislikedPlaces join} .
```
Keep the existing equal-weight + collapse-duplicates rule. Curated interests are **strong seeds** but
the per-trip `tripNote` still leads: instruct "if the trip note names specific interests, prioritize
those for today; use the standing interests as additional fuel, not a replacement."

**Synthesis** (`lib/smart/synthesis.js`): one negative constraint only —
`- Never include a stop the traveler listed under "avoid": {dislikedPlaces}.` Interests and loved
places stay **scout-only** (they shape *discovery*; synthesis already consumes the resulting
finds/anchors). Rationale: the Sonnet synthesis call is the expensive one — don't dilute it or pay
tokens for signals the scout already acted on.

## 7. UI surfaces

**A. Settings — new "Taste Profile" `CollapsibleCard`** (the always-editable home):
- **Interests**: a chip editor — a curated suggestion set (fast tap) + a free-text "add your own"
  input; tap-to-remove. This is the headline surface.
- **Loved places** / **Places to avoid**: two simple free-text add/remove lists.
- Copy stays on-brand: never "AI"/"Cheddar"; frame as "Teach Decide what you love." Theme tokens
  only, no raw hex; reuse existing chip/list styles.

**B. Onboarding — one added step** (`app/onboarding/index.js`): "What lights you up?" with the same
interests chip editor (suggestions + free-add), skippable like the rest. Saves `@decide/interests`
in the existing `complete()` batch. Keep the screen from getting long — collapse into the existing
scroll, after cuisines.

**C. (Follow-up, not v1)** an "＋ Add to my taste profile" affordance on a liked itinerary stop, to
grow loved-places without visiting Settings.

## 8. Precedence & privacy notes

- **Trip note wins for the trip.** Standing interests never override an explicit "today I want X."
  Encoded in the scout instruction (§6).
- **Avoid is a hard rule.** dislikedPlaces → both scout ("never suggest") and synthesis ("never
  include"). It should be the one signal the engine treats as non-negotiable.
- Taste Profile is personal data; it stays in AsyncStorage and only leaves the device inside the
  itinerary request the user already initiates. No new telemetry.

## 9. Test plan

- `lib/smart/scout.test.mjs` (new) — `buildScoutPrompt` includes curated interests, loved places, and
  the avoid line; empty arrays render clean "none"-style fallbacks (no `undefined`), matching the
  existing `|| 'none'` style.
- `lib/smart/synthesis.test.mjs` (extend) — the avoid constraint appears when `dislikedPlaces`
  present and is absent when empty (no dangling empty rule).
- `services/settingsService` — `loadTasteProfile()` returns `{interests,lovedPlaces,avoidedPlaces}`
  with `[]` defaults and survives malformed storage (mirrors existing try/catch loaders).
- Twin parity check: `preferences.interests` handled identically in `app/api/itinerary+api.js` and
  `api/itinerary.js`.
- Build: `npx expo export --platform web` → `Exported: dist`. Function count unchanged (≤12).

## 10. Open questions (recommendations in **bold**)

1. **Feed depth to synthesis.** Recommend **interests + loved = scout-only; avoided = scout +
   synthesis.** Alternative (interests also nudged in synthesis) risks over-biasing toward a hobby
   even when the day's finds don't support it, and costs Sonnet tokens. Start lean; widen if QA shows
   interests getting lost.
2. **Cross-device sync.** Recommend **AsyncStorage-only v1** (consistent with all prefs). Firestore
   sync (like history) is a clean follow-up once the shape settles.
3. **Auto-learning from history.** Out of scope v1 — but the loved-places list is exactly the
   substrate an auto-capture loop would fill later. Note the seam; don't build it.
4. **Curated suggestion set** for the interests chips — a starter list (arcades, live music, hiking,
   coffee, vinyl, thrifting, tide pools, breweries, art galleries, farmers markets…) plus free-add.
   Recommend **ship a ~15-tag regional-neutral starter set**; free-add covers the long tail.
5. Storage caps (20 stored / 15 sent) — proposed; tunable after seeing real profiles.

## 11. Definition of done

- [ ] New keys + `loadTasteProfile()` in `settingsService.js`, with `[]` defaults + malformed-safe.
- [ ] Client sends `preferences.interests` + `feedback.liked/dislikedPlaces` from the profile;
      per-trip note still leads.
- [ ] Both API twins map `interests` into `ctx.prefs`; `feedback` flows unchanged.
- [ ] Scout prompt consumes interests + loved + avoid (equal-weight, trip-note-leads); synthesis
      hard-excludes avoided places.
- [ ] Settings "Taste Profile" card (chips + free-add + loved/avoid lists), always editable, on-brand.
- [ ] Onboarding interests step, skippable.
- [ ] Tests green (scout prompt, synthesis constraint, loader); clean web export; fn count ≤12; twins
      in parity; no "AI"/"Cheddar" in new copy; theme tokens only.
- [ ] On-device: add an interest → generate → confirm it visibly shifts discovery; add an avoid →
      confirm that place never appears.
