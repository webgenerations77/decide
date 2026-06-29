# Settings Redesign + Orange→Cobalt CTA Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every primary CTA cobalt (not orange) app-wide, and redesign the Settings screen (recolor warm labels to grey, reorder/consolidate sections, unify card styling).

**Architecture:** Part A is a call-site sweep (`variant="go"` → `variant="cobalt"` + a few custom orange gradients → cobalt) plus a brand-doc update. Part B is two passes on the single file `screens/SettingsScreen.js`: first a pure recolor of `goldText` → grey/cobalt, then a structural reorder/consolidation that MOVES existing JSX blocks (handlers/state untouched) and unifies card styles.

**Tech Stack:** Expo SDK 56, React Native, expo-router, `constants/theme.js` tokens, brand primitives (`CTAButton`, `Card`, `SectionLabel`).

## Global Constraints

- Expo SDK 56 — https://docs.expo.dev/versions/v56.0.0/.
- No hardcoded hex in components — only `constants/theme.js` holds literal hex.
- Never set `fontWeight` beside `fontFamily: FONTS.*`.
- User-facing copy says "Cheddar", never "AI".
- No RN test runner. Verify each task with grep checks + `npx expo export --platform web` (clean build).
- Cobalt-led: primary CTAs/active states = `COLORS.primary`; labels = neutral grey (`textMuted`/`textSecondary`); orange (`COLORS.accent`) ONLY for the BrandLogo and the `food` category color — never a button.
- Settings: NO functional changes — all handlers, state, modals, and AsyncStorage keys stay byte-identical; only JSX order/grouping and styles change.

---

### Task 1: Orange→cobalt CTA sweep + brand doc

**Files:**
- Modify: `app/auth/login.js`, `app/auth/signup.js`, `app/auth/forgot-password.js`, `app/(tabs)/plan.js`, `app/(tabs)/history.js`, `app/beta-guide.js`, `app/onboarding/index.js`, `app/paywall.js`, `screens/SpinScreen.js` (each: `variant="go"` → `variant="cobalt"`)
- Modify: `app/(tabs)/plan.js`, `app/result.js`, `app/fallback.js` (custom orange button colors → cobalt)
- Modify: `CLAUDE.md` (brand doc prose)

**Interfaces:**
- Consumes: existing `CTAButton` `cobalt` variant; `COLORS.primary`, `COLORS.primaryDark`.
- Produces: no orange primary CTAs remain anywhere.

- [ ] **Step 1: Swap every `variant="go"` to `variant="cobalt"`**

In each of these 9 files, replace `variant="go"` with `variant="cobalt"` (each file has exactly one occurrence; use replace-all to be safe):
`app/auth/login.js`, `app/auth/signup.js`, `app/auth/forgot-password.js`, `app/(tabs)/plan.js`, `app/(tabs)/history.js`, `app/beta-guide.js`, `app/onboarding/index.js`, `app/paywall.js`, `screens/SpinScreen.js`.

- [ ] **Step 2: Convert the custom orange "Navigate full day" gradient in `plan.js`**

In `app/(tabs)/plan.js`, change the navigate button gradient:
```js
              colors={[COLORS.accent, COLORS.gold]}
```
to:
```js
              colors={[COLORS.primary, COLORS.primaryDark]}
```
Then `grep -n "COLORS.accent" "app/(tabs)/plan.js"`. If any remaining `COLORS.accent` is a **button/gradient/shadow** on that navigate CTA (e.g. a `shadowColor: COLORS.accent` in the navigate button's style), change it to `COLORS.primary`. Do NOT change `CATEGORY_COLORS`/food usages (those are the orange food category semantic — they stay).

- [ ] **Step 3: Convert the orange button in `result.js`**

In `app/result.js`:
```js
            colors={[COLORS.accent, COLORS.accent]}
```
→
```js
            colors={[COLORS.primary, COLORS.primaryDark]}
```
and the button's `shadowColor: COLORS.accent` → `shadowColor: COLORS.primary`. Leave any `food`/category accent usage untouched.

- [ ] **Step 4: Convert the orange button in `fallback.js`**

In `app/fallback.js`, the action button style:
```js
    marginTop: 4, backgroundColor: COLORS.accent, borderRadius: 16,
```
→ change `backgroundColor: COLORS.accent` to `backgroundColor: COLORS.primary`; and that style's `shadowColor: COLORS.accent` → `shadowColor: COLORS.primary`. Leave any category/food accent untouched.

- [ ] **Step 5: Update the brand doc in `CLAUDE.md`**

Find (in `decide-app/CLAUDE.md`, "## Brand & Theme"):
```
Light, editorial travel system. Cobalt leads; orange is the one "go" accent per screen;
gold warms; warm cream/paper grounds. Brand kit reference: `docs/brand/`.
```
Replace with:
```
Light, editorial travel system. Cobalt leads ALL CTAs and active states; orange is reserved
for the BrandLogo dot and the food category color only (never a button); gold warms badges;
warm cream/paper grounds. Brand kit reference: `docs/brand/`.
```

- [ ] **Step 6: Verify**

Run: `cd /c/Users/webge/OneDrive/Desktop/Decide/decide-app && grep -rn 'variant="go"' app screens` → expect NO output.
Run: `npx expo export --platform web` → clean build.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: make all primary CTAs cobalt (retire orange go-buttons app-wide)"
```

---

### Task 2: Settings recolor — warm ochre → grey/cobalt

**Files:**
- Modify: `screens/SettingsScreen.js` (style values + the two inline `goldText` color usages)

**Interfaces:**
- Consumes: `COLORS.textMuted`, `COLORS.textSecondary`, `COLORS.textPrimary`, `COLORS.success`, `COLORS.primary` (all existing).
- Produces: zero `COLORS.goldText` in the file; labels read grey, active reads cobalt.

- [ ] **Step 1: Remap every `goldText` per this table**

Apply in `screens/SettingsScreen.js` (styles block + the one inline usage in the Subscription JSX). Each is a `COLORS.goldText` → new token:

| Style key / usage | New color |
|---|---|
| `fieldLabel` | `COLORS.textMuted` |
| `modePillText` (inactive mode pill) | `COLORS.textSecondary` |
| `geocodeSuccess` | `COLORS.success` |
| `suggestionText` | `COLORS.textSecondary` |
| `prefPillText` (inactive pref pill) | `COLORS.textSecondary` |
| `timePillLabel` | `COLORS.textMuted` |
| `timePillValue` | `COLORS.textPrimary` |
| `modalTitle` | `COLORS.textMuted` |
| `modalOptionTextActive` | `COLORS.primary` |
| `distanceValue` | `COLORS.textPrimary` |
| `demoLabel` | `COLORS.textPrimary` |
| `demoInfoText` | `COLORS.textSecondary` |
| `toastText` | `COLORS.textSecondary` |
| inline Pro value `proStatus && { color: COLORS.goldText }` (in the Subscription `appRowValue`) | `COLORS.primary` |

Do not change any other colors (section headers via `SectionLabel tone="cobalt"`, active fills, error/red rows stay as-is).

- [ ] **Step 2: Verify no goldText remains**

Run: `cd /c/Users/webge/OneDrive/Desktop/Decide/decide-app && grep -n "COLORS.goldText" screens/SettingsScreen.js` → expect NO output.

- [ ] **Step 3: Verify build**

Run: `npx expo export --platform web` → clean build.

- [ ] **Step 4: Commit**

```bash
git add screens/SettingsScreen.js
git commit -m "feat: recolor Settings labels from ochre to neutral grey/cobalt"
```

---

### Task 3: Settings restructure — reorder, consolidate, unify cards

**Files:**
- Modify: `screens/SettingsScreen.js` (reorder JSX section blocks; merge 4 preference sections under one header; unify card styles)

**Interfaces:**
- Consumes: existing section JSX blocks, handlers, state, modals (all preserved verbatim).
- Produces: the new section order/grouping and one uniform card style.

**INVARIANT (critical):** Do NOT alter any handler, state hook, `save(...)` call, AsyncStorage key, modal, or the inner content/props of any control. This task only MOVES existing JSX blocks and edits `styles`. After it, every toggle/chip/field still saves exactly as before.

- [ ] **Step 1: Reorder the rendered sections to this exact sequence**

The render currently emits sections in this order: Demo Mode, Profile, Subscription, Beta, Location, Food Preferences, Sensitivities & Allergies, Activity Preferences, Default Plan Preferences, App, Account. Move the existing JSX blocks (each is delimited by its `{/* ── … ── */}` comment) so the new order is:

1. **Profile** (existing Profile block)
2. **Subscription** (existing Subscription block)
3. **Location** (existing Location block)
4. **PREFERENCES** — see Step 2 (consolidates Food + Sensitivities + Activity + Default Plan)
5. **Notifications** — see Step 3 (extracted from the old "App" block)
6. **Beta** (existing Beta block — keep its `{isBetaTester && …}` gate)
7. **About & Data** — see Step 3 (remainder of the old "App" block)
8. **Demo Mode** (existing Demo Mode block, moved from top to here)
9. **Account / Sign Out** (existing Account block)

- [ ] **Step 2: Consolidate the 4 preference sections under ONE header**

Replace the four separate `<SectionLabel tone="cobalt">` headers (FOOD PREFERENCES, SENSITIVITIES & ALLERGIES, ACTIVITY PREFERENCES, DEFAULT PLAN PREFERENCES) with a SINGLE `<SectionLabel tone="cobalt" style={styles.sectionHeaderSpacing}>PREFERENCES</SectionLabel>`. Under it, keep all the existing inner controls, grouped in `Card`(s) with their existing sub-labels (the `fieldLabel` "CUISINES", "DIETARY RESTRICTIONS", "FOOD ALLERGENS", "ENVIRONMENTAL", "ACTIVITY STYLE", "MAX TRAVEL DISTANCE", "PACE", "BUDGET", "GROUP", "TIME WINDOW") acting as the sub-group dividers. Implementation: emit the existing inner JSX of the four sections inside one or two `Card`s under the single PREFERENCES header — keep every control, `ChipGrid`, `PillRow`, `DistanceSlider`, `TimePickerPill`, and the sensitivity disclaimer text exactly as they are. The goal is ONE conceptual section, not four headers.

- [ ] **Step 3: Split the old "App" block into "Notifications" + "About & Data"**

The old "App" `Card` contains: Notifications toggle (+ daily reminder row), Clear History, Reset Onboarding, Terms of Service, Version. Split into two sections:
- `<SectionLabel tone="cobalt" style={styles.sectionHeaderSpacing}>NOTIFICATIONS</SectionLabel>` + a `Card` holding the Notifications toggle and the daily-reminder time row (existing JSX).
- `<SectionLabel tone="cobalt" style={styles.sectionHeaderSpacing}>ABOUT & DATA</SectionLabel>` + a `Card` holding Clear History, Reset Onboarding, Terms of Service, Version rows (existing JSX). Keep the `appRowBorder` top-border pattern so rows still divide cleanly (the first row in each new card should NOT have `appRowBorder`).

- [ ] **Step 4: Unify card styles**

In the styles block, make every settings card use one shared `card` style. Currently `demoCard` and `locationCard` differ:
- `demoCard`: remove its special `backgroundColor: COLORS.surfaceAlt` + heavy `borderColor`/`borderWidth: 1.5` + `marginBottom`; render the Demo block with the standard `<Card style={styles.card}>` like every other section (it now sits at the bottom, de-emphasized).
- `locationCard`: keep ONLY the `zIndex: 10` (needed for the suggestions overlay) — base it on the shared `card` style, e.g. `locationCard: { ...} ` becomes the same as `card` plus `zIndex: 10`. Concretely set `locationCard` to the same `borderRadius`/`borderWidth`/`borderColor`/`padding` as `card`, with `zIndex: 10` added.
- Confirm `card` itself is `{ borderRadius: 18, borderWidth: 0.5, borderColor: COLORS.border, padding: 18, overflow: 'hidden' }` and is used by all sections.

- [ ] **Step 5: Verify structure + handlers intact**

Run: `cd /c/Users/webge/OneDrive/Desktop/Decide/decide-app && grep -nE "handleDemoToggle|handleNotif|handleClear|signOut|save\(KEYS" screens/SettingsScreen.js | wc -l` → expect the same count as before the task (all handlers still wired; the implementer should confirm none were dropped). Also `grep -c "SectionLabel" screens/SettingsScreen.js` should reflect the new header count (Profile, Subscription, Location, PREFERENCES, NOTIFICATIONS, Beta, ABOUT & DATA — Demo and Account may or may not use a SectionLabel as before).

- [ ] **Step 6: Verify build**

Run: `npx expo export --platform web` → clean build.

- [ ] **Step 7: Commit**

```bash
git add screens/SettingsScreen.js
git commit -m "feat: restructure Settings — reorder, consolidate preferences, unify cards"
```

---

## Self-Review

**Spec coverage:**
- Part A CTA sweep (9 variant="go" + plan/result/fallback custom gradients + brand doc) → Task 1. ✓
- Part B1 recolor (goldText → grey/cobalt, full table incl. Pro inline) → Task 2. ✓
- Part B2 reorder + consolidate Preferences + move Demo + split App → Task 3 Steps 1–3. ✓
- Part B3 consistency (unify card styles) → Task 3 Step 4. ✓
- "No functional changes" invariant → Task 3 INVARIANT + Step 5 handler-count check. ✓
- Verification (greps + build) → all tasks. ✓

**Placeholder scan:** No TBD/TODO. Task 1 steps 2–4 use grep-guided precise edits with the explicit "leave food/category accent" invariant (not a vague "handle edge cases" — the exact lines + the one exclusion rule are named). Task 3 is a reorganization-by-blueprint with an explicit new order and named blocks; literal 1000-line output is intentionally not reproduced because the task MOVES existing verified blocks rather than authoring new logic — the blueprint + INVARIANT define it precisely. ✓

**Type consistency:** All color tokens (`textMuted`, `textSecondary`, `textPrimary`, `success`, `primary`, `primaryDark`) exist in `constants/theme.js`. `variant="cobalt"` is an existing `CTAButton` variant. `styles.card`, `styles.sectionHeaderSpacing`, `styles.appRowBorder` are existing style keys referenced consistently. Section header strings (PREFERENCES, NOTIFICATIONS, ABOUT & DATA) are introduced in Task 3 and used only there. ✓
