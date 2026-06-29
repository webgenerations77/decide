# Design — Settings redesign + app-wide orange→cobalt CTA sweep

**Date:** 2026-06-29
**Branch:** `feat/settings-redesign`
**Status:** Approved design → implementation plan next

## Context

After the theme/cobalt work deployed (production was stale until a `.npmrc` fix unblocked the Vercel
build), the app reads cobalt-led — but two things remain:
1. **Orange is still the primary CTA color app-wide.** `CTAButton variant="go"` (orange gradient) is used
   in 9 places, plus a few custom orange buttons. The user wants cobalt to lead all CTAs.
2. **The Settings screen is "sloppy."** User-confirmed issues (all four): too long/overwhelming, wrong
   section order, warm ochre (`goldText`) labels, inconsistent spacing/cards.

Decisions (user-approved):
- **All primary CTAs → cobalt** app-wide. Orange survives only as the logo dot and the food category
  color. Update the brand doc.
- **Settings field labels → neutral grey** (not cobalt).
- **Reorder + consolidate** Settings; **no functional changes**, no settings added/removed.

## Part A — Orange→cobalt CTA sweep

**Principle:** cobalt leads every call-to-action. Orange (`COLORS.accent`) is reserved for the BrandLogo
dot and the `food` category semantic only — never a button.

Changes:
- All 9 `CTAButton variant="go"` → `variant="cobalt"`:
  `app/auth/login.js`, `app/auth/signup.js`, `app/auth/forgot-password.js`, `app/(tabs)/plan.js`
  ("Build my day"), `app/(tabs)/history.js` ("Go to DECIDE"), `app/beta-guide.js`, `app/onboarding/index.js`,
  `app/paywall.js`, `screens/SpinScreen.js`.
- Custom orange buttons → cobalt:
  - `app/(tabs)/plan.js` "Navigate full day" `LinearGradient colors={[COLORS.accent, COLORS.gold]}` →
    `[COLORS.primary, COLORS.primaryDark]` (and any matching `shadowColor`).
  - `app/result.js` `LinearGradient colors={[COLORS.accent, COLORS.accent]}` → `[COLORS.primary, COLORS.primaryDark]`;
    `shadowColor: COLORS.accent` → `COLORS.primary`.
  - `app/fallback.js` button `backgroundColor: COLORS.accent` → `COLORS.primary`; `shadowColor: COLORS.accent`
    → `COLORS.primary`.
- **NOT changed:** `COLORS.food` (#FF8A3D category color), the BrandLogo orange dot/needle, `SpinScreen`
  `spinLabelActive` (wheel label, not a CTA — leave unless it visually clashes; out of scope).
- **Brand doc:** update `CLAUDE.md` "## Brand & Theme" so "orange is the one 'go' accent per screen" becomes
  "cobalt leads all CTAs; orange is reserved for the logo dot + food category, never a button."

`CTAButton`'s `go` variant definition itself is left intact (still available), so the change is purely at
call sites — no risk to other variants.

## Part B — Settings redesign (`screens/SettingsScreen.js`)

### B1. Recolor: warm ochre → neutral grey/cobalt

Map every `COLORS.goldText` in the file:
- **Field labels / eyebrows** (`fieldLabel`, `timePillLabel`, `modalTitle`) → `COLORS.textMuted` (grey form label).
- **Values** (`timePillValue`, `distanceValue`) → `COLORS.textPrimary` (prominent, neutral).
- **Inactive control text** (`modePillText`, `prefPillText`, inactive pills) → `COLORS.textSecondary`.
- **Suggestion / helper text** (`suggestionText`, `demoInfoText`, `toastText`) → `COLORS.textSecondary`.
- **Success confirmation** (`geocodeSuccess` "📍 found") → `COLORS.success` (green — semantic, not warm).
- **Demo label** (`demoLabel`) → `COLORS.textPrimary`.
- **Selected option text** (`modalOptionTextActive`) → `COLORS.primary` (cobalt active).
- **Pro plan value** (`proStatus && {color: goldText}`) → `COLORS.primary` (cobalt; no warm "premium gold").
Section headers (`SectionLabel tone="cobalt"`) and active fills (already cobalt from Task 2) are unchanged.
After this pass, `grep "COLORS.goldText" screens/SettingsScreen.js` returns nothing.

### B2. Reorder + consolidate

New top-to-bottom order (was: Demo, Profile, Subscription, Beta, Location, Food, Sensitivities, Activity,
Default Plan, App, Account):

1. **Profile** — display name, avatar
2. **Subscription** — plan, usage, Upgrade
3. **Location** — auto/manual + search
4. **Planning Preferences** — ONE consolidated block (single `SectionLabel` header) containing the former
   *Food Preferences*, *Sensitivities & Allergies*, *Activity Preferences*, and *Default Plan Preferences*
   as labeled sub-groups inside (cuisines, dietary, allergens/environmental, activity style, max distance,
   pace, budget, group, time window). This is the primary fix for "too long" — 4 sections → 1 grouped area.
   May be one large `Card` with internal dividers, or a few stacked cards under the single header — whichever
   reads cleaner; the goal is one *conceptual* section, not four.
5. **Notifications** — toggle + daily-reminder time (moved out of the old "App" grab-bag)
6. **Beta** — Beta Tester Guide link (beta testers only; unchanged gating)
7. **About & Data** — Clear History, Reset Onboarding, Terms of Service, Version
8. **Demo Mode** — moved from the very top to here; de-emphasized (it's a testing toggle)
9. **Sign Out** — account email + Sign Out at the very bottom

All existing handlers, state, modals (sign-out confirm, clear-history confirm, time picker), and AsyncStorage
keys stay exactly as-is — only JSX *order/grouping* and styles change.

### B3. Consistency pass

- One uniform card style: same `borderRadius`, `padding`, `borderWidth/Color` for every settings card
  (today `card` is radius 18 / `demoCard` differs / `locationCard` differs only by zIndex). Consolidate to a
  shared `card` style; keep `locationCard`'s `zIndex` override only (needed for the suggestions overlay).
- Consistent chip / pill / row components and spacing; even `sectionHeaderSpacing` rhythm between groups.
- Demo card loses its special heavy border treatment — same card as the rest, just lower on the page.

## Testing / verification

No RN test runner. Per task: `npx expo export --platform web` clean build. Manual reasoning that:
- no `variant="go"` or button-level `COLORS.accent` remains (Part A greps),
- no `COLORS.goldText` remains in `SettingsScreen.js` (Part B grep),
- all settings still render and save (handlers/state untouched).
Visual confirmation happens in the running app after deploy (shades/spacing tunable).

## Out of scope (deliberate)

- No new/removed settings; no behavior changes.
- No redesign of other screens (only their CTA color changes in Part A).
- No dark mode / palette overhaul. No collapsible-accordion interaction (just static grouping) unless the
  consolidated Preferences block still feels too long, which we'll judge live.
