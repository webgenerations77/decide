# Settings Improvements — Design

**Date:** 2026-06-30
**Status:** Approved (pending written-spec review)

## Summary

Four improvements to the Settings page, one of which (dark mode) becomes an
app-wide theming refactor:

1. **Real dark mode** — Auto / Light / Dark, app-wide, persisted.
2. **Reorder** the Settings cards.
3. **"Coming Soon"** label on Notifications + disable the (currently working) control.
4. **Collapsible** cards for Subscription, Preferences, and About & Data.

The first item is the bulk of the work. The audit found that `COLORS` is a static
object and `StyleSheet.create()` snapshots its hex values at module-load time, so a
runtime toggle cannot recolor styles that already exist. Every view that should theme
must instead **build its styles from the active palette**. This design introduces a
theme context and converts the whole app to consume it.

## Decisions (locked)

| Question | Decision |
|---|---|
| Dark mode trigger | **Auto / Light / Dark** — follows the device in Auto, manual override available |
| Dark mode rollout scope | **Whole app now** |
| Notifications "Coming Soon" | Label **and** disable the switch (logic stays in code, inert) |
| Collapsible cards | Subscription, Preferences, About & Data |
| Collapsible default + memory | **Start collapsed, remember state** (per-card persistence) |
| Card order | Profile → Appearance → Preferences → Location → Notifications → Subscription → About & Data → Demo Mode → Account (Admin\* and Beta\* stay conditional) |

---

## 1. Theming architecture

### 1.1 `context/ThemeContext.js` (new)

`ThemeProvider` wraps the app in `app/_layout.js` (outside/above the existing
providers so all screens see it). It exposes:

```js
useTheme() → { mode, scheme, colors, setMode }
```

- `mode`: `'auto' | 'light' | 'dark'` — the user's preference.
- `scheme`: resolved `'light' | 'dark'` — what is actually rendered. In `'auto'`
  this tracks `useColorScheme()` and live-updates when the OS appearance flips.
- `colors`: the resolved palette object (`LIGHT` or `DARK`).
- `setMode(next)`: updates state and persists to `THEME_MODE` via `settingsService`.

On boot the provider reads the saved `THEME_MODE` (default `'auto'`) before first
paint to avoid a flash of the wrong theme.

### 1.2 `constants/theme.js` changes

- Split the current `COLORS` into two palettes: **`LIGHT`** (today's exact values,
  unchanged) and a new **`DARK`** (see §1.5).
- Keep `export const COLORS = LIGHT` for **data-layer** color references that are
  brand-fixed and do not theme (e.g. category→color maps consumed by
  `components/itinerary/helpers.js` and `services/demoData.js`). Only the **view
  layer** themes.
- `FONTS` and `RADII` are theme-independent (unchanged).
- Add a **`SHADOWS_DARK`** variant — drop shadows are nearly invisible on dark, so
  dark cards lean on a hairline `border` instead of elevation. `makeStyles` picks the
  right shadow set from the active scheme.

### 1.3 Consumption pattern (the mechanical transform)

Every themed view changes from module-level static styles:

```js
// before
const styles = StyleSheet.create({ card: { backgroundColor: COLORS.surface }});
```

to in-component styles derived from the active palette:

```js
// after
export default function Screen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  ...
}
const makeStyles = (c) => StyleSheet.create({ card: { backgroundColor: c.surface }});
```

Color props passed inline (e.g. `<ActivityIndicator color={COLORS.primary}>`,
`trackColor`, gradient `colors`) switch to `colors.*` from the hook.

The app's `StatusBar` bar style flips with `scheme` (`'dark'` content on light,
`'light'` content on dark).

### 1.4 Migration inventory (whole-app — ~34 source files)

Each file is the same transform; these are independent and parallelizable.

**Shared brand components (do first — everything depends on them):**
`components/brand/`: ScreenBackground, Card, SectionLabel, GradientHeader,
CTAButton, BrandLogo.

**Other components:**
`components/itinerary/`: StopCard, PlaceDetailModal, PriceLegendModal, WeatherPill,
ItineraryMeta (and `helpers.js` only if it does view styling — its category color map
stays static). `components/`: BetaBanner, BetaFeedback, OfflineBanner.

**Routes / layouts:**
`app/_layout.js` (also hosts `ThemeProvider`), `app/(tabs)/_layout.js`,
`app/(tabs)/index.js`, `app/(tabs)/plan.js`, `app/(tabs)/history.js`,
`screens/SettingsScreen.js`, `screens/SpinScreen.js`, `app/itinerary/[id].js`,
`app/result.js`, `app/paywall.js`, `app/fallback.js`, `app/terms.js`,
`app/beta-guide.js`, `app/admin/index.js`, `app/auth/{login,signup,forgot-password,_layout}.js`,
`app/onboarding/{index,_layout}.js`.

> Note: the exact file set is whatever currently imports `COLORS` for styling; the
> implementer should re-grep `COLORS` at execution time to confirm nothing was missed.

### 1.5 Dark palette

Warm dark, not cold gray — preserves the brand's coziness. Cobalt is lifted for AA
contrast on dark surfaces; orange/gold accents are retained; text is warm off-white.
Values below are the design target; the implementer must verify text/background pairs
meet **WCAG AA (≥4.5:1 body, ≥3:1 large)** and adjust if a pair falls short.

| Token | Light | Dark (target) |
|---|---|---|
| `bg` | `#F6EEDF` | `#15120E` |
| `surface` | `#FFFFFF` | `#211D17` |
| `surfaceAlt` | `#ECE3D1` | `#2B2620` |
| `border` | `#E4D9C4` | `#3A352B` |
| `borderLight` | `#E6EDFB` | `#2A3450` |
| `primary` | `#2563C9` | `#4A82E0` |
| `primaryDark` | `#1B3F86` | `#2E5DB0` |
| `primaryText` | `#FFFFFF` | `#FFFFFF` |
| `accent` | `#FF8A3D` | `#FF9A52` |
| `accentDark` | `#E0662A` | `#C9551F` |
| `accentSoft` | `#FFD9B8` | `#3E2C1C` |
| `gold` | `#F4B63A` | `#F4C04A` |
| `goldText` | `#8C6010` | `#E6B860` |
| `beta` | `#7C3AED` | `#9B6BF0` |
| `sky100` | `#E6EDFB` | `#232C3E` |
| `sky200` | `#C9D8F4` | `#2E3A52` |
| `sky300` | `#9DB8E8` | `#3D4D6B` |
| `navy` | `#102A4C` | `#0C1F38` |
| `ink` | `#16243B` | `#0F1828` |
| `textPrimary` | `#16243B` | `#F3EEE3` |
| `textSecondary` | `#2C3E5C` | `#C7C0B2` |
| `textMuted` | `#7E8BA3` | `#8B8475` |
| `success` | `#2E9E7B` | `#3FB892` |
| `error` | `#D6453C` | `#FF6B61` |
| `errorDark` | `#A8362E` | `#C9483F` |
| `warning` | `#F4B63A` | `#F4C04A` |
| `food` | `#FF8A3D` | `#FF9A52` |
| `activity` | `#2563C9` | `#4A82E0` |
| `shopping` | `#F4B63A` | `#F4C04A` |
| `outdoor` | `#2E9E7B` | `#3FB892` |
| `white` | `#FFFFFF` | `#FFFFFF` (utility — stays pure white) |
| `tabBar` | `#FFFFFF` | `#1C1813` |
| `amber` (alias) | `#F4B63A` | `#F4C04A` |
| `teal` (alias) | `#2563C9` | `#4A82E0` |

---

## 2. Settings screen changes

### 2.1 Card order

```
Profile
Appearance          ← new
[Admin]*            (conditional: isAdmin)
Preferences         ← collapsible
Location
Notifications       ← "Coming Soon" + disabled
Subscription        ← collapsible
[Beta]*             (conditional: isBetaTester)
About & Data        ← collapsible
Demo Mode           ← gains a DEVELOPER section header
Account
```

### 2.2 Appearance card (new)

A labeled card (`SectionLabel` "APPEARANCE") containing a three-way segmented control
styled like the existing `modePill` row: **Auto · Light · Dark**. Selecting an option
calls `useTheme().setMode(...)`. The active segment reflects `mode` (not `scheme`), so
"Auto" stays highlighted even while the OS resolves it to light/dark.

### 2.3 Notifications — Coming Soon + disabled

- New reusable **`components/brand/Badge.js`** — a small pill: `{ label, tone }`
  (tones map to theme tokens, e.g. `muted`/`beta`/`gold`). Used here as a
  "Coming Soon" badge beside the Notifications row label.
- The `Switch` gets `disabled` and dimmed styling; it no longer fires `handleNotif`.
- The daily-reminder time-picker row is hidden while disabled.
- `handleNotif`, `scheduleDailyReminder`, etc. remain in the file, inert, for later
  re-enablement.

### 2.4 Collapsible cards

- New reusable **`components/brand/CollapsibleCard.js`**:
  - Props: `{ title, sectionKey, defaultCollapsed = true, children, style }`.
  - Renders a themed header row — `SectionLabel`-styled title + a chevron that rotates
    on toggle — above a `Card` body.
  - Animates open/close with `LayoutAnimation` (calls
    `UIManager.setLayoutAnimationEnabledExperimental(true)` on Android).
  - Reads/writes its collapsed state in the shared `@decide/collapsed_sections` map
    keyed by `sectionKey`; falls back to `defaultCollapsed` when absent.
- Subscription, Preferences, About & Data are wrapped in `<CollapsibleCard>` and
  **start collapsed**.
- **Location stays a plain `Card`** — its autocomplete `suggestionsOverlay` is
  absolutely positioned and escapes the card bounds, so it must not be wrapped in an
  overflow-clipping collapser.

---

## 3. Persistence (`services/settingsService.js`)

Add two keys:

- `THEME_MODE` → `@decide/theme_mode` — `'auto' | 'light' | 'dark'` (default `'auto'`).
  Managed by `ThemeContext`, not by `SettingsScreen.loadAllSettings`, to keep one owner.
- `COLLAPSED_SECTIONS` → `@decide/collapsed_sections` — JSON map, e.g.
  `{ subscription: true, preferences: true, about: true }`. Managed by `CollapsibleCard`.

---

## 4. Verification

RN unit-test coverage here is thin; verification is primarily manual via the `run`
skill:

- [ ] Toggle Auto / Light / Dark — every screen recolors immediately.
- [ ] In Auto, flipping the OS appearance updates the app live.
- [ ] Theme choice survives an app restart (no flash of wrong theme on boot).
- [ ] Dark palette: spot-check key text/background pairs read clearly (AA).
- [ ] Subscription / Preferences / About collapse + expand; state persists across restart.
- [ ] Location card's autocomplete dropdown still renders un-clipped.
- [ ] Notifications shows the "Coming Soon" badge; the switch is visibly disabled and inert.
- [ ] Reordered cards appear in the approved order; Demo Mode has a DEVELOPER header.

---

## Out of scope

- Re-enabling Notifications (deliberately disabled here).
- Per-screen dark-mode visual polish beyond correct token mapping (palette is global;
  one-off tuning can follow if a specific screen looks off).
- Any new Settings features beyond the four listed.
