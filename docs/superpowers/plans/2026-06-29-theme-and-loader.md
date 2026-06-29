# Theme Consistency + Darker Paper + Lottie Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Settings/History cobalt-led like the rest of the app, subtly darken the global paper background, and replace the post-"Build my day" skeleton loader with the Lottie animation in `assets/loading.json`.

**Architecture:** Background + card-pop come from three single-token edits in `constants/theme.js` (all consumers update automatically). The cobalt-led fix is a set of targeted style-key edits in `SettingsScreen.js` (gold fills → cobalt) plus a light pass on `history.js`. The loader is a small new `LoadingAnimation` component wrapping `LottieView`, swapped into `plan.js` in place of the skeleton block.

**Tech Stack:** Expo SDK 56, React Native 0.85, expo-router, `lottie-react-native` (new), `constants/theme.js` design tokens, brand primitives (`SectionLabel`).

## Global Constraints

- Expo SDK 56 — reference https://docs.expo.dev/versions/v56.0.0/ before writing app code.
- All npm installs use `--legacy-peer-deps`. New dependency this plan: `lottie-react-native` (install via `npx expo install` so the SDK-56-compatible version is chosen).
- No hardcoded hex in components — all colors come from `constants/theme.js`. (Token *values* live in theme.js; that's the only place literal hex is allowed.)
- Never set `fontWeight` beside `fontFamily: FONTS.*` — pick the matching FONTS.* variant.
- User-facing strings say "Cheddar", never "AI".
- No RN test runner exists. Verification = `npx expo export --platform web` clean build (also confirms the Lottie dep + `require('../assets/loading.json')` resolve).
- Cobalt-led principle: gold *fills / active states* → `COLORS.primary`; warm eyebrow/label *text* (`COLORS.goldText`) STAYS; text on a cobalt fill → `COLORS.primaryText`.
- Token ladder must stay light→dark: `surface #FFFFFF` › `bg #F6EEDF` › `surfaceAlt #ECE3D1` › `border #E4D9C4`.

---

### Task 1: Darken the paper tokens (`constants/theme.js`)

**Files:**
- Modify: `constants/theme.js` (3 token values)

**Interfaces:**
- Consumes: nothing.
- Produces: updated `COLORS.bg`, `COLORS.surfaceAlt`, `COLORS.border` — used app-wide via the token system.

- [ ] **Step 1: Edit `bg`**

Change:
```js
  bg:         '#FCF9F4',   // paper — default screen background
```
to:
```js
  bg:         '#F6EEDF',   // paper — default screen background (subtly darker so white cards pop)
```

- [ ] **Step 2: Edit `surfaceAlt`**

Change:
```js
  surfaceAlt: '#F6F0E6',   // cream — secondary surface / grouped sections
```
to:
```js
  surfaceAlt: '#ECE3D1',   // cream — secondary surface / grouped sections (stepped below the darker paper)
```

- [ ] **Step 3: Edit `border`**

Change:
```js
  border:      '#ECE2CF',  // warm hairline
```
to:
```js
  border:      '#E4D9C4',  // warm hairline (harmonized for darker paper)
```

- [ ] **Step 4: Verify build**

Run: `cd /c/Users/webge/OneDrive/Desktop/Decide/decide-app && npx expo export --platform web`
Expected: clean build, no errors. (Generous timeout, e.g. 300000 ms.)

- [ ] **Step 5: Commit**

```bash
git add constants/theme.js
git commit -m "feat: subtly darker paper background + harmonized cream/border tokens"
```

---

### Task 2: Cobalt-led fix for Settings (`screens/SettingsScreen.js`)

**Files:**
- Modify: `screens/SettingsScreen.js` (one inline `ActivityIndicator`, two `Switch` blocks, and ~11 style keys)

**Interfaces:**
- Consumes: `COLORS.primary`, `COLORS.primaryText` (existing theme tokens).
- Produces: Settings active/selected states render cobalt; warm label text unchanged.

**Note:** Every edit below replaces `COLORS.amber` (or `COLORS.bg` text-on-active) with the cobalt equivalent. Do NOT touch any `COLORS.goldText` usage or `demoLabel`/`demoInfoText`/`demoSub` colors — those are intentional warm text.

- [ ] **Step 1: Loading `ActivityIndicator` → cobalt**

Change (in the `if (!loaded)` block):
```js
          <ActivityIndicator color={COLORS.amber} size="large" />
```
to:
```js
          <ActivityIndicator color={COLORS.primary} size="large" />
```

- [ ] **Step 2: Demo Mode `Switch` → cobalt**

Change:
```js
              <Switch
                value={demoMode}
                onValueChange={handleDemoToggle}
                trackColor={{ false: COLORS.border, true: COLORS.amber }}
                thumbColor={demoMode ? COLORS.amber : COLORS.textMuted}
              />
```
to:
```js
              <Switch
                value={demoMode}
                onValueChange={handleDemoToggle}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={demoMode ? COLORS.primary : COLORS.textMuted}
              />
```

- [ ] **Step 3: Notifications `Switch` → cobalt**

Change:
```js
              <Switch
                value={notifications}
                onValueChange={handleNotif}
                trackColor={{ false: COLORS.border, true: COLORS.amber }}
                thumbColor={notifications ? COLORS.amber : COLORS.textMuted}
              />
```
to:
```js
              <Switch
                value={notifications}
                onValueChange={handleNotif}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={notifications ? COLORS.primary : COLORS.textMuted}
              />
```

- [ ] **Step 4: Edit the style block — gold fills → cobalt, text-on-active → white**

Apply these exact replacements in the `StyleSheet.create({...})` block:

`avatarPillActive`:
```js
  avatarPillActive: { backgroundColor: COLORS.amber, borderColor: COLORS.amber },
```
→
```js
  avatarPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
```

`modePillActive`:
```js
  modePillActive:     { backgroundColor: COLORS.amber, borderColor: COLORS.amber },
```
→
```js
  modePillActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
```

`modePillTextActive`:
```js
  modePillTextActive: { color: COLORS.bg },
```
→
```js
  modePillTextActive: { color: COLORS.primaryText },
```

`chipActive`:
```js
  chipActive:     { backgroundColor: COLORS.amber, borderColor: COLORS.amber },
```
→
```js
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
```

`chipTextActive`:
```js
  chipTextActive: { color: COLORS.bg, fontFamily: FONTS.bodySemiBold },
```
→
```js
  chipTextActive: { color: COLORS.primaryText, fontFamily: FONTS.bodySemiBold },
```

`sliderFill`:
```js
  sliderFill: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    backgroundColor: COLORS.amber, borderRadius: 2,
  },
```
→
```js
  sliderFill: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    backgroundColor: COLORS.primary, borderRadius: 2,
  },
```

`sliderThumb`:
```js
  sliderThumb: {
    position: 'absolute', top: -12,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.amber, borderWidth: 2, borderColor: COLORS.surface,
  },
```
→
```js
  sliderThumb: {
    position: 'absolute', top: -12,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.surface,
  },
```

`demoCard` (border only):
```js
  demoCard: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: 18,
    borderWidth: 1.5, borderColor: COLORS.amber + '44',
    padding: 18, marginBottom: 8,
  },
```
→
```js
  demoCard: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: 18,
    borderWidth: 1.5, borderColor: COLORS.primary + '44',
    padding: 18, marginBottom: 8,
  },
```

`demoDot`:
```js
  demoDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.amber,
  },
```
→
```js
  demoDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
```

`demoInfoCard` (border only):
```js
  demoInfoCard: {
    marginTop: 14, backgroundColor: COLORS.surface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.amber + '33', padding: 12,
  },
```
→
```js
  demoInfoCard: {
    marginTop: 14, backgroundColor: COLORS.surface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.primary + '33', padding: 12,
  },
```

`toast` (border + shadow):
```js
  toast: {
    position: 'absolute', bottom: 32, left: 20, right: 20,
    backgroundColor: COLORS.surfaceAlt, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.amber + '55',
    paddingVertical: 12, paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: COLORS.amber, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
```
→
```js
  toast: {
    position: 'absolute', bottom: 32, left: 20, right: 20,
    backgroundColor: COLORS.surfaceAlt, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.primary + '55',
    paddingVertical: 12, paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
```

- [ ] **Step 5: Confirm no `COLORS.amber` remains in the file**

Run: `cd /c/Users/webge/OneDrive/Desktop/Decide/decide-app && grep -n "COLORS.amber" screens/SettingsScreen.js`
Expected: no output (all amber usages converted). `COLORS.goldText` usages SHOULD still be present — that's correct.

- [ ] **Step 6: Verify build**

Run: `npx expo export --platform web`
Expected: clean build.

- [ ] **Step 7: Commit**

```bash
git add screens/SettingsScreen.js
git commit -m "feat: make Settings cobalt-led (gold fills/toggles/slider -> cobalt)"
```

---

### Task 3: History light alignment pass (`app/(tabs)/history.js`)

**Files:**
- Modify: `app/(tabs)/history.js` (one fallback token, one style color)

**Interfaces:**
- Consumes: `COLORS.primary`, `COLORS.textSecondary`.
- Produces: History reads cobalt-led; warm accents preserved.

- [ ] **Step 1: `DecisionCard` category fallback `teal` → `primary`**

Change:
```js
  const color    = CATEGORY_COLORS[item.category] ?? COLORS.teal;
```
to:
```js
  const color    = CATEGORY_COLORS[item.category] ?? COLORS.primary;
```

- [ ] **Step 2: Inactive filter-pill text → `textSecondary`**

Change:
```js
  filterPillTxt:       { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.goldText },
```
to:
```js
  filterPillTxt:       { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.textSecondary },
```

- [ ] **Step 3: Confirm no `COLORS.teal` remains**

Run: `cd /c/Users/webge/OneDrive/Desktop/Decide/decide-app && grep -n "COLORS.teal" app/'(tabs)'/history.js`
Expected: no output. (`COLORS.goldText` may still appear for `itinCity`/`prefPillTxt` — that's intentional.)

- [ ] **Step 4: Verify build**

Run: `npx expo export --platform web`
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/history.js"
git commit -m "feat: align History to cobalt-led theme (teal alias + inactive filter text)"
```

---

### Task 4: Lottie loading animation (`components/LoadingAnimation.js` + `plan.js`)

**Files:**
- Create: `components/LoadingAnimation.js`
- Modify: `app/(tabs)/plan.js` (imports + the `{loading && …}` block; possibly the now-unused `skeletonSection` style)
- Delete: `components/SkeletonCard.js`
- Modify: `package.json` / `package-lock.json` (via `expo install`)
- Asset (already present): `assets/loading.json`

**Interfaces:**
- Consumes: `lottie-react-native` `LottieView`, `components/brand/SectionLabel`, `assets/loading.json`.
- Produces: `<LoadingAnimation />` default export (optional `label` prop, defaults to `'Building your day…'`).

- [ ] **Step 1: Install `lottie-react-native`**

Run: `cd /c/Users/webge/OneDrive/Desktop/Decide/decide-app && npx expo install lottie-react-native`
Expected: installs the SDK-56-compatible version, updates `package.json`. If a peer-dep error appears, re-run as `npm install lottie-react-native --legacy-peer-deps` and let `expo install` have pinned the version line.
Confirm: `grep lottie-react-native package.json` shows the dependency.

- [ ] **Step 2: Create `components/LoadingAnimation.js`**

```js
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import SectionLabel from './brand/SectionLabel';

// Post-"Build my day" loading state — Lottie animation + cobalt status label.
export default function LoadingAnimation({ label = 'Building your day…' }) {
  return (
    <View style={styles.wrap}>
      <LottieView
        source={require('../assets/loading.json')}
        autoPlay
        loop
        style={styles.lottie}
      />
      <SectionLabel tone="cobalt" style={styles.label}>{label}</SectionLabel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  lottie: { width: 160, height: 160 },
  label:  { marginTop: 12, textAlign: 'center' },
});
```

- [ ] **Step 3: Swap the skeleton block in `plan.js` for `<LoadingAnimation />`**

Change:
```js
            {loading && (
              <View style={styles.skeletonSection}>
                <SectionLabel tone="cobalt" style={{ marginBottom: 20, textAlign: 'center' }}>Building your day…</SectionLabel>
                <SkeletonStopCard delay={0} />
                <SkeletonStopCard delay={180} />
                <SkeletonStopCard delay={360} />
              </View>
            )}
```
to:
```js
            {loading && <LoadingAnimation />}
```

- [ ] **Step 4: Fix imports in `plan.js`**

Remove the skeleton import line:
```js
import SkeletonStopCard from '../../components/SkeletonCard';
```
Add the loader import (place it near the other `../../components/...` imports):
```js
import LoadingAnimation from '../../components/LoadingAnimation';
```

- [ ] **Step 5: Remove the now-unused `skeletonSection` style if orphaned**

Run: `cd /c/Users/webge/OneDrive/Desktop/Decide/decide-app && grep -n "skeletonSection" app/'(tabs)'/plan.js`
If the only remaining hit is the `skeletonSection: { … }` definition in the `StyleSheet.create` block (no `styles.skeletonSection` usages), delete that style definition. If `styles.skeletonSection` is still referenced anywhere, leave it.
Also confirm `SectionLabel` is still imported/used elsewhere in `plan.js` (`grep -n "SectionLabel" app/'(tabs)'/plan.js`) — if it now has zero usages, remove its import too; if it's still used, leave the import.

- [ ] **Step 6: Delete the dead skeleton component**

Run: `cd /c/Users/webge/OneDrive/Desktop/Decide/decide-app && git rm components/SkeletonCard.js`
(Confirm nothing else imports it first: `grep -rn "SkeletonCard" app components screens` should show no remaining importers.)

- [ ] **Step 7: Verify build**

Run: `npx expo export --platform web`
Expected: clean build — this confirms `lottie-react-native` resolves and `require('../assets/loading.json')` finds the asset. If the web bundler errors specifically on `lottie-react-native`, report it (status DONE_WITH_CONCERNS) with the exact error rather than working around it.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: replace skeleton loader with Lottie animation"
```

---

## Self-Review

**Spec coverage:**
- Part 1 token changes (bg/surfaceAlt/border) → Task 1. ✓
- Part 2 Settings cobalt swaps (all enumerated style keys + 2 Switches + ActivityIndicator) → Task 2. ✓
- Part 2 History light pass (teal fallback, filter text) → Task 3. ✓
- Part 3 Lottie (install dep, LoadingAnimation component, plan.js swap, delete SkeletonCard) → Task 4. ✓
- "warm goldText text stays" → enforced by Task 2 note + Step 5 grep (goldText should remain). ✓
- Tagline edits → already committed at branch start (`889b688`), out of task scope. ✓
- Verification (build each task) → Tasks 1–4. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows exact before/after. The two conditional steps (Task 4 Step 5 unused-style removal, Step 6 delete guard) specify the exact grep and the decision rule. ✓

**Type consistency:** `LoadingAnimation` default export with optional `label` prop is created in Task 4 Step 2 and consumed in Step 3 (`<LoadingAnimation />`, using the default label). `COLORS.primary`/`COLORS.primaryText`/`COLORS.textSecondary` are all existing tokens in `theme.js`. `SectionLabel` is the existing `components/brand/SectionLabel` used identically to the old skeleton block (`tone="cobalt"`, children text, `style`). ✓
