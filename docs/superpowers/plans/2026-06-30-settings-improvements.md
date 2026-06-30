# Settings Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real app-wide dark mode (Auto/Light/Dark), reorder the Settings cards, mark Notifications "Coming Soon" + disable it, and make Subscription/Preferences/About & Data collapsible.

**Architecture:** A `ThemeProvider` exposes `{ mode, scheme, colors, setMode }`. `constants/theme.js` ships two palettes (`LIGHT`, `DARK`); every view builds its styles from the active palette via `const styles = useMemo(() => makeStyles(colors), [colors])` instead of referencing a static `COLORS` object. Settings gains an Appearance segmented control, a `Badge`, and a `CollapsibleCard`.

**Tech Stack:** Expo SDK 56, expo-router, React Native, AsyncStorage, expo-status-bar, `useColorScheme`.

## Global Constraints

- Expo SDK 56 — reference https://docs.expo.dev/versions/v56.0.0/ . Install packages with `npm install <pkg> --legacy-peer-deps`. (No new packages are required by this plan.)
- Git repo root is `decide-app/`. Run all commands from there.
- **No unit-test harness exists** (no jest). Verification per task = `npm run build` (web export) completes without error + targeted `grep` checks + manual checks via the `run` skill. There is no failing-test-first cycle; "verify" steps give the exact command and expected result.
- **Cobalt-led, no orange CTAs:** CTAs stay cobalt; orange (`accent`) is reserved for the logo dot and the food category only. Preserve this in both palettes.
- Client env vars must use the `EXPO_PUBLIC_` prefix (not relevant to this plan, but the rule stands).
- Commit after every task. End commit messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Warm-dark aesthetic: the dark palette uses warm charcoals (not cold gray); verify key text/bg pairs read at roughly WCAG AA.

---

## Conversion Recipe (referenced by Tasks 12–16)

This is the exact, uniform transform for migrating a view file from the static
`COLORS` object to the theme. Apply every step.

1. **Read the whole file first.**
2. **Imports:** ensure `useMemo` is imported from `react` (merge into the existing
   `react` import). Add `import { useTheme } from '<rel>/context/ThemeContext';`
   (`<rel>` is the correct relative path: `../../context` from `components/brand`,
   `../context` from `screens` and `app`, `../../context` from `app/auth` etc.).
   Keep importing `FONTS`, `RADII`, `SHADOWS` from `constants/theme` — those are
   theme-independent.
3. **Data-layer colors stay static.** If the file uses `COLORS.*` for *data* (e.g. a
   category→color map, not a style), keep that `COLORS` import and leave those uses
   alone. Only the *view/style* layer themes.
4. **Styles factory:** rename the module-level `const styles = StyleSheet.create({…})`
   to `const makeStyles = (c) => StyleSheet.create({…})` and replace every `COLORS.`
   *inside it* with `c.`.
5. **Per-component hook:** at the top of *each* component (including nested helper
   components defined in the same file) that uses `styles`, add:
   ```js
   const { colors } = useTheme();
   const styles = useMemo(() => makeStyles(colors), [colors]);
   ```
   Destructure `scheme` too only if the component needs it.
6. **Inline color props:** replace `COLORS.x` used directly in JSX props
   (`color=`, `trackColor`, `thumbColor`, gradient `colors={[…]}`, `placeholderTextColor`,
   etc.) with `colors.x` from the hook.
7. **Verify build:** `npm run build` → completes without error.
8. **Verify migration:** `grep -nE "COLORS\." <file>` → returns **only** data-layer
   (non-style) uses, or nothing. Any remaining style use of `COLORS.` is a miss.
9. **Manual:** open the screen in Light and in Dark (toggle in Settings → Appearance);
   confirm it recolors with no hard-coded light patches.

---

## Task 1: Split theme into LIGHT/DARK palettes

**Files:**
- Modify: `constants/theme.js`

**Interfaces:**
- Produces: `export const LIGHT` (the current palette, unchanged values), `export const DARK`, `export const PALETTES = { light: LIGHT, dark: DARK }`, and unchanged `export const COLORS = LIGHT` (back-compat for not-yet-migrated files and data-layer maps). `FONTS`, `RADII`, `SHADOWS`, `CATEGORY_COLORS`, `CATEGORY_EMOJIS`, `PRICE_LEGEND` keep their current exports.

- [ ] **Step 1: Rename current palette to `LIGHT` and add `DARK` + `PALETTES`.**

In `constants/theme.js`, change `export const COLORS = { … }` to `export const LIGHT = { … }` (keep every value exactly as-is). Immediately after it, add the dark palette and aliases:

```js
export const DARK = {
  bg:         '#15120E',
  surface:    '#211D17',
  surfaceAlt: '#2B2620',

  border:      '#3A352B',
  borderLight: '#2A3450',

  primary:     '#4A82E0',
  primaryDark: '#2E5DB0',
  primaryText: '#FFFFFF',

  accent:     '#FF9A52',
  accentDark: '#C9551F',
  accentSoft: '#3E2C1C',
  gold:       '#F4C04A',
  goldText:   '#E6B860',
  beta:       '#9B6BF0',

  sky100: '#232C3E',
  sky200: '#2E3A52',
  sky300: '#3D4D6B',

  navy: '#0C1F38',
  ink:  '#0F1828',

  textPrimary:   '#F3EEE3',
  textSecondary: '#C7C0B2',
  textMuted:     '#8B8475',

  success:   '#3FB892',
  error:     '#FF6B61',
  errorDark: '#C9483F',
  warning:   '#F4C04A',

  food:     '#FF9A52',
  activity: '#4A82E0',
  shopping: '#F4C04A',
  outdoor:  '#3FB892',

  white: '#FFFFFF',
  tabBar: '#1C1813',

  amber: '#F4C04A',
  teal:  '#4A82E0',
};

// Back-compat default: static consumers + data-layer maps resolve to light.
export const COLORS = LIGHT;
export const PALETTES = { light: LIGHT, dark: DARK };
```

Leave `FONTS`, `RADII`, `SHADOWS`, `CATEGORY_COLORS`, `CATEGORY_EMOJIS`, `PRICE_LEGEND` unchanged below.

- [ ] **Step 2: Verify build.**

Run: `npm run build`
Expected: completes without error (nothing imports `DARK`/`PALETTES` yet; `COLORS` is unchanged).

- [ ] **Step 3: Verify exports.**

Run: `grep -nE "export const (LIGHT|DARK|COLORS|PALETTES)" constants/theme.js`
Expected: four matching lines.

- [ ] **Step 4: Commit.**

```bash
git add constants/theme.js
git commit -m "Add LIGHT/DARK palettes and PALETTES map to theme"
```

---

## Task 2: Add persistence keys

**Files:**
- Modify: `services/settingsService.js`

**Interfaces:**
- Produces: `KEYS.THEME_MODE` (`'@decide/theme_mode'`), `KEYS.COLLAPSED_SECTIONS` (`'@decide/collapsed_sections'`). `loadAllSettings` is **not** changed (theme mode is owned by `ThemeContext`, collapse state by `CollapsibleCard`).

- [ ] **Step 1: Add the two keys.**

In `services/settingsService.js`, inside the `KEYS` object, add after `TOS_ACCEPTED`:

```js
  THEME_MODE:         '@decide/theme_mode',          // 'auto' | 'light' | 'dark'
  COLLAPSED_SECTIONS: '@decide/collapsed_sections',  // JSON map { [sectionKey]: boolean }
```

`loadAllSettings` already filters by an explicit allow-list of keys, so these new keys will not leak into it. Leave the rest of the file unchanged.

- [ ] **Step 2: Verify build.**

Run: `npm run build`
Expected: completes without error.

- [ ] **Step 3: Commit.**

```bash
git add services/settingsService.js
git commit -m "Add THEME_MODE and COLLAPSED_SECTIONS storage keys"
```

---

## Task 3: ThemeContext + provider

**Files:**
- Create: `context/ThemeContext.js`

**Interfaces:**
- Consumes: `PALETTES`, `LIGHT` from `constants/theme`; `KEYS` from `services/settingsService`.
- Produces: `ThemeProvider` (component) and `useTheme()` → `{ mode, scheme, colors, setMode }`. `mode` ∈ `'auto'|'light'|'dark'`; `scheme` ∈ `'light'|'dark'`; `colors` is `PALETTES[scheme]`; `setMode(next)` updates + persists. Also exports the pure helper `resolveScheme(mode, systemScheme)`.

- [ ] **Step 1: Create the context file.**

Create `context/ThemeContext.js`:

```js
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PALETTES, LIGHT } from '../constants/theme';
import { KEYS } from '../services/settingsService';

// Pure resolver: given the user's mode and the OS scheme, what do we render?
export function resolveScheme(mode, systemScheme) {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return systemScheme === 'dark' ? 'dark' : 'light'; // 'auto'
}

const ThemeContext = createContext({
  mode: 'auto',
  scheme: 'light',
  colors: LIGHT,
  setMode: () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null, live-updates
  const [mode, setModeState] = useState('auto');

  useEffect(() => {
    AsyncStorage.getItem(KEYS.THEME_MODE)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'auto') setModeState(saved);
      })
      .catch(() => {});
  }, []);

  const setMode = (next) => {
    setModeState(next);
    AsyncStorage.setItem(KEYS.THEME_MODE, next).catch(() => {});
  };

  const scheme = resolveScheme(mode, systemScheme);
  const value = useMemo(
    () => ({ mode, scheme, colors: PALETTES[scheme], setMode }),
    [mode, scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 2: Verify build.**

Run: `npm run build`
Expected: completes without error.

- [ ] **Step 3: Sanity-check the pure resolver (node).**

Run:
```bash
node -e "const m={light:'light',dark:'dark',auto_d:'dark',auto_l:'light'}; \
const f=(mode,sys)=>mode==='light'?'light':mode==='dark'?'dark':(sys==='dark'?'dark':'light'); \
console.log(f('light','dark')==='light', f('dark','light')==='dark', f('auto','dark')==='dark', f('auto','light')==='light', f('auto',null)==='light');"
```
Expected: `true true true true true` (mirrors `resolveScheme` logic).

- [ ] **Step 4: Commit.**

```bash
git add context/ThemeContext.js
git commit -m "Add ThemeContext with Auto/Light/Dark resolution and persistence"
```

---

## Task 4: Wire ThemeProvider into root layout + dynamic StatusBar

**Files:**
- Modify: `app/_layout.js`

**Interfaces:**
- Consumes: `ThemeProvider`, `useTheme` from `context/ThemeContext`.
- Produces: app tree wrapped in `ThemeProvider`; `StatusBar` style follows `scheme`; the `DemoBanner` styles theme via `makeStyles`.

- [ ] **Step 1: Wrap the tree in `ThemeProvider` and move font-loading inside it.**

In `app/_layout.js`, add the import (near the other context import):

```js
import { ThemeProvider, useTheme } from '../context/ThemeContext';
```

Replace the `export default function RootLayout() { … }` (the whole function, lines ~152–181) with:

```js
function RootLayoutBody() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <ScreenBackground variant="paper" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <BrandLogo variant="mark" size={80} />
      </ScreenBackground>
    );
  }

  return (
    <AuthProvider>
      <RootLayoutInner />
    </AuthProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootLayoutBody />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
```

(`ScreenBackground`/`BrandLogo` are now rendered inside `ThemeProvider`, so the splash themes correctly.)

- [ ] **Step 2: Make `StatusBar` follow the scheme.**

In `RootLayoutInner`, add at the top of the function body:

```js
  const { scheme } = useTheme();
```

Change `<StatusBar style="dark" />` to:

```js
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
```

- [ ] **Step 3: Theme the `DemoBanner` styles.**

Convert the module-level `const styles = StyleSheet.create({…})` (the banner styles, ~lines 183–194) to a factory and consume it in `DemoBanner`:

Rename to `const makeStyles = (c) => StyleSheet.create({ … })` and replace `COLORS.amber` → `c.amber`, `COLORS.navy` → `c.navy` inside it. Then in `DemoBanner`, add:

```js
function DemoBanner({ onDismiss }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  …unchanged JSX…
}
```

Add `useMemo` to the `react` import on line 1.

- [ ] **Step 4: Verify build + boot.**

Run: `npm run build`
Expected: completes without error.
Then via the `run` skill: launch the app; it boots to the normal screen, no crash, status bar visible.

- [ ] **Step 5: Commit.**

```bash
git add app/_layout.js
git commit -m "Wrap app in ThemeProvider; status bar + demo banner follow theme"
```

---

## Task 5: Convert shared brand components

**Files:**
- Modify: `components/brand/ScreenBackground.js`, `components/brand/Card.js`, `components/brand/SectionLabel.js`, `components/brand/GradientHeader.js`, `components/brand/CTAButton.js`, `components/brand/BrandLogo.js`

**Interfaces:**
- Consumes: `useTheme` from `context/ThemeContext`.
- Produces: same component APIs (unchanged props), now theme-aware.

- [ ] **Step 1: `ScreenBackground.js` — full replacement.**

```js
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

export default function ScreenBackground({ variant = 'paper', style, children }) {
  const { colors } = useTheme();
  if (variant === 'paper') {
    return <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{children}</View>;
  }
  if (variant === 'cream') {
    return <View style={[{ flex: 1, backgroundColor: colors.surfaceAlt }, style]}>{children}</View>;
  }
  const gradient = variant === 'brand'
    ? [colors.primary, colors.primaryDark]
    : [colors.bg, colors.sky100];
  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[{ flex: 1 }, style]}>
      {children}
    </LinearGradient>
  );
}
```

- [ ] **Step 2: `Card.js` — full replacement (adds dark hairline border in place of invisible shadow).**

```js
import { View, StyleSheet } from 'react-native';
import { RADII, SHADOWS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

export default function Card({ style, children }) {
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: colors.surface, borderRadius: RADII.md, padding: 16, ...SHADOWS.card },
        scheme === 'dark' && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}
```

- [ ] **Step 3: `SectionLabel.js` — full replacement.**

```js
import { Text } from 'react-native';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

export default function SectionLabel({ children, tone = 'muted', style }) {
  const { colors } = useTheme();
  const color = tone === 'cobalt' ? colors.primary : colors.textMuted;
  return (
    <Text style={[{ fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color }, style]}>
      {children}
    </Text>
  );
}
```

- [ ] **Step 4: `GradientHeader.js` — full replacement.**

```js
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

export default function GradientHeader({ children, style }) {
  const { colors } = useTheme();
  return (
    <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }, style]}>
      {children}
    </LinearGradient>
  );
}
```

- [ ] **Step 5: `CTAButton.js` — convert color refs.**

Add `import { useTheme } from '../../context/ThemeContext';` and remove `COLORS` from the `constants/theme` import (keep `RADII, FONTS`). At the top of `CTAButton`, add `const { colors: COLORS } = useTheme();`. (Aliasing the hook result to `COLORS` lets the rest of the function body stay byte-for-byte identical, since it already reads `COLORS.*` for `primary`, `primaryDark`, `accent`, `accentDark`, `white`, `surface`.) Verify there are no other module-level uses of `COLORS` in the file (there are none).

- [ ] **Step 6: `BrandLogo.js` — theme + dark-aware ring/word colors.**

Add `import { useTheme } from '../../context/ThemeContext';` and remove `COLORS` from the theme import (keep `FONTS`). The `Mark` helper currently reads `COLORS.accent` — change its signature to accept an `accent` prop and use it. In `BrandLogo`:

```js
export default function BrandLogo({ variant = 'full', size = 80 }) {
  const { colors, scheme } = useTheme();
  const onDark = scheme === 'dark';
  const reversed = variant === 'reversed';
  const light = reversed || onDark;          // use light ink on dark surfaces
  const ring = light ? colors.white : colors.navy;
  const needleLo = light ? colors.white : colors.primary;
  const hub = light ? colors.white : colors.navy;
  const wordColor = light ? colors.white : colors.navy;
  const wordSize = size * 0.82;

  const mark = <Mark size={size} ring={ring} needleLo={needleLo} hub={hub} accent={colors.accent} />;
  …rest unchanged, but replace the wordmark dot `color: COLORS.accent` with `color: colors.accent`…
}
```

And update `Mark`:

```js
function Mark({ size, ring, needleLo, hub, accent }) {
  …<Path d="M60 18 L50 62 L70 62 Z" fill={accent} />…   // was COLORS.accent
  …rest unchanged…
}
```

- [ ] **Step 7: Verify build + grep.**

Run: `npm run build`
Expected: completes without error.
Run: `grep -rnE "COLORS\." components/brand/`
Expected: no matches (every brand component now themes).

- [ ] **Step 8: Manual check.**

Via `run` skill: app still renders normally in light. (Dark toggle arrives in Task 9 — for now confirm no regression.)

- [ ] **Step 9: Commit.**

```bash
git add components/brand/
git commit -m "Make shared brand components theme-aware"
```

---

## Task 6: Badge component

**Files:**
- Create: `components/brand/Badge.js`

**Interfaces:**
- Consumes: `useTheme`.
- Produces: `default function Badge({ label, tone = 'muted', style })` where `tone` ∈ `'muted' | 'beta' | 'gold' | 'cobalt'`.

- [ ] **Step 1: Create `components/brand/Badge.js`.**

```js
import { View, Text } from 'react-native';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

export default function Badge({ label, tone = 'muted', style }) {
  const { colors } = useTheme();
  const toneColor = {
    muted:  colors.textMuted,
    beta:   colors.beta,
    gold:   colors.goldText,
    cobalt: colors.primary,
  }[tone] ?? colors.textMuted;

  return (
    <View
      style={[
        {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: toneColor + '55',
          backgroundColor: toneColor + '1A',
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 10, fontFamily: FONTS.monoBold, letterSpacing: 0.8, color: toneColor, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Verify build.**

Run: `npm run build`
Expected: completes without error.

- [ ] **Step 3: Commit.**

```bash
git add components/brand/Badge.js
git commit -m "Add Badge pill component"
```

---

## Task 7: CollapsibleCard component

**Files:**
- Create: `components/brand/CollapsibleCard.js`

**Interfaces:**
- Consumes: `useTheme`, `KEYS` from `services/settingsService`, `Card`, `SectionLabel`.
- Produces: `default function CollapsibleCard({ title, sectionKey, defaultCollapsed = true, children, style })`. Persists collapsed state in the `KEYS.COLLAPSED_SECTIONS` JSON map keyed by `sectionKey`.

- [ ] **Step 1: Create `components/brand/CollapsibleCard.js`.**

```js
import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FONTS, RADII, SHADOWS } from '../../constants/theme';
import { KEYS } from '../../services/settingsService';
import { useTheme } from '../../context/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

async function readMap() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.COLLAPSED_SECTIONS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function CollapsibleCard({ title, sectionKey, defaultCollapsed = true, children, style }) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, scheme), [colors, scheme]);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    readMap().then((map) => {
      if (typeof map[sectionKey] === 'boolean') setCollapsed(map[sectionKey]);
    });
  }, [sectionKey]);

  const toggle = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !collapsed;
    setCollapsed(next);
    const map = await readMap();
    map[sectionKey] = next;
    AsyncStorage.setItem(KEYS.COLLAPSED_SECTIONS, JSON.stringify(map)).catch(() => {});
  };

  return (
    <View style={style}>
      <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.7}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.chevron, !collapsed && styles.chevronOpen]}>▾</Text>
      </TouchableOpacity>
      {!collapsed && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const makeStyles = (c, scheme) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingVertical: 6, marginBottom: 10,
  },
  title: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: c.primary },
  chevron: { fontSize: 13, color: c.textMuted },
  chevronOpen: { color: c.primary },
  body: {
    backgroundColor: c.surface, borderRadius: RADII.md, padding: 16, ...SHADOWS.card,
    ...(scheme === 'dark' ? { borderWidth: StyleSheet.hairlineWidth, borderColor: c.border } : null),
  },
});
```

> Note: `CollapsibleCard` renders its own surface (the `body` style mirrors `Card`),
> so a wrapped section provides only its inner content — do **not** also wrap the
> children in a `Card`.

- [ ] **Step 2: Verify build.**

Run: `npm run build`
Expected: completes without error.

- [ ] **Step 3: Commit.**

```bash
git add components/brand/CollapsibleCard.js
git commit -m "Add CollapsibleCard with persisted collapse state"
```

---

## Task 8: Theme-convert SettingsScreen (no behavior change)

**Files:**
- Modify: `screens/SettingsScreen.js`

**Interfaces:**
- Consumes: `useTheme`.
- Produces: SettingsScreen rendering identically in light, now built from `makeStyles(colors)`. (Reorder / new cards / collapsible come in Tasks 9–11.)

- [ ] **Step 1: Apply the Conversion Recipe to the whole file.**

Follow the Conversion Recipe above. Specifics for this file:
- Add `useMemo` to the `react` import; add `import { useTheme } from '../context/ThemeContext';`. Remove `COLORS` from the `constants/theme` import (keep `FONTS`). `COLORS` is **only** used for styling here, so it can be fully removed.
- Rename the bottom `const styles = StyleSheet.create({ … })` (lines ~854–1057) to `const makeStyles = (c) => StyleSheet.create({ … })` and replace every `COLORS.` inside with `c.`. Note the concatenations like `COLORS.primary + '33'`, `COLORS.error + '22'`, `COLORS.error + '55'`, `COLORS.primary + '55'` → `c.primary + '33'`, etc.
- The four nested helper components each use `styles`, so add the hook + `useMemo` to **each**: `ChipGrid`, `PillRow`, `TimePickerPill`, `DistanceSlider`, plus the main `SettingsScreen`:
  ```js
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  ```
- Replace inline JSX color props with `colors.*`: the loader `<ActivityIndicator color={COLORS.primary}>`, the geocode `<ActivityIndicator size="small" color={COLORS.textMuted}>`, both `<Switch trackColor={{ false: COLORS.border, true: COLORS.primary }} thumbColor={… ? COLORS.primary : COLORS.textMuted}>`, every `placeholderTextColor={COLORS.textMuted}`, and inline styles like `proStatus && { color: COLORS.primary }`, `{ color: COLORS.error }`, `{ color: COLORS.primary }` on the upgrade/reset/clear rows.
- In `DistanceSlider`, which is defined before `SettingsScreen` and uses `styles`, add the same hook + `useMemo` at the top of its body (it currently has none).

- [ ] **Step 2: Verify build + grep.**

Run: `npm run build`
Expected: completes without error.
Run: `grep -nE "COLORS\." screens/SettingsScreen.js`
Expected: no matches.

- [ ] **Step 3: Manual check.**

Via `run` skill: open Settings; it looks identical to before (light), no missing colors, scroll through all sections.

- [ ] **Step 4: Commit.**

```bash
git add screens/SettingsScreen.js
git commit -m "Theme-convert SettingsScreen styles (no behavior change)"
```

---

## Task 9: Settings — Appearance card, reorder, Demo header

**Files:**
- Modify: `screens/SettingsScreen.js`

**Interfaces:**
- Consumes: `useTheme` (`mode`, `setMode`).
- Produces: an Appearance segmented control writing `mode`; sections in the approved order; Demo Mode under a `DEVELOPER` header.

- [ ] **Step 1: Pull `mode` and `setMode` from the theme hook.**

In `SettingsScreen`, change the theme hook line to:

```js
  const { colors, mode, setMode } = useTheme();
```

- [ ] **Step 2: Add the Appearance card JSX.**

Define the options near the other constants (top of file):

```js
const APPEARANCE_OPTIONS = [
  { id: 'auto',  label: 'Auto'  },
  { id: 'light', label: 'Light' },
  { id: 'dark',  label: 'Dark'  },
];
```

Add this block immediately after the Profile `</Card>` (so it's card #2):

```jsx
          {/* ── Appearance ──────────────────────────────────────────────────── */}
          <SectionLabel tone="cobalt" style={styles.sectionHeaderSpacing}>APPEARANCE</SectionLabel>
          <Card style={styles.card}>
            <Text style={styles.fieldLabel}>THEME</Text>
            <View style={styles.modeRow}>
              {APPEARANCE_OPTIONS.map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.modePill, mode === o.id && styles.modePillActive]}
                  onPress={() => setMode(o.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modePillText, mode === o.id && styles.modePillTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.demoSub, { marginTop: 10 }]}>Auto follows your device’s appearance.</Text>
          </Card>
```

(`styles.modeRow`/`modePill`/`modePillActive`/`modePillText`/`modePillTextActive` already exist and are reused.)

- [ ] **Step 3: Reorder the sections to the approved order.**

Rearrange the JSX blocks so the order is:
`Profile → Appearance → [Admin] → Preferences → Location → Notifications → Subscription → [Beta] → About & Data → Demo Mode → Account`.
Move whole `{/* ── X ── */}` blocks (label + card) intact; keep the `{isAdmin && …}` and `{isBetaTester && …}` wrappers around Admin and Beta.

- [ ] **Step 4: Give Demo Mode a section header.**

Immediately before the Demo Mode `<Card>` (the one with `demoToggleRow`), add:

```jsx
          <SectionLabel tone="cobalt" style={styles.sectionHeaderSpacing}>DEVELOPER</SectionLabel>
```

- [ ] **Step 5: Verify build + manual.**

Run: `npm run build`
Expected: completes without error.
Via `run` skill: open Settings → Appearance shows Auto/Light/Dark; tapping **Dark** recolors the entire app (every migrated screen); **Light** restores; **Auto** matches the device. Cards appear in the new order; Demo Mode sits under a DEVELOPER header.

- [ ] **Step 6: Commit.**

```bash
git add screens/SettingsScreen.js
git commit -m "Settings: Appearance control, reordered cards, Demo header"
```

---

## Task 10: Settings — Notifications "Coming Soon" + disabled

**Files:**
- Modify: `screens/SettingsScreen.js`

**Interfaces:**
- Consumes: `Badge` from `components/brand/Badge`.

- [ ] **Step 1: Import `Badge`.**

Add near the other brand imports:

```js
import Badge from '../components/brand/Badge';
```

- [ ] **Step 2: Add the badge and disable the switch.**

Replace the Notifications card body (the `appRow` with the `Notifications` label + `Switch`, and the conditional reminder block) with:

```jsx
          <Card style={styles.card}>
            <View style={styles.appRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.appRowLabel}>Notifications</Text>
                <Badge label="Coming Soon" tone="muted" />
              </View>
              <Switch
                value={false}
                disabled
                onValueChange={() => {}}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.textMuted}
                style={{ opacity: 0.5 }}
              />
            </View>
          </Card>
```

This removes the `{notifications && (…)}` reminder-time block from render. Leave `handleNotif`, `handleReminderTime`, `scheduleDailyReminder` imports/handlers in the file (inert, for later re-enable).

- [ ] **Step 3: Verify build + manual.**

Run: `npm run build`
Expected: completes without error.
Via `run` skill: Notifications row shows a "Coming Soon" badge; the switch is dimmed and does not toggle; no reminder-time row appears.

- [ ] **Step 4: Commit.**

```bash
git add screens/SettingsScreen.js
git commit -m "Settings: mark Notifications Coming Soon and disable the control"
```

---

## Task 11: Settings — collapsible Subscription / Preferences / About & Data

**Files:**
- Modify: `screens/SettingsScreen.js`

**Interfaces:**
- Consumes: `CollapsibleCard` from `components/brand/CollapsibleCard`.

- [ ] **Step 1: Import `CollapsibleCard`.**

```js
import CollapsibleCard from '../components/brand/CollapsibleCard';
```

- [ ] **Step 2: Wrap the three sections.**

For **Subscription**, **Preferences**, and **About & Data**, replace the
`<SectionLabel …>TITLE</SectionLabel>` + `<Card style={styles.card}> … </Card>`
pair with a single `CollapsibleCard` whose children are the former card's inner
content (drop the inner `<Card>` wrapper — `CollapsibleCard` provides the surface):

```jsx
          <CollapsibleCard title="SUBSCRIPTION" sectionKey="subscription" style={styles.collapsibleSpacing}>
            … former Subscription card contents …
          </CollapsibleCard>
```
```jsx
          <CollapsibleCard title="PREFERENCES" sectionKey="preferences" style={styles.collapsibleSpacing}>
            … former Preferences card contents …
          </CollapsibleCard>
```
```jsx
          <CollapsibleCard title="ABOUT & DATA" sectionKey="about" style={styles.collapsibleSpacing}>
            … former About & Data card contents …
          </CollapsibleCard>
```

Add one style to `makeStyles`: `collapsibleSpacing: { marginTop: 24 }` (matches the prior `sectionHeaderSpacing` top gap so vertical rhythm is preserved).

Leave **Location** as its existing `SectionLabel` + `<Card style={styles.locationCard}>` (its autocomplete dropdown escapes card bounds and must not be clipped by a collapser).

- [ ] **Step 3: Verify build + manual.**

Run: `npm run build`
Expected: completes without error.
Via `run` skill: Subscription, Preferences, About & Data start **collapsed** (header + chevron only); tapping a header expands it with animation; collapsing then restarting the app preserves each card's state; Location is unaffected and its search dropdown still renders.

- [ ] **Step 4: Commit.**

```bash
git add screens/SettingsScreen.js
git commit -m "Settings: make Subscription, Preferences, About collapsible"
```

---

## Task 12: Migrate tab screens

**Files:**
- Modify: `app/(tabs)/index.js`, `app/(tabs)/plan.js`, `app/(tabs)/history.js`, `app/(tabs)/_layout.js`, `screens/SpinScreen.js`

> `app/(tabs)/spin.js` and `app/(tabs)/settings.js` are 2-line re-exports — skip them.

- [ ] **Step 1: Apply the Conversion Recipe to each file.**

For `app/(tabs)/_layout.js` (the tab bar): theme the tab bar background (`colors.tabBar`), active/inactive tint (`colors.primary` / `colors.textMuted`), and any border — apply the recipe; these are usually inline options objects, so read `colors` via `useTheme()` inside the layout component and reference `colors.*` in the `screenOptions`.

- [ ] **Step 2: Verify each file.**

Run: `npm run build` → no error.
Run: `grep -rnE "COLORS\." "app/(tabs)/" screens/SpinScreen.js`
Expected: only data-layer matches, if any (otherwise none).

- [ ] **Step 3: Manual check.**

Via `run` skill: toggle Dark in Settings → Plan, Spin, History, and the tab bar all recolor correctly.

- [ ] **Step 4: Commit.**

```bash
git add "app/(tabs)/" screens/SpinScreen.js
git commit -m "Theme-convert tab screens and tab bar"
```

---

## Task 13: Migrate itinerary screen + components

**Files:**
- Modify: `app/itinerary/[id].js`, `components/itinerary/StopCard.js`, `components/itinerary/PlaceDetailModal.js`, `components/itinerary/PriceLegendModal.js`, `components/itinerary/WeatherPill.js`, `components/itinerary/ItineraryMeta.js`
- Inspect (likely data-layer only): `components/itinerary/helpers.js`

- [ ] **Step 1: Apply the Conversion Recipe to each view file.**

For `helpers.js`: open it; if its `COLORS` use is a category→color map or other data (not `StyleSheet`), **leave it static** (it resolves to `LIGHT` via the back-compat export). Only convert if it builds styles.

- [ ] **Step 2: Verify.**

Run: `npm run build` → no error.
Run: `grep -rnE "COLORS\." components/itinerary/ app/itinerary/`
Expected: only the intentional data-layer use(s) in `helpers.js`, if any.

- [ ] **Step 3: Manual check.**

Via `run` skill: open an itinerary in Dark → stop cards, weather pill, meta, and the detail/price-legend modals recolor correctly.

- [ ] **Step 4: Commit.**

```bash
git add components/itinerary/ app/itinerary/
git commit -m "Theme-convert itinerary screen and components"
```

---

## Task 14: Migrate auth + onboarding

**Files:**
- Modify: `app/auth/login.js`, `app/auth/signup.js`, `app/auth/forgot-password.js`, `app/auth/_layout.js`, `app/onboarding/index.js`, `app/onboarding/_layout.js`

- [ ] **Step 1: Apply the Conversion Recipe to each file.** (Relative path to context from `app/auth` and `app/onboarding` is `../../context/ThemeContext`.)

- [ ] **Step 2: Verify.**

Run: `npm run build` → no error.
Run: `grep -rnE "COLORS\." app/auth/ app/onboarding/`
Expected: no matches.

- [ ] **Step 3: Manual check.**

Via `run` skill: with mode forced to Dark, the login/signup/onboarding screens recolor. (Sign out to reach auth, or temporarily set `THEME_MODE` to `dark`.)

- [ ] **Step 4: Commit.**

```bash
git add app/auth/ app/onboarding/
git commit -m "Theme-convert auth and onboarding screens"
```

---

## Task 15: Migrate remaining routes

**Files:**
- Modify: `app/result.js`, `app/paywall.js`, `app/fallback.js`, `app/terms.js`, `app/beta-guide.js`, `app/admin/index.js`

- [ ] **Step 1: Apply the Conversion Recipe to each file.** (Relative path from `app/` is `../context/ThemeContext`; from `app/admin` it is `../../context/ThemeContext`.)

- [ ] **Step 2: Verify.**

Run: `npm run build` → no error.
Run: `grep -rnE "COLORS\." app/result.js app/paywall.js app/fallback.js app/terms.js app/beta-guide.js app/admin/index.js`
Expected: no matches.

- [ ] **Step 3: Manual check.**

Via `run` skill: in Dark, open Paywall, Terms, Result (after a spin), and Admin (admin account) — all recolor.

- [ ] **Step 4: Commit.**

```bash
git add app/result.js app/paywall.js app/fallback.js app/terms.js app/beta-guide.js app/admin/index.js
git commit -m "Theme-convert remaining route screens"
```

---

## Task 16: Migrate remaining components

**Files:**
- Modify: `components/BetaBanner.js`, `components/BetaFeedback.js`, `components/OfflineBanner.js`

- [ ] **Step 1: Apply the Conversion Recipe to each file.** (Relative path from `components/` is `../context/ThemeContext`.)

- [ ] **Step 2: Verify.**

Run: `npm run build` → no error.
Run: `grep -rnE "COLORS\." components/BetaBanner.js components/BetaFeedback.js components/OfflineBanner.js`
Expected: no matches.

- [ ] **Step 3: Manual check.**

Via `run` skill (beta account / offline): banners recolor in Dark.

- [ ] **Step 4: Commit.**

```bash
git add components/BetaBanner.js components/BetaFeedback.js components/OfflineBanner.js
git commit -m "Theme-convert beta/offline banner components"
```

---

## Task 17: Full verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Confirm no stray static style colors remain in the view layer.**

Run: `grep -rnE "COLORS\." app/ screens/ components/ | grep -v node_modules`
Expected: only intentional **data-layer** matches (e.g. a category map in `components/itinerary/helpers.js`). Any `StyleSheet`/JSX style match is a miss — fix it with the Conversion Recipe and re-commit under the relevant task.

- [ ] **Step 2: Build.**

Run: `npm run build`
Expected: completes without error.

- [ ] **Step 3: Manual acceptance matrix (via `run` skill).**

- [ ] Appearance → Light / Dark / Auto each switch the whole app immediately.
- [ ] In Auto, flipping the device appearance updates the app live.
- [ ] Force-quit and relaunch → theme choice persists, no flash of the wrong theme on the splash.
- [ ] Dark palette: Settings, Plan, Itinerary, Paywall text/background pairs read clearly.
- [ ] Subscription / Preferences / About & Data start collapsed; expand/collapse animates; state survives a restart.
- [ ] Location card's autocomplete dropdown still renders un-clipped.
- [ ] Notifications shows "Coming Soon"; the switch is disabled and inert.
- [ ] Card order matches: Profile → Appearance → [Admin] → Preferences → Location → Notifications → Subscription → [Beta] → About & Data → Demo (DEVELOPER) → Account.

- [ ] **Step 4: Finish the branch** per the project's finishing-a-development-branch flow (merge to main locally + push main + push branch).

---

## Notes / deviations from spec

- The spec's "dark `SHADOWS` variant" is implemented as a **hairline border on dark
  cards** (in `Card` and `CollapsibleCard`) rather than a parallel shadow object —
  same visual goal (card edges read on dark), less surface area. No separate
  `SHADOWS_DARK` export is added.
- `CTAButton` aliases the theme hook to `COLORS` locally (`const { colors: COLORS } = useTheme()`)
  so its large existing body is left untouched — a deliberate, minimal-diff choice.
