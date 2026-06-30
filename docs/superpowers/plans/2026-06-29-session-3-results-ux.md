# Session 3 — Results-UX Refresh & History Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users edit the time window on the results page and re-generate (free "edit", capped for non-Pro), and make History itinerary entries tappable into a full detail view that renders identically to the results page.

**Architecture:** Extract the itinerary render components (`StopCard`, `PlaceDetailModal`, `PriceLegendModal`, `WeatherPill`, `ItineraryMeta`, shared helpers) out of the 1726-line `app/(tabs)/plan.js` into `components/itinerary/`, consumed by both `plan.js` and a new `app/itinerary/[id].js` detail route. Refresh re-uses the existing `generate()` via an `{ asEdit }` flag. Pure window/refresh logic lives in `lib/refreshPolicy.js`, unit-tested via the existing `__tests__/verify.mjs` harness.

**Tech Stack:** Expo SDK 56, expo-router, React 19, React Native 0.85, AsyncStorage. No new dependencies.

## Global Constraints

- **Cobalt-led, no orange CTAs.** The Refresh button uses `CTAButton variant="cobalt"`. Orange is only the BrandLogo dot and the food category color. (`[[feedback-cobalt-led-no-orange-ctas]]`)
- **No hardcoded hex.** All colors from `constants/theme.js`. Use real tokens only: `FONTS.bodySemiBold`, `RADII.sm6`/`md10`/`lg24`/`pill999`/`icon42`, `SHADOWS.card`. Invented names like `FONTS.body600` or `RADII.sm` do NOT exist — verify against `constants/theme.js` before using.
- **AI assistant is "Cheddar"** in all user-facing copy — never "AI".
- **No `api/` files** created or moved (Vercel counts `api/*.js` as serverless functions). New shared code goes in `components/` or `lib/`. (`[[project-vercel-deploy-gotchas]]`)
- **`fontWeight` + `fontFamily: FONTS.*` never coexist** — the weight is baked into the family name. Pick the matching `FONTS.*` variant.
- **Expo SDK 56** — reference https://docs.expo.dev/versions/v56.0.0/ for any API.
- **Verification gates:** pure logic → `node __tests__/verify.mjs`; any JS/UI change → `npm run build` (= `npx expo export --platform web`; the same path Vercel uses — it catches broken imports, JSX, and module resolution). The web build takes ~1–2 minutes; that is expected.

---

## File Structure

**Created:**
- `lib/refreshPolicy.js` — pure window/refresh logic (no RN imports).
- `components/itinerary/helpers.js` — `openMaps`, `highlightConfig`.
- `components/itinerary/PriceLegendModal.js` — `PriceLegendModal`.
- `components/itinerary/WeatherPill.js` — `WeatherPill` + pill-text builder.
- `components/itinerary/PlaceDetailModal.js` — `PlaceDetailModal`.
- `components/itinerary/StopCard.js` — `StopCard` + `FeedbackModal`.
- `components/itinerary/ItineraryMeta.js` — meta header block (static + optional editor slot).
- `app/itinerary/[id].js` — full itinerary detail route.

**Modified:**
- `app/(tabs)/plan.js` — adopt `refreshPolicy`; import the extracted components; add refresh state + `generate({ asEdit })`; store full itinerary; render the results-page time editor.
- `app/(tabs)/history.js` — make full-data itinerary entries tappable.
- `__tests__/verify.mjs` — tests for `lib/refreshPolicy.js`.

---

## Task 1: Pure refresh/window logic (`lib/refreshPolicy.js`)

**Files:**
- Create: `lib/refreshPolicy.js`
- Test: `__tests__/verify.mjs` (append a new section + new imports)

**Interfaces:**
- Produces:
  - `timeToMinutes(timeStr: string) => number`
  - `isValidWindow(start: string, end: string, minMinutes = 180) => boolean`
  - `windowChanged(genStart, genEnd, curStart, curEnd) => boolean`
  - `canRefresh({ isPro: boolean, isDemo: boolean, refreshCount: number, cap?: number }) => boolean`
  - `FREE_REFRESHES_PER_ITINERARY: number` (= 3)

- [ ] **Step 1: Write the failing tests** — append to `__tests__/verify.mjs` just before the `// ─── Summary ───` block (around line 284):

```js
// ─── SESSION 3 — Refresh policy ───────────────────────────────────────────────
import {
  timeToMinutes as rpToMinutes, isValidWindow, windowChanged, canRefresh,
  FREE_REFRESHES_PER_ITINERARY,
} from '../lib/refreshPolicy.js';

console.log('\nSESSION 3 — refreshPolicy.timeToMinutes:');
assert("'8:00 AM' → 480",  rpToMinutes('8:00 AM') === 480);
assert("'12:00 PM' → 720", rpToMinutes('12:00 PM') === 720);
assert("'12:00 AM' → 0",   rpToMinutes('12:00 AM') === 0);
assert("'10:00 PM' → 1320", rpToMinutes('10:00 PM') === 1320);

console.log('\nSESSION 3 — refreshPolicy.isValidWindow:');
assert('Exactly 180 min → true', isValidWindow('11:00 AM', '2:00 PM') === true);
assert('179 min → false',        isValidWindow('11:00 AM', '1:59 PM') === false);
assert('11a–8p → true',          isValidWindow('11:00 AM', '8:00 PM') === true);
assert('Custom min honored',     isValidWindow('11:00 AM', '12:00 PM', 120) === false);

console.log('\nSESSION 3 — refreshPolicy.windowChanged:');
assert('Same/same → false',      windowChanged('11:00 AM', '8:00 PM', '11:00 AM', '8:00 PM') === false);
assert('Start differs → true',   windowChanged('11:00 AM', '8:00 PM', '10:00 AM', '8:00 PM') === true);
assert('End differs → true',     windowChanged('11:00 AM', '8:00 PM', '11:00 AM', '9:00 PM') === true);

console.log('\nSESSION 3 — refreshPolicy.canRefresh:');
assert('Cap is 3',               FREE_REFRESHES_PER_ITINERARY === 3);
assert('Pro → true at high count', canRefresh({ isPro: true, isDemo: false, refreshCount: 99 }) === true);
assert('Demo → true at high count', canRefresh({ isPro: false, isDemo: true, refreshCount: 99 }) === true);
assert('Free under cap → true',  canRefresh({ isPro: false, isDemo: false, refreshCount: 2 }) === true);
assert('Free at cap → false',    canRefresh({ isPro: false, isDemo: false, refreshCount: 3 }) === false);
assert('Custom cap honored',     canRefresh({ isPro: false, isDemo: false, refreshCount: 1, cap: 1 }) === false);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node __tests__/verify.mjs`
Expected: FAIL — `Cannot find module '../lib/refreshPolicy.js'` (or an import error).

- [ ] **Step 3: Create `lib/refreshPolicy.js`**

```js
// Pure time-window + refresh-gating logic. No React Native imports so the
// __tests__/verify.mjs harness can import it directly.

export const FREE_REFRESHES_PER_ITINERARY = 3;

// '8:00 AM' → 480, '12:00 PM' → 720, '12:00 AM' → 0
export function timeToMinutes(timeStr) {
  const [time, period] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + (minutes || 0);
}

export function isValidWindow(start, end, minMinutes = 180) {
  return timeToMinutes(end) - timeToMinutes(start) >= minMinutes;
}

export function windowChanged(genStart, genEnd, curStart, curEnd) {
  return genStart !== curStart || genEnd !== curEnd;
}

export function canRefresh({ isPro, isDemo, refreshCount, cap = FREE_REFRESHES_PER_ITINERARY }) {
  if (isPro || isDemo) return true;
  return refreshCount < cap;
}
```

> Note: the original `plan.js` `timeToMinutes` only parsed the hour (options are on the hour). This version also parses minutes so the 179-min test is exact and the helper is robust. Behavior for all on-the-hour inputs is identical.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node __tests__/verify.mjs`
Expected: PASS — all SESSION 3 assertions green, prior assertions still green, exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/refreshPolicy.js __tests__/verify.mjs
git commit -m "feat(s3): pure refresh/window policy + tests"
```

---

## Task 2: Adopt `refreshPolicy` in `plan.js`

Replace the inline `timeToMinutes` (plan.js:61-67) and the inline `isValidTimeWindow` (plan.js:663) with the shared module. No behavior change.

**Files:**
- Modify: `app/(tabs)/plan.js` (imports; delete inline `timeToMinutes`; line 663)

**Interfaces:**
- Consumes: `timeToMinutes`, `isValidWindow` from `lib/refreshPolicy.js` (Task 1).

- [ ] **Step 1: Add the import** — after the existing service imports (after `plan.js:25`, the `getApiBase` import):

```js
import { timeToMinutes, isValidWindow } from '../../lib/refreshPolicy';
```

- [ ] **Step 2: Delete the inline `timeToMinutes`** — remove the whole block at `plan.js:61-67`:

```js
function timeToMinutes(timeStr) {
  const [time, period] = timeStr.split(' ');
  let [hours] = time.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60;
}
```

(Keep the `// ─── Time options ───` comment and the `START_TIMES`/`END_TIMES` arrays above it.)

- [ ] **Step 3: Replace the inline validity check** — at `plan.js:663`:

```js
const isValidTimeWindow = timeToMinutes(endTime) - timeToMinutes(startTime) >= 180;
```

with:

```js
const isValidTimeWindow = isValidWindow(startTime, endTime);
```

- [ ] **Step 4: Verify the build and tests**

Run: `node __tests__/verify.mjs && npm run build`
Expected: tests PASS; web export completes with no bundling/import errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/plan.js
git commit -m "refactor(s3): use lib/refreshPolicy in plan.js"
```

---

## Task 3: Extract `helpers.js` + `PriceLegendModal.js`

`openMaps` and `highlightConfig` are used by both `PlaceDetailModal` and `StopCard`; `PriceLegendModal` is used by both too. Extract them first so later extraction tasks can import them.

**Files:**
- Create: `components/itinerary/helpers.js`, `components/itinerary/PriceLegendModal.js`
- Modify: `app/(tabs)/plan.js` (remove `openMaps`, `highlightConfig`, `PriceLegendModal` definitions + their style keys; import them)

**Interfaces:**
- Produces:
  - `helpers.js`: `openMaps(stop)`, `highlightConfig` (object keyed by `entertainment|special|feature|buzz`).
  - `PriceLegendModal.js`: `default function PriceLegendModal({ visible, onClose })`.

- [ ] **Step 1: Create `components/itinerary/helpers.js`**

```js
import { Platform, Linking } from 'react-native';
import { COLORS } from '../../constants/theme';

export const highlightConfig = {
  entertainment: { icon: '🎵', borderColor: COLORS.amber },
  special:       { icon: '🏷️', borderColor: COLORS.primary },
  feature:       { icon: '✨', borderColor: COLORS.amber },
  buzz:          { icon: '📰', borderColor: COLORS.textMuted },
};

export function openMaps(stop) {
  const target = stop.lat && stop.lng
    ? `${stop.lat},${stop.lng}`
    : encodeURIComponent(stop.address || stop.name);
  const url = Platform.OS === 'ios'
    ? `maps://?daddr=${target}`
    : `https://maps.google.com/?daddr=${target}`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${target}`);
  });
}
```

- [ ] **Step 2: Create `components/itinerary/PriceLegendModal.js`** — move the component verbatim from `plan.js:113-132`, add the imports, and move its style keys:

```js
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, PRICE_LEGEND } from '../../constants/theme';

export default function PriceLegendModal({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.legendCard}>
            <Text style={styles.legendTitle}>Price guide</Text>
            {PRICE_LEGEND.map((row) => (
              <View key={row.symbol} style={styles.legendRow}>
                <Text style={styles.legendSymbol}>{row.symbol}</Text>
                <Text style={styles.legendLabel}>{row.label}</Text>
              </View>
            ))}
            <Text style={styles.legendSub}>Estimated per-person cost including a typical meal or entry</Text>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // COPY these keys verbatim from plan.js's StyleSheet.create:
  //   modalOverlay, legendCard, legendTitle, legendRow, legendSymbol, legendLabel, legendSub
});
```

In Step 2, open `app/(tabs)/plan.js`, find each of the 7 keys named above inside its `StyleSheet.create({...})`, and copy their definitions verbatim into the `styles` block here. Do NOT delete `modalOverlay` from `plan.js` yet — it is still used by `TimePickerPill` (which stays in `plan.js`). Delete only the legend-specific keys (`legendCard`, `legendTitle`, `legendRow`, `legendSymbol`, `legendLabel`, `legendSub`) from `plan.js` in Step 4.

- [ ] **Step 3: In `plan.js`, delete the moved definitions** — remove `openMaps` (`plan.js:99-110`), `highlightConfig` (`plan.js:91-97`), and `PriceLegendModal` (`plan.js:112-132`).

- [ ] **Step 4: In `plan.js`, add imports and remove dead styles** — add near the component imports:

```js
import PriceLegendModal from '../../components/itinerary/PriceLegendModal';
import { openMaps, highlightConfig } from '../../components/itinerary/helpers';
```

Then delete the now-unused style keys from `plan.js`'s `StyleSheet.create`: `legendCard`, `legendTitle`, `legendRow`, `legendSymbol`, `legendLabel`, `legendSub`. (Keep `modalOverlay` — still used by `TimePickerPill`.)

> `openMaps`, `highlightConfig`, and `PriceLegendModal` are still referenced inside the not-yet-extracted `StopCard` and `PlaceDetailModal` in `plan.js`; the new imports satisfy those references until those components move in Tasks 5–6.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: web export completes, no "X is not defined" / unresolved-import errors.

- [ ] **Step 6: Commit**

```bash
git add components/itinerary/helpers.js components/itinerary/PriceLegendModal.js app/\(tabs\)/plan.js
git commit -m "refactor(s3): extract itinerary helpers + PriceLegendModal"
```

---

## Task 4: Extract `WeatherPill.js`

The results header shows a weather/time string in a pill (`plan.js:1082-1084`), built by `weatherPillText` (`plan.js:950-954`). Extract a self-contained `WeatherPill` that takes `weather` + `timeWindow`.

**Files:**
- Create: `components/itinerary/WeatherPill.js`
- Modify: `app/(tabs)/plan.js` (results header)

**Interfaces:**
- Produces: `default function WeatherPill({ weather, timeWindow })` — renders the pill `View`+`Text`.

- [ ] **Step 1: Create `components/itinerary/WeatherPill.js`**

```js
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII } from '../../constants/theme';

export function buildWeatherPillText(weather, timeWindow) {
  const tw = timeWindow ?? '';
  if (weather?.beyondForecast) {
    return `🗓 Extended forecast not available — check back closer to your trip · ${tw}`;
  }
  if (weather) {
    const wind = weather.wind_speed_mph ? ` · 💨 ${weather.wind_speed_mph}mph` : '';
    return `${weather.emoji ?? ''} ${weather.condition} · ${weather.temp_f}°F${wind} · ${tw}`;
  }
  return tw;
}

export default function WeatherPill({ weather, timeWindow }) {
  return (
    <View style={styles.headerPill}>
      <Text style={styles.headerPillText}>{buildWeatherPillText(weather, timeWindow)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // COPY the `headerPill` and `headerPillText` key definitions verbatim from plan.js's StyleSheet.create.
});
```

In Step 1, copy the `headerPill` and `headerPillText` definitions verbatim from `plan.js`. Do NOT delete them from `plan.js` — they are also used by the landing/configuring headers (`plan.js:1019-1021`).

- [ ] **Step 2: Use `WeatherPill` in the results header** — in `plan.js`, replace the itinerary-view header pill (`plan.js:1082-1084`):

```js
              <View style={styles.headerPill}>
                <Text style={styles.headerPillText}>{weatherPillText}</Text>
              </View>
```

with:

```js
              <WeatherPill weather={weather} timeWindow={meta?.time_window ?? `${startTime} – ${endTime}`} />
```

- [ ] **Step 3: Delete the now-unused `weatherPillText`** — remove the `const weatherPillText = ...` block at `plan.js:950-954`. (Confirm no other reference remains: search `weatherPillText` in `plan.js` — there should be none after Step 2.)

- [ ] **Step 4: Add the import** — near the component imports in `plan.js`:

```js
import WeatherPill from '../../components/itinerary/WeatherPill';
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: web export completes; results header still shows the weather + time-window pill.

- [ ] **Step 6: Commit**

```bash
git add components/itinerary/WeatherPill.js app/\(tabs\)/plan.js
git commit -m "refactor(s3): extract WeatherPill"
```

---

## Task 5: Extract `PlaceDetailModal.js`

**Files:**
- Create: `components/itinerary/PlaceDetailModal.js`
- Modify: `app/(tabs)/plan.js`

**Interfaces:**
- Consumes: `openMaps`, `highlightConfig` (Task 3 helpers); `PriceLegendModal` (Task 3).
- Produces: `default function PlaceDetailModal({ visible, stop, onClose })`.

- [ ] **Step 1: Create `components/itinerary/PlaceDetailModal.js`** — move the component verbatim from `plan.js:208-399`, with this import header:

```js
import { useState, useEffect } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, ActivityIndicator,
  Linking, Dimensions, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, CATEGORY_COLORS, CATEGORY_EMOJIS, FONTS, RADII } from '../../constants/theme';
import { placeDetails as fetchPlaceDetails } from '../../services/placesService';
import SectionLabel from '../brand/SectionLabel';
import { openMaps, highlightConfig } from './helpers';
import PriceLegendModal from './PriceLegendModal';

// ... PlaceDetailModal body moved verbatim from plan.js:208-399 ...

const styles = StyleSheet.create({
  // COPY verbatim from plan.js every `styles.X` key referenced by PlaceDetailModal:
  //   detailOverlay, detailSheet, dragHandle, detailHeader, detailCatPill, detailCatPillTxt,
  //   detailCloseBtn, detailScroll, detailName, detailAddr, detailInfoRow, detailInfoTxt,
  //   detailInfoDot, admissionRow, admissionLabel, admissionValue, detailSourceBadge,
  //   detailSourceTxt, detailSection, detailReasonText, highlightRow, highlightIcon,
  //   highlightText, detailStatsRow, distanceLink, distanceLinkTxt, detailExciteBadge,
  //   detailExciteTxt, detailNavBtn, detailNavBtnTxt, detailSecondaryBtns, detailSecBtn,
  //   detailSecBtnTxt
  // (Verify the exact set by searching `styles.` within the moved JSX — move precisely those keys.)
});
```

- [ ] **Step 2: In `plan.js`, delete the moved component** — remove `PlaceDetailModal` (`plan.js:208-399`) and all the style keys you moved in Step 1 from `plan.js`'s `StyleSheet.create`. Leave `modalOverlay` (still used by `TimePickerPill`).

- [ ] **Step 3: Add the import in `plan.js`** — near the component imports:

```js
import PlaceDetailModal from '../../components/itinerary/PlaceDetailModal';
```

The existing render site (`plan.js`, where `<PlaceDetailModal visible={showDetailModal} stop={selectedStop} ... />` is used) is unchanged.

- [ ] **Step 4: Verify the build and behavior**

Run: `npm run build`
Expected: web export completes. (Manual check later: tapping a stop opens the detail sheet with live hours/price.)

- [ ] **Step 5: Commit**

```bash
git add components/itinerary/PlaceDetailModal.js app/\(tabs\)/plan.js
git commit -m "refactor(s3): extract PlaceDetailModal"
```

---

## Task 6: Extract `StopCard.js` (+ `FeedbackModal`, optional swap)

**Files:**
- Create: `components/itinerary/StopCard.js`
- Modify: `app/(tabs)/plan.js`

**Interfaces:**
- Consumes: `openMaps` (Task 3), `PriceLegendModal` (Task 3); `getLocalKnowledge`, `getAllergyAlerts` (`constants/localKnowledge`).
- Produces: `default function StopCard({ stop, index, isLast, onViewDetails, weather, planDate, sensitivities, onSwap, isSwapping })` — `onSwap`/`isSwapping` are **optional**; when `onSwap` is absent the "Try another →" affordance is hidden (read-only mode).

- [ ] **Step 1: Create `components/itinerary/StopCard.js`** — move `FeedbackModal` (`plan.js:178-205`) and `StopCard` (`plan.js:402-585`) verbatim, with this header and the `FEEDBACK_REASONS` constant (move it too — it is only used by `FeedbackModal`):

```js
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ActivityIndicator, Animated, Linking, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, CATEGORY_COLORS, CATEGORY_EMOJIS, FONTS, RADII } from '../../constants/theme';
import { getLocalKnowledge, getAllergyAlerts } from '../../constants/localKnowledge';
import { openMaps } from './helpers';
import PriceLegendModal from './PriceLegendModal';

const FEEDBACK_REASONS = ['Closed', 'Too crowded', 'Not my style', 'Too far', 'Too expensive', 'Other'];

// function FeedbackModal({ ... }) { ...verbatim from plan.js:178-205... }
// function StopCard({ ... }) { ...verbatim from plan.js:402-585... }  → see Step 2 edits
export default StopCard;

const styles = StyleSheet.create({
  // COPY verbatim from plan.js every `styles.X` key referenced by StopCard + FeedbackModal:
  //   stopRow, timelineCol, timelineDot, timelineLine, stopCard, stopCardSwapping, stopHeaderRow,
  //   timeChip, timeText, durationText, catChip, catEmoji, catLabel, stopName, stopAddress,
  //   distancePill, distancePillTxt, admissionBadge, admissionBadgeTxt, liveMusicBadge, liveMusicTxt,
  //   pricePill, pricePillTxt, contactRow, contactBtn, contactBtnTxt, reasonRow, stopReason,
  //   localKnowledgeBadge, lkWarning, lkInfo, lkTip, lkIcon, lkText, allergyBadge, allergyText,
  //   cardActionsRow, exciteBadge, exciteText, swapBtn, swapLoadingRow, swapBtnText, thumbsRow,
  //   thumbBtn, thumbBtnUp, thumbBtnDown, thumbTxt, thumbDivider, tapHint, tapHintTxt,
  //   modalOverlay, modalCard?, fbOverlay, fbCard, fbHandle, fbTitle, fbPlace, fbOption, fbOptionTxt,
  //   fbCancel, fbCancelTxt
  // (Verify the exact set by searching `styles.` within the moved JSX. `modalOverlay` is shared —
  //  duplicate its definition here; do NOT remove it from plan.js.)
});
```

- [ ] **Step 2: Make the swap affordance optional** — in the moved `StopCard`, the change the signature default and guard the swap button. Replace the `cardActionsRow` block (originally `plan.js:544-558`):

```js
          <View style={styles.cardActionsRow}>
            {stop.excitement_score > 0
              ? <View style={styles.exciteBadge}><Text style={styles.exciteText}>⚡ {stop.excitement_score}</Text></View>
              : <View />
            }
            <TouchableOpacity style={styles.swapBtn} onPress={onSwap} disabled={isSwapping} activeOpacity={0.7}>
              {isSwapping
                ? <View style={styles.swapLoadingRow}>
                    <ActivityIndicator size="small" color={COLORS.textMuted} style={{ marginRight: 5 }} />
                    <Text style={styles.swapBtnText}>Finding…</Text>
                  </View>
                : <Text style={styles.swapBtnText}>Try another →</Text>
              }
            </TouchableOpacity>
          </View>
```

with (only the swap `TouchableOpacity` becomes conditional on `onSwap`):

```js
          <View style={styles.cardActionsRow}>
            {stop.excitement_score > 0
              ? <View style={styles.exciteBadge}><Text style={styles.exciteText}>⚡ {stop.excitement_score}</Text></View>
              : <View />
            }
            {onSwap ? (
              <TouchableOpacity style={styles.swapBtn} onPress={onSwap} disabled={isSwapping} activeOpacity={0.7}>
                {isSwapping
                  ? <View style={styles.swapLoadingRow}>
                      <ActivityIndicator size="small" color={COLORS.textMuted} style={{ marginRight: 5 }} />
                      <Text style={styles.swapBtnText}>Finding…</Text>
                    </View>
                  : <Text style={styles.swapBtnText}>Try another →</Text>
                }
              </TouchableOpacity>
            ) : <View />}
          </View>
```

Leave the props as `function StopCard({ stop, index = 0, isLast, onSwap, isSwapping, onViewDetails, weather, planDate, sensitivities })` — `onSwap`/`isSwapping` simply arrive `undefined` in read-only mode.

- [ ] **Step 3: In `plan.js`, delete the moved code** — remove `FeedbackModal` (`plan.js:178-205`), `StopCard` (`plan.js:402-585`), the `FEEDBACK_REASONS` constant (`plan.js:89`), and the StopCard/FeedbackModal-only style keys you moved. Keep `modalOverlay`.

- [ ] **Step 4: Add the import in `plan.js`** — near the component imports:

```js
import StopCard from '../../components/itinerary/StopCard';
```

The existing results render site (`plan.js:1129-1142`, passing `onSwap={() => handleSwap(i)}`) is unchanged — swap still works on the results page.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: web export completes; results page still renders stop cards with the "Try another →" button.

- [ ] **Step 6: Commit**

```bash
git add components/itinerary/StopCard.js app/\(tabs\)/plan.js
git commit -m "refactor(s3): extract StopCard with optional swap"
```

---

## Task 7: Extract `ItineraryMeta.js` (static + editor slot)

**Files:**
- Create: `components/itinerary/ItineraryMeta.js`
- Modify: `app/(tabs)/plan.js`

**Interfaces:**
- Produces: `default function ItineraryMeta({ meta, stopCount, research, timeEditor })` — `timeEditor` is an optional React node. When provided, it renders in place of the static `🕐 {time_window}` chip (results page); when absent, the static chip renders (detail route).

- [ ] **Step 1: Create `components/itinerary/ItineraryMeta.js`**

```js
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, RADII } from '../../constants/theme';

export default function ItineraryMeta({ meta, stopCount, research, timeEditor = null }) {
  if (!meta) return null;
  return (
    <View style={styles.itineraryMeta}>
      <Text style={styles.itineraryDay}>{meta.day_of_week}</Text>
      <Text style={styles.itineraryDate}>{meta.date} · {stopCount} stops</Text>
      {meta.city ? <Text style={styles.itineraryCity}>📍 {meta.city}</Text> : null}
      {timeEditor}
      <View style={styles.metaChips}>
        {!timeEditor && meta.time_window && (
          <View style={[styles.metaChip, styles.metaChipTime]}>
            <Text style={[styles.metaChipText, styles.metaChipTimeText]}>🕐 {meta.time_window}</Text>
          </View>
        )}
        {[meta.preferences?.pace, meta.preferences?.budget, meta.preferences?.group_type]
          .filter(Boolean)
          .map((v) => (
            <View key={v} style={styles.metaChip}>
              <Text style={styles.metaChipText}>{v}</Text>
            </View>
          ))}
      </View>
      {meta.cost_summary ? (
        <View style={styles.costSummaryRow}>
          <Ionicons name="wallet-outline" size={14} color={COLORS.primary} style={{ marginRight: 5 }} />
          <Text style={styles.costSummaryTxt}>{meta.cost_summary}</Text>
        </View>
      ) : null}
      {research?.hadLiveData && (
        <Text style={styles.liveDataNote}>✨ Cheddar checked what's happening this week</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // COPY verbatim from plan.js: itineraryMeta, itineraryDay, itineraryDate, itineraryCity,
  //   metaChips, metaChip, metaChipTime, metaChipText, metaChipTimeText, costSummaryRow,
  //   costSummaryTxt, liveDataNote
});
```

- [ ] **Step 2: Use `ItineraryMeta` in `plan.js` (static for now)** — replace the inline meta block (`plan.js:1096-1127`, the whole `{meta && ( <View style={styles.itineraryMeta}> ... </View> )}`) with:

```js
              <ItineraryMeta meta={meta} stopCount={itinerary.length} research={research} />
```

(The editor `timeEditor` prop is wired in Task 9.)

- [ ] **Step 3: In `plan.js`, delete the moved style keys** — remove from `plan.js`'s `StyleSheet.create`: `itineraryMeta`, `itineraryDay`, `itineraryDate`, `itineraryCity`, `metaChips`, `metaChip`, `metaChipTime`, `metaChipText`, `metaChipTimeText`, `costSummaryRow`, `costSummaryTxt`, `liveDataNote`.

- [ ] **Step 4: Add the import in `plan.js`** — near the component imports:

```js
import ItineraryMeta from '../../components/itinerary/ItineraryMeta';
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: web export completes; results page meta header looks identical.

- [ ] **Step 6: Commit**

```bash
git add components/itinerary/ItineraryMeta.js app/\(tabs\)/plan.js
git commit -m "refactor(s3): extract ItineraryMeta with editor slot"
```

---

## Task 8: Store the full itinerary in History (`v: 2`)

Change the history save so new entries carry the full `itinerary` array (needed by the Task 10 detail route) plus a `v: 2` flag. Old entries are untouched.

**Files:**
- Modify: `app/(tabs)/plan.js` (history save in `generate()`, `plan.js:879-893`)

**Interfaces:**
- Produces: itinerary history entry shape `{ id, timestamp, meta, weather, stops:[{name,category}], itinerary:[...full stops], v:2, feedback, feedbackReason }`.

- [ ] **Step 1: Replace the history-save block** — replace `plan.js:879-893` (the `try { ... } catch` that builds `entry` and writes `@decide/itineraries`) with:

```js
      try {
        const raw      = await AsyncStorage.getItem('@decide/itineraries');
        const existing = raw ? JSON.parse(raw) : [];
        const id       = `itinerary_${Date.now()}`;
        const entry    = {
          id,
          timestamp: Date.now(),
          meta:      data.meta,
          weather:   data.weather,
          stops:     (data.itinerary ?? []).map((s) => ({ name: s.name, category: s.category })),
          itinerary: data.itinerary ?? [],
          v:         2,
          feedback:  null, feedbackReason: null,
        };
        setCurrentItineraryId(id);
        await AsyncStorage.setItem(
          '@decide/itineraries',
          JSON.stringify([entry, ...existing.slice(0, 49)])
        );
      } catch (e) {
        console.warn('[history] save itinerary error', e);
      }
```

> `setCurrentItineraryId` state is added in Task 9. If running this task before Task 9, temporarily omit the `setCurrentItineraryId(id);` line, then add it back in Task 9. (In subagent-driven order this task precedes Task 9; the build will fail on an undefined setter — so add the state declaration from Task 9 Step 1 now, or run Task 9 immediately after.) **Simplest: do Task 8 Step 1 and Task 9 Step 1 together before building.**

- [ ] **Step 2: Verify the build** (after Task 9 Step 1 state exists)

Run: `npm run build`
Expected: web export completes.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/plan.js
git commit -m "feat(s3): store full itinerary in history (v2 entries)"
```

---

## Task 9: Results-page time editor + `generate({ asEdit })`

Adds the refresh state, the `asEdit` branch in `generate()`, and the inline editor (pills + conditional Refresh button) passed into `ItineraryMeta`.

**Files:**
- Modify: `app/(tabs)/plan.js`

**Interfaces:**
- Consumes: `windowChanged`, `canRefresh` (Task 1); `isPro` (`services/subscriptionService`); `ItineraryMeta` `timeEditor` prop (Task 7); `currentItineraryId` (Task 8); `TimePickerPill`, `START_TIMES`, `END_TIMES` (existing in `plan.js`).

- [ ] **Step 1: Add state + imports**

Extend the refreshPolicy import (added in Task 2) to include the two new functions:

```js
import { timeToMinutes, isValidWindow, windowChanged, canRefresh } from '../../lib/refreshPolicy';
```

Add `isPro` to the subscriptionService import (`plan.js:14`):

```js
import { isAtDecisionLimit, incrementDecisionCount, getRemainingDecisions, isPro, LIMITS } from '../../services/subscriptionService';
```

Add new state after `const [planDate, setPlanDate] = useState(null);` (`plan.js:641`):

```js
  const [generatedStart,     setGeneratedStart]     = useState(null);
  const [generatedEnd,       setGeneratedEnd]       = useState(null);
  const [refreshCount,       setRefreshCount]       = useState(0);
  const [currentItineraryId, setCurrentItineraryId] = useState(null);
```

- [ ] **Step 2: Branch `generate()` for edit vs fresh** — change the signature (`plan.js:829`) and the two guards at the top.

Signature:

```js
  const generate = async ({ asEdit = false } = {}) => {
```

Replace the limit guard (`plan.js:831-832`):

```js
    if (!isValidTimeWindow) return;
    if (await isAtDecisionLimit()) { router.push('/paywall'); return; }
```

with:

```js
    if (!isValidTimeWindow) return;
    if (asEdit) {
      const [pro, demoRaw] = await Promise.all([
        isPro(),
        AsyncStorage.getItem('@decide/demo_mode').catch(() => null),
      ]);
      if (!canRefresh({ isPro: pro, isDemo: demoRaw === 'true', refreshCount })) {
        router.push('/paywall'); return;
      }
    } else {
      if (await isAtDecisionLimit()) { router.push('/paywall'); return; }
    }
```

- [ ] **Step 3: Make the history save update-in-place on edit** — replace the history-save block from Task 8 Step 1 with the edit-aware version:

```js
      try {
        const raw      = await AsyncStorage.getItem('@decide/itineraries');
        const existing = raw ? JSON.parse(raw) : [];
        const summary  = (data.itinerary ?? []).map((s) => ({ name: s.name, category: s.category }));
        const idx      = asEdit && currentItineraryId
          ? existing.findIndex((e) => e.id === currentItineraryId)
          : -1;
        if (idx !== -1) {
          existing[idx] = {
            ...existing[idx],
            meta: data.meta, weather: data.weather,
            stops: summary, itinerary: data.itinerary ?? [], v: 2,
          };
          await AsyncStorage.setItem('@decide/itineraries', JSON.stringify(existing));
        } else {
          const id    = `itinerary_${Date.now()}`;
          const entry = {
            id, timestamp: Date.now(), meta: data.meta, weather: data.weather,
            stops: summary, itinerary: data.itinerary ?? [], v: 2,
            feedback: null, feedbackReason: null,
          };
          setCurrentItineraryId(id);
          await AsyncStorage.setItem('@decide/itineraries', JSON.stringify([entry, ...existing.slice(0, 49)]));
        }
      } catch (e) {
        console.warn('[history] save itinerary error', e);
      }
```

- [ ] **Step 4: Guard the credit consumption + track the generated window** — replace `plan.js:897-898`:

```js
      await incrementDecisionCount().catch(() => {});
      getRemainingDecisions().then(setRemainingDecisions).catch(() => {});
```

with:

```js
      if (asEdit) {
        setRefreshCount((c) => c + 1);
      } else {
        setRefreshCount(0);
        await incrementDecisionCount().catch(() => {});
        getRemainingDecisions().then(setRemainingDecisions).catch(() => {});
      }
      setGeneratedStart(startTime);
      setGeneratedEnd(endTime);
```

- [ ] **Step 5: Update `generate` call sites that pass an event** — `onPress={generate}` would pass a press event as the options object. Change both:
  - Sticky build button (`plan.js:1166`): `onPress={generate}` → `onPress={() => generate()}`
  - Error retry button (`plan.js:1068`): `onPress={generate}` → `onPress={() => generate()}`

- [ ] **Step 6: Build the editor node and pass it to `ItineraryMeta`** — in the itinerary view, just before the `return`'s itinerary JSX (a good spot is right after `const hasItinerary = ...` near `plan.js:949`), add:

```js
  const windowDidChange = windowChanged(generatedStart, generatedEnd, startTime, endTime);
  const timeEditor = (
    <View style={styles.resultsTimeEditor}>
      <View style={styles.timePickerRow}>
        <TimePickerPill label="Start" value={startTime} options={START_TIMES} onChange={setStartTime} disabled={loading} />
        <Text style={styles.timeArrow}>→</Text>
        <TimePickerPill label="End"   value={endTime}   options={END_TIMES}   onChange={setEndTime}   disabled={loading} />
      </View>
      {!isValidTimeWindow && (
        <Text style={styles.timeValidationHint}>Please allow at least 3 hours</Text>
      )}
      {windowDidChange && isValidTimeWindow && !loading && (
        <View style={{ marginTop: 10 }}>
          <CTAButton variant="cobalt" title="Refresh itinerary" onPress={() => generate({ asEdit: true })} />
        </View>
      )}
    </View>
  );
```

Then pass it into the meta component (from Task 7 Step 2):

```js
              <ItineraryMeta meta={meta} stopCount={itinerary.length} research={research} timeEditor={timeEditor} />
```

- [ ] **Step 7: Add the `resultsTimeEditor` style** — in `plan.js`'s `StyleSheet.create`, add:

```js
  resultsTimeEditor: { marginTop: 4, marginBottom: 12 },
```

(`timePickerRow`, `timeArrow`, `timeValidationHint` already exist in `plan.js` from the configuring form.)

- [ ] **Step 8: Verify the build and tests**

Run: `node __tests__/verify.mjs && npm run build`
Expected: tests PASS; web export completes.

- [ ] **Step 9: Commit**

```bash
git add app/\(tabs\)/plan.js
git commit -m "feat(s3): editable time window + free-edit refresh on results page"
```

---

## Task 10: Itinerary detail route (`app/itinerary/[id].js`)

**Files:**
- Create: `app/itinerary/[id].js`

**Interfaces:**
- Consumes: `WeatherPill`, `ItineraryMeta`, `StopCard`, `PlaceDetailModal` (Tasks 4–7); reads `@decide/itineraries` and `@decide/sensitivities` from AsyncStorage.

- [ ] **Step 1: Create `app/itinerary/[id].js`**

```js
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, FONTS, RADII } from '../../constants/theme';
import ScreenBackground from '../../components/brand/ScreenBackground';
import WeatherPill from '../../components/itinerary/WeatherPill';
import ItineraryMeta from '../../components/itinerary/ItineraryMeta';
import StopCard from '../../components/itinerary/StopCard';
import PlaceDetailModal from '../../components/itinerary/PlaceDetailModal';

export default function ItineraryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [entry,         setEntry]         = useState(undefined); // undefined=loading, null=not found
  const [sensitivities, setSensitivities] = useState([]);
  const [selectedStop,    setSelectedStop]    = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [raw, sensRaw] = await Promise.all([
          AsyncStorage.getItem('@decide/itineraries'),
          AsyncStorage.getItem('@decide/sensitivities'),
        ]);
        const list  = raw ? JSON.parse(raw) : [];
        const found = list.find((e) => e.id === id);
        setSensitivities(sensRaw ? JSON.parse(sensRaw) : []);
        setEntry(found && Array.isArray(found.itinerary) && found.itinerary.length ? found : null);
      } catch {
        setEntry(null);
      }
    })();
  }, [id]);

  const Header = ({ children }) => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backRow}>
        <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      {children}
    </View>
  );

  if (entry === undefined) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenBackground variant="paper" style={styles.fill}>
          <Header />
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        </ScreenBackground>
      </SafeAreaView>
    );
  }

  if (entry === null) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenBackground variant="paper" style={styles.fill}>
          <Header />
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>This plan is no longer available</Text>
            <Text style={styles.emptySub}>Full detail isn’t saved for older itineraries.</Text>
          </View>
        </ScreenBackground>
      </SafeAreaView>
    );
  }

  const { itinerary, weather, meta } = entry;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView style={styles.fill} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Header>
          <Text style={styles.title}>Your day</Text>
          <WeatherPill weather={weather} timeWindow={meta?.time_window ?? ''} />
        </Header>

        <View style={styles.body}>
          <ItineraryMeta meta={meta} stopCount={itinerary.length} research={null} />
          {itinerary.map((stop, i) => (
            <StopCard
              key={`${stop.place_id}-${i}`}
              stop={stop}
              index={i}
              isLast={i === itinerary.length - 1}
              onViewDetails={(s) => { setSelectedStop(s); setShowDetailModal(true); }}
              weather={weather}
              planDate={entry.timestamp}
              sensitivities={sensitivities}
            />
          ))}
        </View>
      </ScrollView>

      <PlaceDetailModal
        visible={showDetailModal}
        stop={selectedStop}
        onClose={() => setShowDetailModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: COLORS.bg },
  fill:       { flex: 1 },
  header:     { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  backRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backText:   { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: COLORS.primary, marginLeft: 2 },
  title:      { fontFamily: FONTS.displayBold, fontSize: 26, color: COLORS.textPrimary, marginBottom: 8 },
  body:       { paddingHorizontal: 20 },
  emptyWrap:  { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60 },
  emptyTitle: { fontFamily: FONTS.displayBold, fontSize: 19, color: COLORS.textPrimary, textAlign: 'center' },
  emptySub:   { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 8 },
});
```

> **Token check:** before building, confirm `FONTS.displayBold` and `FONTS.bodySemiBold` exist in `constants/theme.js`. If a name differs (e.g. `FONTS.display`/`FONTS.bodySemiBold`), use the real token names — do not invent. `COLORS.bg`, `COLORS.primary`, `COLORS.textPrimary`, `COLORS.textMuted` are confirmed in CLAUDE.md.

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: web export completes; the new `/itinerary/[id]` route is bundled.

- [ ] **Step 3: Commit**

```bash
git add app/itinerary/\[id\].js
git commit -m "feat(s3): full itinerary detail route"
```

---

## Task 11: Make History itinerary entries tappable

**Files:**
- Modify: `app/(tabs)/history.js` (`ItineraryEntry` ~117-191, and its render site in `HistoryScreen`)

**Interfaces:**
- Consumes: the `/itinerary/[id]` route (Task 10); entries with an `itinerary` array (Task 8).

- [ ] **Step 1: Add an `onOpen` prop + tappable wrapper to `ItineraryEntry`** — change the signature (`history.js:117`):

```js
function ItineraryEntry({ item, onFeedbackUp, onFeedbackDown, onOpen }) {
```

Add a tappability flag after the existing `const stopCount = ...` (`history.js:124`):

```js
  const tappable = Array.isArray(item.itinerary) && item.itinerary.length > 0;
```

Wrap the upper content (header + meta + stats + chips) — i.e. `history.js:128-164` — in a `TouchableOpacity` when tappable. Replace the opening of that region with a wrapper. Concretely, wrap the four existing blocks (`itinHeader`, `itinMetaRow`, `itinStatsRow`, and the stops `ScrollView`) like this:

```js
      <TouchableOpacity
        activeOpacity={tappable ? 0.7 : 1}
        onPress={tappable ? onOpen : undefined}
        disabled={!tappable}
      >
        {/* existing itinHeader View ... */}
        {/* existing itinMetaRow View ... */}
        {/* existing itinStatsRow View ... */}
        {/* existing stops ScrollView ... */}
      </TouchableOpacity>
```

Leave the feedback tag and the `thumbsRow` (`history.js:166-188`) OUTSIDE the wrapper so 👍/👎 keep their own handlers and a thumb tap never navigates. Add a small affordance inside the wrapper, right after the `itinStatsRow`, only when tappable:

```js
        {tappable && (
          <Text style={styles.tapDetailHint}>View full itinerary →</Text>
        )}
```

- [ ] **Step 2: Add the `tapDetailHint` style** — in `history.js`'s `StyleSheet.create`, add:

```js
  tapDetailHint: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: COLORS.primary, marginTop: 8 },
```

(Confirm `FONTS` and `COLORS` are already imported in `history.js`; they are used throughout the file. Confirm `FONTS.bodySemiBold` exists in `constants/theme.js`.)

- [ ] **Step 3: Pass `onOpen` at the render site** — find where `<ItineraryEntry` is rendered inside `HistoryScreen` (the itineraries list `renderItem`/map) and add the prop:

```js
          onOpen={() => router.push(`/itinerary/${item.id}`)}
```

(`router` is already available — `const router = useRouter();` at `history.js:217`.)

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: web export completes.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/history.js
git commit -m "feat(s3): tappable history entries → itinerary detail"
```

---

## Task 12: Final verification + finish the branch

**Files:** none (verification + integration)

- [ ] **Step 1: Run the full test + build gate**

Run: `node __tests__/verify.mjs && npm run build`
Expected: all assertions PASS; web export completes cleanly.

- [ ] **Step 2: Manual app verification** (run `npx expo start`, exercise on web or a device)

Walk this checklist and confirm each:
- Generate an itinerary → results page shows editable Start/End pills in the meta header; no Refresh button yet.
- Change the End time → "Refresh itinerary" (cobalt) button appears; tap it → loading overlay → itinerary regenerates with the new window; the decisions-left count is unchanged (no credit spent).
- Set an invalid window (<3h) → "Please allow at least 3 hours" shows; no Refresh button.
- As a free user (not Pro, not demo), refresh 3 times on one itinerary → the 4th refresh routes to the paywall. (Toggle Pro by setting `@decide/subscription_status` = `pro`, or demo via `@decide/demo_mode` = `true`, to confirm unlimited.)
- History tab → a newly generated itinerary entry shows "View full itinerary →" and is tappable → detail route renders identical stop cards / meta / weather; stop cards have NO "Try another →" button; tapping a stop opens the place-detail sheet; 👍/👎 on the History card do NOT navigate.
- An older (pre-change) itinerary entry has no "View full itinerary →" and is not tappable.
- Refreshing an itinerary updates its existing History entry in place (no duplicate entry appears).

Fix any issues found (re-run Step 1 after fixes) before finishing.

- [ ] **Step 2.5: Self-review the diff** — invoke `superpowers:requesting-code-review` (or `/code-review`) on the branch diff; address findings.

- [ ] **Step 3: Finish the branch** — per `[[feedback-finish-branch-merge-and-push]]`: merge to `main` locally, push `main`, and push the `session-3-results-ux` branch. Use `superpowers:finishing-a-development-branch`. (`gh` is not installed — no PR via CLI.) A Vercel deploy is not required (client-only), but the passing `npm run build` in Step 1 confirms the web export still builds.

---

## Self-Review (against the spec)

**Spec coverage:**
- Decision 1 (free-edit refresh, no credit) → Task 9 Step 2/4. ✓
- Decision 2 (inline pills + conditional button) → Task 9 Step 6. ✓
- Decision 3 (old entries not tappable) → Task 11 Step 1 (`tappable` flag). ✓
- Decision 4 (extract shared components) → Tasks 3–7. ✓
- Decision 5 (Pro unlimited / free capped at 3) → Task 1 (`canRefresh`) + Task 9 Step 2. ✓
- Decision 6 (update history entry in place) → Task 9 Step 3. ✓
- Read-only swap in detail → Task 6 Step 2 + Task 10 (no `onSwap`). ✓
- Storage `v:2` + full itinerary → Task 8 / Task 9 Step 3. ✓
- Detail route + not-found state → Task 10. ✓
- Pure logic + tests via verify.mjs → Task 1. ✓
- WeatherPill decoupled from live start/end → Task 4 (`timeWindow` prop). ✓

**Type consistency:** `generate({ asEdit })`, `canRefresh({ isPro, isDemo, refreshCount, cap })`, `windowChanged(genStart, genEnd, curStart, curEnd)`, `isValidWindow(start, end, min)`, `ItineraryMeta({ meta, stopCount, research, timeEditor })`, `WeatherPill({ weather, timeWindow })`, `StopCard({ ..., onSwap?, isSwapping? })` — names match across all tasks. ✓

**Ordering note:** Task 8 and Task 9 Step 1 must land together (the history save references `setCurrentItineraryId`). Called out in Task 8 Step 1.
