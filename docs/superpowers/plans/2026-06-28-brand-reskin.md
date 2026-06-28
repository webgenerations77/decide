# Brand Re-skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Decide brand (light palette, brand fonts, compass mark, brand cards/headers/CTAs) across every screen via a reusable `components/brand/` primitives layer.

**Architecture:** A small set of presentational primitives in `components/brand/` compose `constants/theme.js` tokens (already brand-correct) + the brand fonts. Phase 1 lands the foundation (fonts loaded, SVG logo, primitives); Phase 2 applies them across screen groups. No app logic/behavior changes.

**Tech Stack:** Expo SDK 56, React Native, expo-font, @expo-google-fonts/*, react-native-svg, expo-linear-gradient (already present).

**Reference spec:** `docs/superpowers/specs/2026-06-28-brand-reskin-design.md`
**Brand source:** `docs/brand/Decide Brand Kit.dc.html`

## Global Constraints

- Expo SDK 56; install packages with `npm install <pkg> --legacy-peer-deps`.
- No hardcoded hex in components — all color from `constants/theme.js` (`COLORS`, `RADII`, `SHADOWS`). Fonts from `FONTS`.
- User-facing AI is **"Cheddar"** — never "AI".
- Do NOT change app logic, navigation, the smart engine wiring, or the itinerary stop-card **data** contract (visual styling only).
- **Verification (no unit tests — repo has no jest/RTL; JSX rules out `node --check`):** each task ends with a successful web bundle: `npx expo export --platform web` must complete without errors. The controller screenshots key screens (Expo web) at phase boundaries for the user's visual review.
- Brand tokens already in `theme.js`: `COLORS.bg`=#FCF9F4 (paper), `surface`=#FFF, `surfaceAlt`=#F6F0E6 (cream), `primary`=#2563C9 (cobalt), `primaryDark`=#1B3F86, `accent`=#FF8A3D (orange "go"), `gold`=#F4B63A, `navy`/`ink`=#102A4C/#16243B, `textPrimary`/`Secondary`/`Muted`, `sky100/200/300`, `success`/`error`/`warning`, category colors, `RADII{sm6,md10,lg24,pill999,icon42}`, `SHADOWS.card`, `FONTS{display,displayHeavy,body,bodyMedium,bodySemiBold,bodyBold,mono,monoBold}`.
- Brand intent: cobalt = lead; **orange = the one decisive "go" action per screen**; gold = warmth; cream/paper grounds; Space Mono = small tracked labels.

### Brand font family strings (from the @expo-google-fonts packages)

```
BricolageGrotesque_400Regular, _600SemiBold, _700Bold, _800ExtraBold
HankenGrotesk_400Regular, _500Medium, _600SemiBold, _700Bold
SpaceMono_400Regular, SpaceMono_700Bold
```
These match the values already in `FONTS` in `theme.js`.

---

## PHASE 1 — Foundation

### Task 1: Install and load the brand fonts

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `app/_layout.js` (the `useFonts` call, ~line 116)

**Interfaces:**
- Produces: the brand font families registered globally so `FONTS.*` strings resolve app-wide.

- [ ] **Step 1: Install the font packages**

Run:
```bash
npm install @expo-google-fonts/bricolage-grotesque @expo-google-fonts/hanken-grotesk @expo-google-fonts/space-mono --legacy-peer-deps
```
Expected: three packages added to `package.json` dependencies, no peer-dep errors that abort install.

- [ ] **Step 2: Import the brand fonts in `app/_layout.js`**

After the existing `@expo-google-fonts/playfair-display` import block (around lines 9–12), add:
```js
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';
```

- [ ] **Step 3: Register them in the `useFonts` map**

Replace the existing `useFonts({ PlayfairDisplay_700Bold, PlayfairDisplay_800ExtraBold })` call (~line 116) with:
```js
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_800ExtraBold,
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
```
(Keep the Playfair entries for now — Task 2 removes the last references, then a later step can drop them. Leaving them loaded is harmless.)

- [ ] **Step 4: Verify the bundle builds**

Run: `npx expo export --platform web`
Expected: completes without "Unable to resolve module @expo-google-fonts/..." errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app/_layout.js
git commit -m "feat(brand): install + load Bricolage/Hanken/Space Mono fonts"
```

---

### Task 2: Swap hardcoded PlayfairDisplay font strings to brand fonts

**Files:**
- Modify: `app/(tabs)/plan.js` (font-family strings)
- Modify: `app/(tabs)/history.js` (font-family strings)

**Interfaces:**
- Consumes: fonts loaded in Task 1; `FONTS` from `constants/theme.js`.
- Produces: zero `PlayfairDisplay` references remain in the app.

- [ ] **Step 1: Confirm the current references**

Run: `grep -rn "PlayfairDisplay" app --include=*.js`
Expected: matches in `app/(tabs)/plan.js` and `app/(tabs)/history.js` (display headings + `stopName`).

- [ ] **Step 2: Replace each reference**

In both files, ensure `FONTS` is imported from `constants/theme.js` (add it to the existing theme import if missing). Then replace every literal:
- `fontFamily: 'PlayfairDisplay_800ExtraBold'` → `fontFamily: FONTS.displayHeavy`
- `fontFamily: 'PlayfairDisplay_700Bold'` → `fontFamily: FONTS.display`

These are the only two Playfair variants used. `FONTS.displayHeavy` = `BricolageGrotesque_800ExtraBold`, `FONTS.display` = `BricolageGrotesque_700Bold`.

- [ ] **Step 3: Verify no references remain**

Run: `grep -rn "PlayfairDisplay" app --include=*.js`
Expected: no output.

- [ ] **Step 4: Verify the bundle builds**

Run: `npx expo export --platform web`
Expected: completes without error.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/plan.js" "app/(tabs)/history.js"
git commit -m "feat(brand): swap PlayfairDisplay refs to brand display font"
```

---

### Task 3: Install react-native-svg and build BrandLogo

**Files:**
- Modify: `package.json` (via npm install)
- Create: `components/brand/BrandLogo.js`

**Interfaces:**
- Produces: `BrandLogo` — default export. Props: `variant: 'full' | 'reversed' | 'stacked' | 'mark'` (default `'full'`), `size` (number, default 80 — the mark's height in px; wordmark scales relative to it).

- [ ] **Step 1: Install react-native-svg**

Run: `npm install react-native-svg --legacy-peer-deps`
Expected: package added, no aborting peer-dep error.

- [ ] **Step 2: Create the component**

Create `components/brand/BrandLogo.js`:
```jsx
import { View, Text } from 'react-native';
import Svg, { Circle, Line, G, Path } from 'react-native-svg';
import { COLORS, FONTS } from '../../constants/theme';

// The compass mark from the brand kit, drawn on a 120x120 viewBox.
function Mark({ size, ring, needleHi, needleLo, hub }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Circle cx="60" cy="60" r="46" stroke={ring} strokeWidth="3.5" />
      <G stroke={ring} strokeWidth="3" strokeLinecap="round">
        <Line x1="60" y1="9" x2="60" y2="19" />
        <Line x1="60" y1="101" x2="60" y2="111" />
        <Line x1="9" y1="60" x2="19" y2="60" />
        <Line x1="101" y1="60" x2="111" y2="60" />
      </G>
      <G transform="rotate(20 60 60)">
        <Path d="M60 18 L50 62 L70 62 Z" fill={COLORS.accent} />
        <Path d="M60 102 L50 62 L70 62 Z" fill={needleLo} />
        <Circle cx="60" cy="62" r="5" fill={hub} />
      </G>
    </Svg>
  );
}

export default function BrandLogo({ variant = 'full', size = 80 }) {
  const reversed = variant === 'reversed';
  const ring = reversed ? '#FFFFFF' : COLORS.navy;
  const needleLo = reversed ? '#FFFFFF' : COLORS.primary;
  const hub = reversed ? '#FFFFFF' : COLORS.navy;
  const wordColor = reversed ? '#FFFFFF' : COLORS.navy;
  const wordSize = size * 0.82;

  const mark = <Mark size={size} ring={ring} needleLo={needleLo} hub={hub} />;
  if (variant === 'mark') return mark;

  const Wordmark = (
    <Text style={{ fontFamily: FONTS.displayHeavy, fontSize: wordSize, color: wordColor, letterSpacing: -0.5, lineHeight: wordSize * 1.05 }}>
      Decide<Text style={{ color: COLORS.accent }}>.</Text>
    </Text>
  );

  if (variant === 'stacked') {
    return (
      <View style={{ alignItems: 'center', gap: 12 }}>
        {mark}
        {Wordmark}
      </View>
    );
  }
  // full (horizontal)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.28 }}>
      {mark}
      {Wordmark}
    </View>
  );
}
```

- [ ] **Step 3: Verify the bundle builds**

Run: `npx expo export --platform web`
Expected: completes without "Unable to resolve module react-native-svg".

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json components/brand/BrandLogo.js
git commit -m "feat(brand): react-native-svg + BrandLogo compass mark"
```

---

### Task 4: ScreenBackground and Card primitives

**Files:**
- Create: `components/brand/ScreenBackground.js`
- Create: `components/brand/Card.js`

**Interfaces:**
- Produces:
  - `ScreenBackground` — default export. Props: `variant: 'paper' | 'cream' | 'sky' | 'brand'` (default `'paper'`), `style`, `children`. Fills its parent (`flex: 1`).
  - `Card` — default export. Props: `style`, `children`. White surface, brand shadow, `RADII.md`.

- [ ] **Step 1: Create ScreenBackground**

Create `components/brand/ScreenBackground.js`:
```jsx
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/theme';

export default function ScreenBackground({ variant = 'paper', style, children }) {
  if (variant === 'paper') {
    return <View style={[{ flex: 1, backgroundColor: COLORS.bg }, style]}>{children}</View>;
  }
  if (variant === 'cream') {
    return <View style={[{ flex: 1, backgroundColor: COLORS.surfaceAlt }, style]}>{children}</View>;
  }
  const colors = variant === 'brand'
    ? [COLORS.primary, COLORS.primaryDark]      // cobalt brand wash
    : [COLORS.bg, COLORS.sky100];               // 'sky' wash
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[{ flex: 1 }, style]}>
      {children}
    </LinearGradient>
  );
}
```

- [ ] **Step 2: Create Card**

Create `components/brand/Card.js`:
```jsx
import { View } from 'react-native';
import { COLORS, RADII, SHADOWS } from '../../constants/theme';

export default function Card({ style, children }) {
  return (
    <View style={[{ backgroundColor: COLORS.surface, borderRadius: RADII.md, padding: 16, ...SHADOWS.card }, style]}>
      {children}
    </View>
  );
}
```

- [ ] **Step 3: Verify the bundle builds**

Run: `npx expo export --platform web`
Expected: completes without error.

- [ ] **Step 4: Commit**

```bash
git add components/brand/ScreenBackground.js components/brand/Card.js
git commit -m "feat(brand): ScreenBackground + Card primitives"
```

---

### Task 5: CTAButton primitive + GradientButton brand-font touch

**Files:**
- Create: `components/brand/CTAButton.js`
- Modify: `components/GradientButton.js` (label font only)

**Interfaces:**
- Consumes: `expo-linear-gradient` (already a dep).
- Produces: `CTAButton` — default export. Props: `title` (string), `onPress`, `variant: 'go' | 'cobalt' | 'secondary'` (default `'go'`), `disabled`, `loading`, `style`. `'go'` = orange gradient; `'cobalt'` = cobalt gradient; `'secondary'` = white/outline.

- [ ] **Step 1: Create CTAButton**

Create `components/brand/CTAButton.js`:
```jsx
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADII, FONTS } from '../../constants/theme';

export default function CTAButton({ title, onPress, variant = 'go', disabled = false, loading = false, style }) {
  const isDisabled = disabled || loading;
  const isSecondary = variant === 'secondary';
  const colors = variant === 'cobalt'
    ? [COLORS.primary, COLORS.primaryDark]
    : [COLORS.accent, '#E0662A'];            // orange "go"
  const labelColor = isSecondary ? COLORS.primary : '#FFFFFF';

  const inner = loading
    ? <ActivityIndicator color={labelColor} size="small" />
    : <Text style={{ fontFamily: FONTS.displayHeavy, fontSize: 17, color: labelColor, letterSpacing: 0.2 }}>{title}</Text>;

  const body = isSecondary ? (
    <TouchableOpacity
      onPress={onPress} disabled={isDisabled} accessibilityRole="button"
      style={[{ height: 56, borderRadius: RADII.pill, alignItems: 'center', justifyContent: 'center',
                backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.primary, opacity: isDisabled ? 0.5 : 1 }, style]}>
      {inner}
    </TouchableOpacity>
  ) : (
    <TouchableOpacity onPress={onPress} disabled={isDisabled} accessibilityRole="button" activeOpacity={0.9} style={[{ opacity: isDisabled ? 0.5 : 1 }, style]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ height: 56, borderRadius: RADII.pill, alignItems: 'center', justifyContent: 'center' }}>
        {inner}
      </LinearGradient>
    </TouchableOpacity>
  );
  return body;
}
```

- [ ] **Step 2: Brand-font the existing GradientButton label**

In `components/GradientButton.js`, the `styles.text` block currently has no `fontFamily`. Add the brand display font and import `FONTS`:
- Ensure the theme import reads `import { COLORS, FONTS } from '../constants/theme';`
- In `styles.text`, add `fontFamily: FONTS.displayHeavy,` (keep existing color/size/weight/letterSpacing).

This leaves GradientButton's cobalt gradient (already brand-correct via tokens) intact for existing call sites; screen tasks use `CTAButton` for the orange "go" action.

- [ ] **Step 3: Verify the bundle builds**

Run: `npx expo export --platform web`
Expected: completes without error.

- [ ] **Step 4: Commit**

```bash
git add components/brand/CTAButton.js components/GradientButton.js
git commit -m "feat(brand): CTAButton (orange go) + brand font on GradientButton"
```

---

### Task 6: SectionLabel and GradientHeader primitives

**Files:**
- Create: `components/brand/SectionLabel.js`
- Create: `components/brand/GradientHeader.js`

**Interfaces:**
- Produces:
  - `SectionLabel` — default export. Props: `children`, `tone: 'muted' | 'cobalt'` (default `'muted'`), `style`. Space Mono, uppercase, tracked.
  - `GradientHeader` — default export. Props: `children`, `style`. Cobalt brand-wash band.

- [ ] **Step 1: Create SectionLabel**

Create `components/brand/SectionLabel.js`:
```jsx
import { Text } from 'react-native';
import { COLORS, FONTS } from '../../constants/theme';

export default function SectionLabel({ children, tone = 'muted', style }) {
  const color = tone === 'cobalt' ? COLORS.primary : COLORS.textMuted;
  return (
    <Text style={[{ fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color }, style]}>
      {children}
    </Text>
  );
}
```

- [ ] **Step 2: Create GradientHeader**

Create `components/brand/GradientHeader.js`:
```jsx
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/theme';

export default function GradientHeader({ children, style }) {
  return (
    <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }, style]}>
      {children}
    </LinearGradient>
  );
}
```

- [ ] **Step 3: Verify the bundle builds**

Run: `npx expo export --platform web`
Expected: completes without error.

- [ ] **Step 4: Commit**

```bash
git add components/brand/SectionLabel.js components/brand/GradientHeader.js
git commit -m "feat(brand): SectionLabel + GradientHeader primitives"
```

---

## PHASE 2 — Screen application

Phase 2 tasks are **transformation tasks**, not TDD: the deliverable is each screen restyled to the brand using the Phase 1 primitives + tokens. Every task applies the same **transformation rules** below, then verifies with a web bundle, then commits. The controller screenshots the touched screens for the user after each task.

### Transformation rules (apply in every Phase 2 task)

1. **Background:** wrap the screen's root in `ScreenBackground` (`paper` default; `brand`/`sky` for hero/marketing surfaces). Remove any dark `backgroundColor` literals.
2. **Cards:** replace ad-hoc card `View`s (surface bg + radius + shadow) with `<Card>`.
3. **Primary action:** the one decisive "go" action per screen → `<CTAButton variant="go" title=... />`. Other buttons → `CTAButton variant="cobalt"|"secondary"` or existing `GradientButton`.
4. **Labels:** small uppercase/eyebrow labels → `<SectionLabel>`.
5. **Headers:** cobalt hero/header bands → `<GradientHeader>`.
6. **Fonts:** headings → `FONTS.display`/`displayHeavy`; body text → `FONTS.body` (add `fontFamily: FONTS.body` to base text styles that currently rely on the system font); mono/eyebrow → `FONTS.mono`/`monoBold`.
7. **Color:** every color from `COLORS.*` — replace any literal hex; replace white/light text that assumed a dark background with `COLORS.textPrimary`/`Secondary` (dark on light). Logos → `<BrandLogo>`.
8. **Verify:** `npx expo export --platform web` succeeds; commit.

### Task 7: Root shell + tab bar

**Files:**
- Modify: `app/_layout.js` (the `SplashScreen` component visuals + any shell chrome)
- Modify: `app/(tabs)/_layout.js` (tab bar colors/fonts)

- [ ] **Step 1:** Apply transformation rules. Tab bar: `tabBarActiveTintColor={COLORS.primary}`, inactive `COLORS.textMuted`, `tabBarStyle` background `COLORS.tabBar` (white) with a top border `COLORS.border`; tab label font `FONTS.bodyMedium`. SplashScreen: `ScreenBackground variant="paper"` + `<BrandLogo variant="stacked" />` + a `SectionLabel` tagline ("Tap · Pack · Go").
- [ ] **Step 2:** Run `npx expo export --platform web` — expect success.
- [ ] **Step 3:** Commit: `git add "app/_layout.js" "app/(tabs)/_layout.js" && git commit -m "feat(brand): re-skin root shell + tab bar"`

### Task 8: Decide screen (`app/(tabs)/plan.js`)

**Files:**
- Modify: `app/(tabs)/plan.js`

- [ ] **Step 1:** Apply transformation rules across all three views (landing → configuring → itinerary). The primary "Decide"/generate action → `<CTAButton variant="go">`. The `tripNoteInput` (added in the engine work) already uses tokens — leave its data wiring untouched, restyle only. Do NOT alter the itinerary stop-card data contract or the smart-engine call. The live-data indicator line stays. Headings → brand fonts (already swapped in Task 2; verify cards/buttons/labels now use primitives).
- [ ] **Step 2:** Run `npx expo export --platform web` — expect success.
- [ ] **Step 3:** Commit: `git add "app/(tabs)/plan.js" && git commit -m "feat(brand): re-skin Decide screen"`

### Task 9: Spin + home (`app/(tabs)/index.js`, `app/(tabs)/spin.js`, `screens/SpinScreen.js`)

**Files:**
- Modify: `app/(tabs)/index.js`, `app/(tabs)/spin.js`, `screens/SpinScreen.js`

- [ ] **Step 1:** Apply transformation rules. The spin wheel's segment colors should draw from `COLORS` (category colors / cobalt / orange / gold) — replace any literal hex. Primary spin action → `CTAButton variant="go"`.
- [ ] **Step 2:** Run `npx expo export --platform web` — expect success.
- [ ] **Step 3:** Commit: `git add "app/(tabs)/index.js" "app/(tabs)/spin.js" screens/SpinScreen.js && git commit -m "feat(brand): re-skin home + spin"`

### Task 10: History + settings (`app/(tabs)/history.js`, `app/(tabs)/settings.js`, `screens/SettingsScreen.js`)

**Files:**
- Modify: `app/(tabs)/history.js`, `app/(tabs)/settings.js`, `screens/SettingsScreen.js`

- [ ] **Step 1:** Apply transformation rules. History/list rows → `<Card>`. Settings section headers → `<SectionLabel>`. Headings already brand-font (Task 2 covered history.js); verify.
- [ ] **Step 2:** Run `npx expo export --platform web` — expect success.
- [ ] **Step 3:** Commit: `git add "app/(tabs)/history.js" "app/(tabs)/settings.js" screens/SettingsScreen.js && git commit -m "feat(brand): re-skin history + settings"`

### Task 11: Auth (`app/auth/*`)

**Files:**
- Modify: `app/auth/_layout.js`, `app/auth/login.js`, `app/auth/signup.js`, `app/auth/forgot-password.js`

- [ ] **Step 1:** Apply transformation rules. Auth hero → `<BrandLogo variant="stacked" />` on `ScreenBackground variant="paper"` (or `brand` wash for the top). Inputs use `COLORS.surface`/`border`/`textPrimary`. Primary submit → `CTAButton variant="go"`; Google/secondary → `CTAButton variant="secondary"`.
- [ ] **Step 2:** Run `npx expo export --platform web` — expect success.
- [ ] **Step 3:** Commit: `git add app/auth && git commit -m "feat(brand): re-skin auth screens"`

### Task 12: Onboarding + paywall (`app/onboarding/index.js`, `app/paywall.js`)

**Files:**
- Modify: `app/onboarding/index.js`, `app/onboarding/_layout.js`, `app/paywall.js`

- [ ] **Step 1:** Apply transformation rules. Onboarding/paywall are marketing surfaces — use `GradientHeader`/`ScreenBackground variant="brand"` for hero bands, `Card` for feature/price tiles, `CTAButton variant="go"` for the commit action, `SectionLabel` eyebrows. Keep "Cheddar" voice in copy.
- [ ] **Step 2:** Run `npx expo export --platform web` — expect success.
- [ ] **Step 3:** Commit: `git add app/onboarding app/paywall.js && git commit -m "feat(brand): re-skin onboarding + paywall"`

### Task 13: Result + terms + fallback (`app/result.js`, `app/terms.js`, `app/fallback.js`)

**Files:**
- Modify: `app/result.js`, `app/terms.js`, `app/fallback.js`

- [ ] **Step 1:** Apply transformation rules. `result.js` (itinerary result) → `Card` per stop section, brand fonts, `ScreenBackground`; keep stop data contract intact. `terms.js`/`fallback.js` → paper background, brand body font, `SectionLabel` headings.
- [ ] **Step 2:** Run `npx expo export --platform web` — expect success.
- [ ] **Step 3:** Commit: `git add app/result.js app/terms.js app/fallback.js && git commit -m "feat(brand): re-skin result + terms + fallback"`

### Task 14: Shared components + final sweep

**Files:**
- Modify: `components/OfflineBanner.js`, `components/SkeletonCard.js`

- [ ] **Step 1:** Apply transformation rules to the two shared components (OfflineBanner: brand colors + body font; SkeletonCard: `COLORS.surfaceAlt`/`sky100` shimmer, `RADII.md`).
- [ ] **Step 2: Final regression sweep.** Run `grep -rnoE "#[0-9A-Fa-f]{6}" app components screens --include=*.js | grep -v "constants/theme"` — expect **no** stray literal hexes (any remaining are findings to fix). Run `grep -rn "PlayfairDisplay" app components screens --include=*.js` — expect none.
- [ ] **Step 3:** Run `npx expo export --platform web` — expect a clean full-app bundle.
- [ ] **Step 4:** Commit: `git add components/OfflineBanner.js components/SkeletonCard.js && git commit -m "feat(brand): re-skin shared components + final sweep"`

---

## Self-Review

- **Spec coverage:** primitives layer (T3–T6: BrandLogo, ScreenBackground, Card, CTAButton, SectionLabel, GradientHeader); fonts install+load (T1) + PlayfairDisplay swap (T2); SVG logo (T3); full-sweep screen application grouped (T7–T14); GradientButton reconciliation (T5 — kept as brand-cobalt, CTAButton adds orange go); migration concerns — white-on-dark + hardcoded hex caught by transformation rule 7 and the T14 final grep sweep; verification = `npx expo export` per task + controller screenshots (Global Constraints). All spec sections covered.
- **Placeholder scan:** Phase 1 tasks carry complete component code. Phase 2 tasks are transformation tasks (visual re-skin of existing files) governed by the explicit Transformation Rules + primitive APIs — not TDD, per the approved verification decision; this is intentional, not a placeholder gap. No "TBD"/"similar to Task N".
- **Type/name consistency:** primitive names + props are consistent between their Phase 1 definitions and the Phase 2 usage references (`ScreenBackground variant`, `Card`, `CTAButton variant:'go'|'cobalt'|'secondary'`, `SectionLabel tone`, `GradientHeader`, `BrandLogo variant`). `FONTS`/`COLORS`/`RADII`/`SHADOWS` keys match `theme.js`.
- **Note for executor:** Phase 2 verification is a web bundle + visual review, not unit tests. Run `npx expo export --platform web` from the repo root; it is the same build Vercel uses, so it is authoritative for resolve/JSX/font errors. The controller drives Expo web to screenshot key screens for the user between phases.
