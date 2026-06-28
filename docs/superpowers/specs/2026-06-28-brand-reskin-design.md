# Design — Decide Brand Re-skin

**Date:** 2026-06-28
**Status:** Approved (design); ready for implementation planning
**Scope:** Sub-project #5 of the larger Cheddar effort.

---

## Problem

`constants/theme.js` was flipped to the brand's **light** system (paper/cream, cobalt
lead, orange "go" accent, navy ink), but the app's screens were built for the old
**dark** navy theme. Two gaps remain:

1. **Fonts not applied.** The brand fonts (Bricolage Grotesque / Hanken Grotesk /
   Space Mono) are named in `FONTS` but the packages aren't installed and aren't
   loaded, and screens hardcode `PlayfairDisplay_*` family strings directly (e.g.
   `app/(tabs)/plan.js`, `app/(tabs)/history.js`) rather than reading `FONTS`.
2. **No brand visual language.** The brand kit (`docs/brand/Decide Brand Kit.dc.html`)
   defines white cards with a specific shadow/radii, cobalt "brand wash" gradient
   headers, orange CTAs, Space Mono section labels, layered backgrounds, and a
   distinctive compass SVG logo — none of which are applied.

Until this lands, the app renders half-migrated: light tokens under dark-era layouts,
system fonts instead of brand fonts, and a PNG logo instead of the brand mark.

## Goal

Every screen looks intentionally on-brand: light backgrounds, brand fonts, white
brand cards, cobalt headers, orange CTAs, Space Mono labels, and the compass mark —
driven from a small reusable primitives layer so the brand lives in one place.

## Decisions (approved)

- **Full brand expression** (not just contrast-correctness): apply the kit's card
  style, gradient headers, orange CTAs, mono labels, and fonts.
- **Adopt the SVG compass mark** (`react-native-svg`) with the kit's variants.
- **Verification:** build/bundle check per step + visual review (the controller can
  drive the app in a browser to screenshot key screens). No unit tests — the repo
  has no jest/RTL and RN styling isn't meaningfully unit-testable here.
- **Sequencing:** one spec; the plan is phased — Phase 1 foundation (fonts + SVG +
  brand primitives), then Phase 2+ apply across screen groups.

## Non-goals

- No changes to app logic/behavior, navigation, the smart engine, or itinerary
  stop-card **data** (visual styling of cards is in scope; their data/markup contract
  is not).
- Sub-projects #2 (Taste Profile), #3 (Discovery transparency), #4 (Loading screen)
  are separate. (#4 will add Lottie; this spec does not.)

---

## Architecture

A brand primitives layer in `components/brand/`, composed from `theme.js` tokens +
the loaded fonts. Screens import these instead of re-deriving styles. This honors the
"`theme.js` is the source of truth, no hardcoded hex" rule and makes future brand
tweaks one edit.

```
constants/theme.js  (tokens: COLORS, FONTS, RADII, SHADOWS — already brand-correct)
        │
components/brand/   (primitives below)
        │
app/** screens      (compose primitives; light palette via tokens)
```

### Brand primitives (`components/brand/`)

| Component | Responsibility | Key props |
|---|---|---|
| `BrandLogo` | Compass mark + "Decide." wordmark (SVG) | `variant: 'full'\|'reversed'\|'stacked'\|'mark'`, `size` |
| `ScreenBackground` | Brand backgrounds (paper / cream / sky-wash / brand-wash) | `variant`, `children` |
| `Card` | White surface + brand shadow + `RADII.md` | `style`, `children` |
| `CTAButton` | Orange "go" action (primary) + cobalt secondary | `title`, `onPress`, `variant: 'go'\|'secondary'`, `disabled`, `loading` |
| `SectionLabel` | Space Mono uppercase tracked label (kit `.lbl`/`.sec`) | `children`, `tone` |
| `GradientHeader` | Cobalt→cobalt-deep brand-wash header band | `children` |

Each is a small, single-responsibility file with a documented prop interface, usable
and reviewable independently.

## Foundation (Phase 1 — must land first)

1. **Fonts:**
   `npm i @expo-google-fonts/bricolage-grotesque @expo-google-fonts/hanken-grotesk @expo-google-fonts/space-mono --legacy-peer-deps`
   Load with `useFonts` in `app/_layout.js`, holding the splash until ready
   (`expo-font` is already installed). Then replace every hardcoded `PlayfairDisplay_*`
   family string with the matching `FONTS.*` constant (display→Bricolage,
   body→Hanken, mono→Space Mono). After this, no `PlayfairDisplay` reference remains.
2. **SVG:** `npm i react-native-svg --legacy-peer-deps`; build `BrandLogo` from the
   kit's compass SVG paths.

## Screen application (Phase 2+ — grouped, full sweep)

Apply primitives + light palette across all screens. The dark→light flip is mostly
automatic via tokens; the work per screen is: swap in `ScreenBackground`/`Card`/
`CTAButton`/`GradientHeader`/`SectionLabel`, replace font strings, fix the ~3
remaining hardcoded hexes, and catch any white-on-assumed-dark text.

| Group | Files |
|---|---|
| Tabs | `app/(tabs)/_layout.js` (tab bar), `index.js`, `plan.js`, `spin.js`, `history.js`, `settings.js` |
| Auth | `app/auth/_layout.js`, `login.js`, `signup.js`, `forgot-password.js` |
| Flows | `app/onboarding/index.js`, `app/paywall.js`, `app/result.js`, `app/terms.js`, `app/fallback.js`, `app/_layout.js` |
| Shared | `components/GradientButton.js`, `components/OfflineBanner.js`, `components/SkeletonCard.js`, `screens/SettingsScreen.js`, `screens/SpinScreen.js` |

## Migration concerns

- **White-on-dark text:** any spot that assumed a dark background and set light text
  (without a token) becomes invisible on paper — audit per screen.
- **Hardcoded hexes:** ~3 literal hexes outside `theme.js` in `app/components/screens`
  — replace with tokens.
- **Tab bar:** flips to white (`COLORS.tabBar`) with navy icons/active = cobalt.
- **GradientButton:** likely the existing primary button — reconcile with `CTAButton`
  (either re-skin it to the orange "go" style or have `CTAButton` supersede it).
- **`plan.js` is large (~1700 lines):** apply changes carefully; do not alter the
  itinerary stop-card data contract or the smart-engine wiring added in #1.

## Verification

- Each task: `npx expo export` (or `node --check` for non-JSX edits) bundles cleanly;
  no `PlayfairDisplay`/hardcoded-hex regressions introduced.
- Visual: the controller drives the app in a browser (Expo web) and screenshots key
  screens (plan, result, onboarding, paywall, a tab, login) for the user's review.
- Final: full-app bundle succeeds; user signs off on the visual result.

## Out of scope

Sub-projects #2, #3, #4. No behavioral/logic changes. No test-framework introduction.
