# Session 6 — Preferences Additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new user preferences — Chinese cuisine, four new activity styles (Live Music, Arcades, Theme Parks, Mini-Golf), and a "Neurodivergent-friendly" option wired through to Cheddar's itinerary-generation prompt.

**Architecture:** Mostly additive edits to existing option-list arrays. The only multi-file thread is the new `neurodivergent` boolean preference: a dedicated AsyncStorage key + Settings chip, threaded through the request payload → both API handlers → the shared synthesis prompt. Option lists for cuisines are duplicated in two UI files and must stay identical; the generation prompts live in shared `lib/smart/` so they reach both handlers automatically.

**Tech Stack:** Expo SDK 56, React Native, expo-router, AsyncStorage, shared smart engine in `lib/smart/` (scout=haiku, synthesis=sonnet).

**Spec:** `docs/superpowers/specs/2026-06-30-session-6-preferences-design.md`

## Global Constraints

- **No RN unit tests** (repo convention). Verification per task = clean `npx expo export --platform web` (ends `Exported: dist`) + targeted grep + the manual smoke described in the task.
- **Mirroring:** `CUISINES` must stay byte-identical in `screens/SettingsScreen.js` and `app/onboarding/index.js`. The `neurodivergent` destructure must appear in BOTH API handlers (`api/itinerary.js` Vercel/prod and `app/api/itinerary+api.js` Expo).
- **Token discipline:** no raw hex, no `fontWeight` literals; style via existing themed components/styles (`ChipGrid`, `styles.fieldLabel`, `styles.sensitivityNote`). The new chip adds NO new styles.
- **Copy rule:** user-facing strings say "Cheddar", never "AI". The option label is exactly `Neurodivergent-friendly`. The activity style is exactly `Live Music` (the live-music detection regex is `/live music/i`).
- **Both themes:** the new chip must render correctly in light AND dark (reusing `ChipGrid` gives this for free).
- **Expo SDK 56** — reference https://docs.expo.dev/versions/v56.0.0/ if an API question arises.

## Setup (do once before Task 1)

- [ ] Create a working branch:

```bash
cd decide-app
git checkout main && git pull
git checkout -b feat/session-6-preferences
```

---

### Task 1: Add Chinese cuisine (both lists)

**Files:**
- Modify: `screens/SettingsScreen.js:25` (the `CUISINES` array)
- Modify: `app/onboarding/index.js:36-39` (the `CUISINES` array)

**Interfaces:**
- Produces: `'Chinese'` selectable in both the Settings and onboarding cuisine chip grids; persisted under `@decide/cuisines`; flows into the scout prompt via the existing `cuisines` path. No consumer changes needed.

- [ ] **Step 1: Edit the Settings cuisine list**

In `screens/SettingsScreen.js`, line 25 currently:

```js
const CUISINES        = ['Italian', 'Mexican', 'Japanese', 'American', 'Thai', 'Indian', 'Mediterranean', 'Korean', 'Vietnamese', 'BBQ', 'Seafood', 'Pizza'];
```

Change to (insert `'Chinese'` after `'Japanese'`):

```js
const CUISINES        = ['Italian', 'Mexican', 'Japanese', 'Chinese', 'American', 'Thai', 'Indian', 'Mediterranean', 'Korean', 'Vietnamese', 'BBQ', 'Seafood', 'Pizza'];
```

- [ ] **Step 2: Edit the onboarding cuisine list (mirror)**

In `app/onboarding/index.js`, lines 36-39 currently:

```js
const CUISINES = [
  'Italian', 'Mexican', 'Japanese', 'American', 'Thai', 'Indian',
  'Mediterranean', 'Korean', 'Vietnamese', 'BBQ', 'Seafood', 'Pizza',
];
```

Change to (insert `'Chinese'` after `'Japanese'`, keeping the set identical to Settings):

```js
const CUISINES = [
  'Italian', 'Mexican', 'Japanese', 'Chinese', 'American', 'Thai', 'Indian',
  'Mediterranean', 'Korean', 'Vietnamese', 'BBQ', 'Seafood', 'Pizza',
];
```

- [ ] **Step 3: Verify both lists contain Chinese**

Run:

```bash
grep -n "'Chinese'" screens/SettingsScreen.js app/onboarding/index.js
```

Expected: one match in each file.

- [ ] **Step 4: Verify clean build**

Run: `npx expo export --platform web`
Expected: ends with `Exported: dist`, no errors.

- [ ] **Step 5: Manual smoke (web)**

Run `npx expo start --web`. In Settings → Preferences → CUISINES, confirm a "Chinese" chip appears and toggles. Re-run onboarding (or inspect) to confirm "Chinese" also appears there.

- [ ] **Step 6: Commit**

```bash
git add screens/SettingsScreen.js app/onboarding/index.js
git commit -m "feat: add Chinese as a cuisine preference option"
```

---

### Task 2: Add four activity styles + Theme Park source

**Files:**
- Modify: `screens/SettingsScreen.js:27` (the `ACTIVITY_STYLES` array)
- Modify: `lib/smart/sourceRegistry.js:5-16` (the `INTEREST_OSM_TAGS` dict)

**Interfaces:**
- Produces: `'Live Music'`, `'Arcades'`, `'Theme Parks'`, `'Mini-Golf'` selectable in the Settings activity-style chip grid (persisted under `@decide/activity_styles`). `'Live Music'` auto-satisfies the existing live-music detection gates (`lib/smart/discovery.js:42-45`, `lib/smart/liveMusic.js:15-18`, the `livemusic` source in `sourceRegistry.js`). Theme-park interests resolve to OSM tag `tourism=theme_park` via the Overpass source. No consumer changes needed beyond the dict.

- [ ] **Step 1: Edit the activity styles list**

In `screens/SettingsScreen.js`, line 27 currently:

```js
const ACTIVITY_STYLES = ['Outdoor', 'Indoor', 'Cultural', 'Nightlife', 'Shopping', 'Sports', 'Wellness', 'Family-Friendly'];
```

Change to:

```js
const ACTIVITY_STYLES = ['Outdoor', 'Indoor', 'Cultural', 'Nightlife', 'Shopping', 'Sports', 'Wellness', 'Family-Friendly', 'Live Music', 'Arcades', 'Theme Parks', 'Mini-Golf'];
```

- [ ] **Step 2: Add Theme Park OSM tag entries**

In `lib/smart/sourceRegistry.js`, the `INTEREST_OSM_TAGS` dict currently begins (lines 5-16):

```js
export const INTEREST_OSM_TAGS = {
  'arcades': 'leisure=amusement_arcade',
  'mini golf': 'leisure=miniature_golf',
  'disc golf': 'leisure=disc_golf_course',
```

Insert three theme-park rows immediately after the `'mini golf'` line, so it reads:

```js
export const INTEREST_OSM_TAGS = {
  'arcades': 'leisure=amusement_arcade',
  'mini golf': 'leisure=miniature_golf',
  'theme parks': 'tourism=theme_park',
  'theme park': 'tourism=theme_park',
  'amusement park': 'tourism=theme_park',
  'disc golf': 'leisure=disc_golf_course',
```

(Three spellings cover the exact-key lookup in `runOverpass`, which keys off the scout's interest string. The other three styles need no dict change: Arcades and Mini-Golf already resolve via existing tags, and all four flow as free text into the scout + synthesis prompts regardless.)

- [ ] **Step 3: Verify the additions**

Run:

```bash
grep -n "'Live Music'" screens/SettingsScreen.js && grep -n "tourism=theme_park" lib/smart/sourceRegistry.js
```

Expected: the activity-styles line matches in `SettingsScreen.js`, and three `tourism=theme_park` lines in `sourceRegistry.js`.

- [ ] **Step 4: Verify clean build**

Run: `npx expo export --platform web`
Expected: ends with `Exported: dist`, no errors.

- [ ] **Step 5: Manual smoke (web)**

Run `npx expo start --web`. In Settings → Preferences → ACTIVITY STYLE, confirm all four new chips appear and toggle. Then generate a plan with **Live Music** selected (in a city likely to have shows) and confirm a live-music stop / "Live find" surfaces (the live-music detection chain firing). Generate one with **Theme Parks** selected and confirm it does not error (sources from OSM where available, else web fallback).

- [ ] **Step 6: Commit**

```bash
git add screens/SettingsScreen.js lib/smart/sourceRegistry.js
git commit -m "feat: add Live Music, Arcades, Theme Parks, Mini-Golf activity styles + theme park source"
```

---

### Task 3: "Neurodivergent-friendly" — storage key + Settings UI

**Files:**
- Modify: `services/settingsService.js` (add `KEYS.NEURODIVERGENT`, `DEFAULTS.neurodivergent`, and the `loadAllSettings` return field)
- Modify: `screens/SettingsScreen.js` (add state, load, toggle, and the chip render)

**Interfaces:**
- Produces: AsyncStorage key `@decide/neurodivergent` (boolean, stored as the string `'true'`/`'false'` via the existing `save()` helper). `loadAllSettings()` returns `neurodivergent: boolean`. A "Neurodivergent-friendly" chip in the Settings → Preferences → SENSORY ENVIRONMENT block toggles it. Task 4 reads `@decide/neurodivergent`.

- [ ] **Step 1: Add the storage key**

In `services/settingsService.js`, the `KEYS` object currently includes (line 11):

```js
  SENSITIVITIES:      '@decide/sensitivities',    // array of sensitivity names (food + environmental)
```

Add a new key immediately after it:

```js
  SENSITIVITIES:      '@decide/sensitivities',    // array of sensitivity names (food + environmental)
  NEURODIVERGENT:     '@decide/neurodivergent',   // boolean — sensory-friendly itinerary bias
```

- [ ] **Step 2: Add the default**

In the same file, `DEFAULTS` currently includes (line 32):

```js
  sensitivities:  [],
```

Add immediately after it:

```js
  sensitivities:  [],
  neurodivergent: false,
```

- [ ] **Step 3: Return it from `loadAllSettings`**

In `loadAllSettings()`, the return object currently includes (line 60):

```js
      sensitivities:  map[KEYS.SENSITIVITIES]       ?? DEFAULTS.sensitivities,
```

Add immediately after it:

```js
      sensitivities:  map[KEYS.SENSITIVITIES]       ?? DEFAULTS.sensitivities,
      neurodivergent: map[KEYS.NEURODIVERGENT]      ?? DEFAULTS.neurodivergent,
```

(`loadAllSettings` already `multiGet`s every key in `KEYS` except `TOS_ACCEPTED`, so the new key is fetched automatically. `parse()` turns the stored `'true'`/`'false'` string into a real boolean.)

- [ ] **Step 4: Add component state**

In `screens/SettingsScreen.js`, the state declarations currently include (line 239):

```js
  const [sensitivities,  setSensitivities]  = useState([]);
```

Add immediately after it:

```js
  const [sensitivities,  setSensitivities]  = useState([]);
  const [neurodivergent, setNeurodivergent] = useState(false);
```

- [ ] **Step 5: Load it in the settings effect**

In the load effect, the block currently includes (line 274):

```js
      setSensitivities(s.sensitivities ?? []);
```

Add immediately after it:

```js
      setSensitivities(s.sensitivities ?? []);
      setNeurodivergent(s.neurodivergent ?? false);
```

- [ ] **Step 6: Add the toggle handler**

The toggle handlers currently end with (line 389):

```js
  const toggleSensitivity  = (id) => { const next = sensitivities.includes(id) ? sensitivities.filter((x) => x !== id) : [...sensitivities, id]; setSensitivities(next); save(KEYS.SENSITIVITIES, next); };
```

Add immediately after it:

```js
  const toggleNeurodivergent = () => { const next = !neurodivergent; setNeurodivergent(next); save(KEYS.NEURODIVERGENT, next); };
```

- [ ] **Step 7: Render the chip**

In the Preferences `CollapsibleCard`, the allergen disclaimer block currently ends at (lines 531-533):

```jsx
            <Text style={styles.sensitivityDisclaimer}>
              ⚠ These alerts are informational only. Always verify allergen information directly with the venue.
            </Text>
```

Immediately AFTER that closing `</Text>` (and before the `{/* ACTIVITY STYLE & DISTANCE */}` comment), insert:

```jsx
            {/* SENSORY ENVIRONMENT */}
            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>SENSORY ENVIRONMENT</Text>
            <ChipGrid
              options={['Neurodivergent-friendly']}
              selected={neurodivergent ? ['Neurodivergent-friendly'] : []}
              onToggle={toggleNeurodivergent}
            />
            <Text style={styles.sensitivityNote}>
              When on, Cheddar favors calmer, quieter, more predictable places and a less packed schedule.
            </Text>
```

(`ChipGrid`, `styles.fieldLabel`, and `styles.sensitivityNote` already exist and are themed — no new styles, so token discipline and dark mode are satisfied automatically. `ChipGrid`'s `onToggle` is called with the option string; `toggleNeurodivergent` ignores its argument and flips the boolean.)

- [ ] **Step 8: Verify the wiring**

Run:

```bash
grep -n "NEURODIVERGENT\|neurodivergent" services/settingsService.js && grep -n "neurodivergent\|Neurodivergent-friendly" screens/SettingsScreen.js
```

Expected: key/default/return in `settingsService.js`; state + load + toggle + the chip label in `SettingsScreen.js`.

- [ ] **Step 9: Verify clean build**

Run: `npx expo export --platform web`
Expected: ends with `Exported: dist`, no errors.

- [ ] **Step 10: Manual smoke (web)**

Run `npx expo start --web`. In Settings → Preferences, scroll to **SENSORY ENVIRONMENT**, toggle "Neurodivergent-friendly" on, fully reload the app, and confirm it is still on (persisted). Toggle in light and dark mode (Settings → Appearance) and confirm the chip is legible in both.

- [ ] **Step 11: Commit**

```bash
git add services/settingsService.js screens/SettingsScreen.js
git commit -m "feat: add Neurodivergent-friendly preference (storage + Settings UI)"
```

---

### Task 4: Wire `neurodivergent` through to the generation prompt

**Files:**
- Modify: `app/(tabs)/plan.js:417-432` (read the key + pass the arg)
- Modify: `services/itineraryService.js:16-37` (accept the arg + include in payload)
- Modify: `app/api/itinerary+api.js:325, 362` (destructure + add to `ctx.prefs`)
- Modify: `api/itinerary.js:214, 245` (destructure + add to `ctx.prefs`) — MUST mirror the Expo handler
- Modify: `lib/smart/synthesis.js:42` (conditional prompt line)

**Interfaces:**
- Consumes: `@decide/neurodivergent` (Task 3) and the `neurodivergent` field on the POST `preferences` object.
- Produces: `ctx.prefs.neurodivergent: boolean`, read by `buildSynthesisPrompt` (`p.neurodivergent`) to inject a soft accessibility constraint.

- [ ] **Step 1: Read and pass the value in `plan.js`**

In `app/(tabs)/plan.js`, the `generate()` block currently reads (lines 417-432):

```js
      const [stylesRaw, dietRaw] = await Promise.all([
        AsyncStorage.getItem('@decide/activity_styles'),
        AsyncStorage.getItem('@decide/dietary'),
      ]);
      const activityStyles = stylesRaw ? JSON.parse(stylesRaw) : [];
      const dietary = dietRaw ? JSON.parse(dietRaw) : [];

      const data = await generateItinerary({
        latitude:  coords.latitude,
        longitude: coords.longitude,
        preferences: { pace, budget, group_type: groupType, cuisines, sensitivities },
        startTime, endTime, date: planDate,
        feedback: feedbackCtx,
        maxDistanceMiles,
        tripNote, activityStyles, dietary,
      });
```

Change it to read the neurodivergent key and pass it through:

```js
      const [stylesRaw, dietRaw, ndRaw] = await Promise.all([
        AsyncStorage.getItem('@decide/activity_styles'),
        AsyncStorage.getItem('@decide/dietary'),
        AsyncStorage.getItem('@decide/neurodivergent'),
      ]);
      const activityStyles = stylesRaw ? JSON.parse(stylesRaw) : [];
      const dietary = dietRaw ? JSON.parse(dietRaw) : [];
      const neurodivergent = ndRaw === 'true';

      const data = await generateItinerary({
        latitude:  coords.latitude,
        longitude: coords.longitude,
        preferences: { pace, budget, group_type: groupType, cuisines, sensitivities },
        startTime, endTime, date: planDate,
        feedback: feedbackCtx,
        maxDistanceMiles,
        tripNote, activityStyles, dietary, neurodivergent,
      });
```

(The `save()` helper stores booleans as the string `'true'`/`'false'`, so `ndRaw === 'true'` is the correct read.)

- [ ] **Step 2: Accept and forward it in `itineraryService.js`**

In `services/itineraryService.js`, the `generateItinerary` signature currently ends (line 22):

```js
  tripNote = '', activityStyles = [], dietary = [],
}) {
```

Change to add the parameter:

```js
  tripNote = '', activityStyles = [], dietary = [], neurodivergent = false,
}) {
```

Then the POST body currently reads (line 36):

```js
    body: JSON.stringify({ latitude, longitude, date, preferences: { ...preferences, activityStyles, dietary }, startTime, endTime, feedback, maxDistanceMiles, tripNote }),
```

Change to include `neurodivergent` in `preferences`:

```js
    body: JSON.stringify({ latitude, longitude, date, preferences: { ...preferences, activityStyles, dietary, neurodivergent }, startTime, endTime, feedback, maxDistanceMiles, tripNote }),
```

- [ ] **Step 3: Destructure + add to `ctx.prefs` in the Expo handler**

In `app/api/itinerary+api.js`, line 325 currently:

```js
    const { pace = 'moderate', budget = '$$', group_type = 'couple', cuisines = [], sensitivities = [], activityStyles = [], dietary = [] } = preferences;
```

Change to add `neurodivergent`:

```js
    const { pace = 'moderate', budget = '$$', group_type = 'couple', cuisines = [], sensitivities = [], activityStyles = [], dietary = [], neurodivergent = false } = preferences;
```

Then `ctx.prefs` currently reads (line 362):

```js
      prefs: { pace, budget, group_type, cuisines, activityStyles, dietary },
```

Change to:

```js
      prefs: { pace, budget, group_type, cuisines, activityStyles, dietary, neurodivergent },
```

- [ ] **Step 4: Destructure + add to `ctx.prefs` in the Vercel handler (mirror)**

In `api/itinerary.js`, line 214 currently:

```js
    const { pace='moderate', budget='$$', group_type='couple', cuisines=[], activityStyles=[], dietary=[] } = preferences;
```

Change to add `neurodivergent`:

```js
    const { pace='moderate', budget='$$', group_type='couple', cuisines=[], activityStyles=[], dietary=[], neurodivergent=false } = preferences;
```

Then `ctx.prefs` currently reads (line 245):

```js
      prefs: { pace, budget, group_type, cuisines, activityStyles, dietary },
```

Change to:

```js
      prefs: { pace, budget, group_type, cuisines, activityStyles, dietary, neurodivergent },
```

- [ ] **Step 5: Add the conditional prompt line in `synthesis.js`**

In `lib/smart/synthesis.js`, `buildSynthesisPrompt`, the rules currently include these two consecutive lines (41-42):

```js
- If a requested activity type cannot be sourced from the anchors, finds, or places, add a short note stop or call it out in a stop's reason rather than silently dropping it.
- If a stop is a live-music venue (provenance interest "live music"), copy its show info into a "live_music" field on the stop: {"note": the find's snippet}.
```

Replace the SECOND of those two lines (the `- If a stop is a live-music venue...` line) with a version that prefixes a conditional accessibility rule, so when `neurodivergent` is true a bullet is added and when false nothing changes (no blank line):

```js
- If a requested activity type cannot be sourced from the anchors, finds, or places, add a short note stop or call it out in a stop's reason rather than silently dropping it.
${p.neurodivergent ? '- Accessibility: this traveler is neurodivergent / sensory-sensitive. Favor calmer, quieter, structured, predictable places and a gentler pace; avoid loud, crowded, chaotic, or overstimulating venues.\n' : ''}- If a stop is a live-music venue (provenance interest "live music"), copy its show info into a "live_music" field on the stop: {"note": the find's snippet}.
```

(`p` is already `ctx.prefs || {}` at the top of the function. The `${...}` sits at the start of the line, so when false the next bullet follows directly with no blank line.)

- [ ] **Step 6: Verify the value threads through all five files**

Run:

```bash
grep -n "neurodivergent" "app/(tabs)/plan.js" services/itineraryService.js "app/api/itinerary+api.js" api/itinerary.js lib/smart/synthesis.js
```

Expected: at least one match in each of the five files (plan.js: read + arg; itineraryService: param + body; both handlers: destructure + ctx.prefs; synthesis: the conditional line).

- [ ] **Step 7: Verify clean build**

Run: `npx expo export --platform web`
Expected: ends with `Exported: dist`, no errors.

- [ ] **Step 8: Manual smoke (web)**

Run `npx expo start --web`. Turn **Neurodivergent-friendly** ON in Settings, generate an itinerary, and confirm the result skews toward calmer/quieter/structured venues and a gentler pace. Turn it OFF and regenerate the same inputs to confirm prior behavior returns. (Optional: temporarily log the synthesis user prompt to confirm the accessibility line appears only when on.)

- [ ] **Step 9: Commit**

```bash
git add "app/(tabs)/plan.js" services/itineraryService.js "app/api/itinerary+api.js" api/itinerary.js lib/smart/synthesis.js
git commit -m "feat: wire neurodivergent preference into itinerary generation prompt"
```

---

## Finish

- [ ] After all four tasks pass review, finish the branch per the repo workflow (merge to `main` locally + push `main` + push branch). See memory `feedback-finish-branch-merge-and-push`.
- [ ] After pushing, verify the live Vercel prod build went green (a failed build silently freezes prod — see memory `project-vercel-deploy-gotchas`).

---

## Self-Review (author check — already run)

**Spec coverage:**
- §Task 18 Chinese cuisine (both lists) → Task 1. ✅
- §Task 17 four activity styles + Theme Park source → Task 2. ✅
- §Task 16 Neurodivergent-friendly: UI + dedicated storage key → Task 3; payload → both handlers → synthesis prompt → Task 4. ✅
- §Non-goals respected: sensitivities general drop NOT fixed; no Places-type mapping beyond Theme Parks; cuisines stay scout-only; onboarding only gains Chinese. ✅
- §Edge cases: `neurodivergent` defaults false everywhere (settingsService DEFAULTS, plan.js `=== 'true'`, both handlers `= false`, synthesis conditional) → off/legacy users get the current prompt verbatim. ✅
- §Verification = build + grep + manual smoke (no RN unit tests) → each task. ✅

**Placeholder scan:** no TBD/TODO; every code edit shows exact before/after. ✅

**Type consistency:** `neurodivergent` is a boolean end-to-end — stored string `'true'`/`'false'` (save) → parsed to boolean (settingsService `parse`, plan.js `=== 'true'`) → boolean field on `preferences` → `= false` default in both handlers → `ctx.prefs.neurodivergent` → `p.neurodivergent` in synthesis. Key name `@decide/neurodivergent` / `KEYS.NEURODIVERGENT` consistent across files. `CUISINES` insertion keeps both arrays identical. ✅
