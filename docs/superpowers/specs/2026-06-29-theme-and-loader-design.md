# Design — Theme consistency + darker paper + Lottie loader

**Date:** 2026-06-29
**Branch:** `feat/theme-and-loader`
**Status:** Approved design → implementation plan next

## Context

Three user-requested polish items:
1. History and Settings don't feel on-brand vs the rest of the app.
2. A slightly darker app background.
3. Wire up a Lottie loading animation (`loading.json`) for the post-"Build my day" loading state.

Findings from exploring the current code:
- **Settings (`screens/SettingsScreen.js`) is the real theme offender.** It uses gold (`COLORS.amber`,
  the back-compat alias) as the *active/selected* fill almost everywhere — selected avatar tile, Auto/Manual
  mode pills, selected cuisine/dietary/activity chips, the distance slider fill + thumb, the Notifications &
  Demo `Switch` track/thumb, the demo card accent, and the toast. The rest of the app leads with **cobalt**
  (`COLORS.primary`) for selection and reserves gold for warmth/badges (e.g. `plan.js` `PillRow` and
  `history.js` filter pill both use `primary` for active). So Settings reads as a gold-washed variant.
- **History (`app/(tabs)/history.js`) is mostly on-brand** — its active filter pill is already cobalt. It
  only needs a light pass: a legacy `COLORS.teal` alias fallback and an inactive-filter-text gold spot.
- Both screens already use the brand primitives (`ScreenBackground`, `Card`, `SectionLabel`, `CTAButton`).
- The loading state after "Build my day" (`plan.js` ~line 1048) currently renders 3 shimmer skeleton cards
  (`components/SkeletonCard.js`, imported only by `plan.js`).
- `lottie-react-native` is NOT installed. `assets/loading.json` is present and valid (Lottie v5.2.1,
  237×237, ~30fps, ~526 KB).
- Two uncommitted tagline edits (`plan.js`, `login.js`) were carried onto this branch and committed first.

## Decisions (all user-approved)

- Active/selected color on Settings + History → **cobalt-led** (gold demoted to warmth/badges only).
- Darker background → **subtle, app-wide** (global `COLORS.bg` token), hexes tunable after a visual check.
- Lottie → **replaces** the skeleton inline (not a full-screen overlay).
- Demo card → **moves to cobalt** for consistency (no separate warm "sandbox" look).
- `loading.json` lives at **`assets/loading.json`** (already in place).

## Part 1 — Token changes (`constants/theme.js`)

Single-token edits; every consumer updates automatically.

| Token | From | To | Why |
|---|---|---|---|
| `bg` | `#FCF9F4` | `#F6EEDF` | Slightly deeper warm paper; white cards pop more. |
| `surfaceAlt` | `#F6F0E6` | `#ECE3D1` | Step down in tandem so secondary fills still read against the darker paper. |
| `border` | `#ECE2CF` | `#E4D9C4` | Harmonize hairlines on the darker paper. |

Preserves the light→dark ladder: `surface #FFFFFF` › `bg #F6EEDF` › `surfaceAlt #ECE3D1` › `border #E4D9C4`.
Text tokens (`ink`, `textSecondary`, `goldText #8C6010`) retain AA contrast on the lighter paper (goldText
contrast marginally improves). These are starting values — tunable live in the running app.

## Part 2 — Cobalt-led fix

**Principle:** gold *fills / active states* → cobalt; warm eyebrow/label *text* (`goldText`) stays;
text on a cobalt fill → `primaryText` (white).

### Settings (`screens/SettingsScreen.js`) — style-key edits

Gold fill → cobalt:
- `avatarPillActive` `backgroundColor`/`borderColor`: `amber` → `primary`
- `modePillActive` `backgroundColor`/`borderColor`: `amber` → `primary`
- `chipActive` `backgroundColor`/`borderColor`: `amber` → `primary`
- `sliderFill` `backgroundColor`: `amber` → `primary`
- `sliderThumb` `backgroundColor`: `amber` → `primary` (keep white border)
- Demo `Switch` `trackColor.true` + `thumbColor` (on): `amber` → `primary`
- Notifications `Switch` `trackColor.true` + `thumbColor` (on): `amber` → `primary`
- `demoCard` `borderColor`: `amber + '44'` → `primary + '44'`
- `demoDot` `backgroundColor`: `amber` → `primary`
- `demoInfoCard` `borderColor`: `amber + '33'` → `primary + '33'`
- `toast` `borderColor`/`shadowColor`: `amber` → `primary`

Text-on-active fill → white:
- `modePillTextActive` `color`: `COLORS.bg` → `COLORS.primaryText`
- `chipTextActive` `color`: `COLORS.bg` → `COLORS.primaryText`

Stays as-is (intentional warm accents — do NOT change):
- `fieldLabel`, `timePillLabel`, `timePillValue`, `modalTitle`, `modalOptionTextActive`,
  `distanceValue`, `geocodeSuccess`, `suggestionText`, `prefPillText`, `modePillText` (inactive),
  `demoLabel`, `demoInfoText`, `toastText` — all `goldText`/warm by design.
- `prefPillActive` is already `primary` (no change).
- The loading `ActivityIndicator color={COLORS.amber}` (line 422) → `COLORS.primary` (small consistency fix).

### History (`app/(tabs)/history.js`) — light pass
- `DecisionCard` fallback `CATEGORY_COLORS[item.category] ?? COLORS.teal` → `?? COLORS.primary`.
- `filterPillTxt` `color`: `goldText` → `textSecondary` (inactive toggle text reads cobalt-led; active
  already `primaryText`).
- Warm bits stay: `itinCity`, `prefPillTxt`, `stopChip`, `exciteText` (cobalt-tint badge) — unchanged.

## Part 3 — Lottie loading animation

- **Dependency:** install `lottie-react-native` (Expo SDK 56-compatible version) with `--legacy-peer-deps`.
  Use the version Expo SDK 56 expects (resolve via `npx expo install lottie-react-native`).
- **New component `components/LoadingAnimation.js`:**
  - Wraps `LottieView` from `lottie-react-native`: `source={require('../assets/loading.json')}`,
    `autoPlay`, `loop`, sized ~160×160 centered.
  - Below it, the "Building your day…" label rendered with `<SectionLabel tone="cobalt">` — exactly
    matching the label the old skeleton block used (same copy, centered, `marginBottom`-style spacing).
  - Self-contained: props none (or optional `label`). Depends only on `lottie-react-native`, theme tokens,
    and the asset.
- **`plan.js` wiring:** replace the `{loading && (<View style={styles.skeletonSection}>…3 SkeletonStopCard…</View>)}`
  block with `{loading && <LoadingAnimation />}`. Remove the now-unused `SkeletonStopCard` import and the
  `skeletonSection` style if it becomes unused.
- **Delete `components/SkeletonCard.js`** — only `plan.js` imported it; dead after the swap. Restorable from git.

## Testing / verification

No RN unit-test harness (consistent with prior items). Per task:
- `npx expo export --platform web` must build clean — this also confirms the new `lottie-react-native`
  dependency resolves and the `require('../assets/loading.json')` target exists.
- Manual reasoning pass on the token ladder (no surfaceAlt/bg collision) and the cobalt swaps (no gold
  fill left in Settings active states; warm label text preserved).
- Shades and Lottie size are visually tunable in the running app after the build passes.

## Out of scope (deliberate)

- The richer backlog-#4 loading screen (rotating weather/birthday/quote widgets) — this wires only the
  Lottie animation.
- Restyling other screens beyond History/Settings (the rest already lead cobalt).
- A dark mode / full palette overhaul.
