# Discovery Transparency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface what the Smart Discovery engine found (live "anchors") and why, at both the itinerary header and the individual stops, so users see the real time-sensitive finds the day was built around.

**Architecture:** Pure presentation feature over data the engine already returns. One new field is added to the API anchor mapping (`url`); everything else (`discovery.anchors[]`, `stop.provenance`) already flows to the client. A new extracted component renders the trip-level collapsible disclosure; two existing components gain stop-level provenance surfacing.

**Tech Stack:** Expo SDK 56, React Native, expo-router, `@expo/vector-icons` (Ionicons), themed styling via `useTheme()` + `makeStyles(colors)`.

**Spec:** `docs/superpowers/specs/2026-06-30-discovery-transparency-design.md`

## Global Constraints

- **Token discipline:** no raw hex, no `fontWeight` literals — use `constants/theme.js` tokens only. Style via `const styles = useMemo(() => makeStyles(colors), [colors])` from `useTheme()`; never the deprecated static `COLORS` for view styling.
- **Both API handlers must stay mirrored:** `api/itinerary.js` (Vercel/prod) and `app/api/itinerary+api.js` (Expo). Any discovery-shape change goes in BOTH.
- **No RN unit tests** (repo convention). Verification per task = clean `npx expo export --platform web` + the manual smoke described in the task.
- **Copy rule:** user-facing strings say "Cheddar", never "AI".
- **Both themes:** every new UI must render correctly in light AND dark.
- **Expo SDK 56** — reference https://docs.expo.dev/versions/v56.0.0/ if an API question arises.

## Setup (do once before Task 1)

- [ ] Create a working branch:

```bash
cd decide-app
git checkout main && git pull
git checkout -b feat/discovery-transparency
```

---

### Task 1: Add `url` to the API anchor mapping (both handlers)

**Files:**
- Modify: `api/itinerary.js` (~line 267 — the `discovery.anchors` map)
- Modify: `app/api/itinerary+api.js` (~line 415 — the `discovery.anchors` map)

**Interfaces:**
- Produces: `discovery.anchors[]` entries now shaped `{ title, interest, why, url }` where `url` is a string or `null`. Task 2's `DiscoveryAnchors` consumes `anchor.url`.

- [ ] **Step 1: Edit the Vercel handler mapping**

In `api/itinerary.js`, find the `anchors:` mapping inside the `discovery:` object (currently):

```js
anchors:smart.anchors.map((a)=>({title:a.find?.title,interest:a.find?.interest,why:a.rationale}))
```

Change it to add `url`:

```js
anchors:smart.anchors.map((a)=>({title:a.find?.title,interest:a.find?.interest,why:a.rationale,url:a.find?.url||null}))
```

- [ ] **Step 2: Edit the Expo handler mapping (mirror)**

In `app/api/itinerary+api.js`, find:

```js
anchors: smart.anchors.map((a) => ({ title: a.find?.title, interest: a.find?.interest, why: a.rationale })),
```

Change to:

```js
anchors: smart.anchors.map((a) => ({ title: a.find?.title, interest: a.find?.interest, why: a.rationale, url: a.find?.url || null })),
```

- [ ] **Step 3: Verify both mappings include `url`**

Run:

```bash
grep -n "a.find?.url" api/itinerary.js "app/api/itinerary+api.js"
```

Expected: one match in each file.

- [ ] **Step 4: Verify clean build**

Run: `npx expo export --platform web`
Expected: ends with `Exported: dist`, no errors.

- [ ] **Step 5: Commit**

```bash
git add api/itinerary.js "app/api/itinerary+api.js"
git commit -m "feat: expose anchor source url in discovery API mapping"
```

---

### Task 2: Trip-level `DiscoveryAnchors` disclosure

**Files:**
- Create: `components/itinerary/DiscoveryAnchors.js`
- Modify: `components/itinerary/ItineraryMeta.js` (replace the `hadLiveData` one-liner at lines 37–39; remove the now-unused `liveDataNote` style)

**Interfaces:**
- Consumes: `research` prop = the `discovery` object `{ hadLiveData, findCount, anchorCount, anchors: [{ title, interest, why, url }] }` (Task 1 shape). Already passed into `ItineraryMeta` from `app/(tabs)/plan.js:685`.
- Produces: `<DiscoveryAnchors research={...} />` default export.

- [ ] **Step 1: Create `components/itinerary/DiscoveryAnchors.js`**

```jsx
import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, RADII } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

// Collapsible "receipts" disclosure: shows the 1–3 live finds Cheddar built the
// day around, each tappable to its source when a url is present.
export default function DiscoveryAnchors({ research }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  // No live data at all → render nothing (prior behavior).
  if (!research?.hadLiveData) return null;

  const anchors = research.anchors ?? [];

  // Live data but no anchors → keep the original one-liner.
  if (anchors.length === 0) {
    return <Text style={styles.liveDataNote}>✨ Cheddar checked what's happening this week</Text>;
  }

  const openSource = (url) => { if (url) Linking.openURL(url).catch(() => {}); };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded((e) => !e)} activeOpacity={0.7}>
        <Text style={styles.headerText}>✨ What Cheddar found this week ({anchors.length})</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {anchors.map((a, i) => {
            const tappable = !!a.url;
            const Row = tappable ? TouchableOpacity : View;
            const rowProps = tappable ? { onPress: () => openSource(a.url), activeOpacity: 0.7 } : {};
            return (
              <Row key={i} style={styles.row} {...rowProps}>
                <View style={styles.rowTextCol}>
                  <Text style={[styles.anchorTitle, tappable && styles.anchorTitleLink]} numberOfLines={2}>
                    {a.title}
                  </Text>
                  {a.why ? <Text style={styles.anchorWhy} numberOfLines={3}>{a.why}</Text> : null}
                </View>
                {tappable && (
                  <Ionicons name="open-outline" size={14} color={colors.primary} style={{ marginLeft: 6, marginTop: 2 }} />
                )}
              </Row>
            );
          })}
        </View>
      )}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap: { marginTop: 10, alignSelf: 'stretch' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  headerText: { color: c.teal, fontSize: 12, fontFamily: FONTS.bodySemiBold, fontStyle: 'italic' },
  body: {
    marginTop: 10, gap: 10,
    backgroundColor: c.surfaceAlt, borderRadius: RADII.md,
    borderWidth: 1, borderColor: c.border, padding: 12,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  rowTextCol: { flex: 1 },
  anchorTitle: { fontSize: 13, color: c.textPrimary, fontFamily: FONTS.bodySemiBold },
  anchorTitleLink: { color: c.primary },
  anchorWhy: { fontSize: 12, color: c.textMuted, lineHeight: 17, marginTop: 2, fontFamily: FONTS.body },
  // Fallback one-liner (matches the old ItineraryMeta style).
  liveDataNote: { color: c.teal, fontSize: 11, fontStyle: 'italic', marginTop: 10, textAlign: 'center' },
});
```

- [ ] **Step 2: Wire it into `ItineraryMeta.js` — add the import**

At the top of `components/itinerary/ItineraryMeta.js`, after the existing imports, add:

```jsx
import DiscoveryAnchors from './DiscoveryAnchors';
```

- [ ] **Step 3: Replace the inline one-liner**

In `ItineraryMeta.js`, replace this block (currently lines 37–39):

```jsx
      {research?.hadLiveData && (
        <Text style={styles.liveDataNote}>✨ Cheddar checked what's happening this week</Text>
      )}
```

with:

```jsx
      <DiscoveryAnchors research={research} />
```

- [ ] **Step 4: Remove the now-unused `liveDataNote` style**

In `ItineraryMeta.js` `makeStyles`, delete the line:

```js
  liveDataNote:     { color: c.teal, fontSize: 11, fontStyle: 'italic', marginTop: 10, textAlign: 'center' },
```

(The fallback one-liner now lives in `DiscoveryAnchors`.)

- [ ] **Step 5: Verify clean build**

Run: `npx expo export --platform web`
Expected: ends with `Exported: dist`, no errors.

- [ ] **Step 6: Manual smoke (web)**

Run `npx expo start --web`, generate a plan in a city likely to have live events (so `discovery.anchors` is populated). Confirm:
- The header shows **"✨ What Cheddar found this week (N)"** with a chevron, collapsed by default.
- Tapping toggles the list; each row shows a bold title + muted "why".
- A row whose anchor has a `url` is cobalt with an `open-outline` icon and opens the browser on tap.
- A demo/fallback plan (no live data) shows nothing here.
- Toggle dark mode (Settings → Appearance) and re-check legibility.

- [ ] **Step 7: Commit**

```bash
git add components/itinerary/DiscoveryAnchors.js components/itinerary/ItineraryMeta.js
git commit -m "feat: trip-level discovery anchors disclosure"
```

---

### Task 3: Stop-level provenance (chip + detail section)

**Files:**
- Modify: `components/itinerary/StopCard.js` (add a "Live find" chip + its styles)
- Modify: `components/itinerary/PlaceDetailModal.js` (add a "Why it's here" section + one style)

**Interfaces:**
- Consumes: `stop.provenance = { interest, sourceLabel, why }` — already present on stops that came from an anchor/find (emitted by `lib/smart/synthesis.js`, preserved by `validateStops`). No Task 1/2 dependency.

- [ ] **Step 1: Add the provenance chip to `StopCard.js`**

In `components/itinerary/StopCard.js`, find the live-music badge block (currently lines 135–140):

```jsx
          {stop.live_music?.note ? (
            <View style={styles.liveMusicBadge}>
              <Ionicons name="musical-notes-outline" size={12} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.liveMusicTxt} numberOfLines={1}>{stop.live_music.note}</Text>
            </View>
          ) : null}
```

Immediately AFTER it, add:

```jsx
          {stop.provenance?.why ? (
            <View style={styles.provenanceBadge}>
              <Text style={styles.provenanceTxt} numberOfLines={1}>📰 Live find</Text>
            </View>
          ) : null}
```

- [ ] **Step 2: Add the chip styles to `StopCard.js` `makeStyles`**

In `StopCard.js`, directly after the `liveMusicTxt` style (line 281), add:

```js
  provenanceBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADII.sm, backgroundColor: c.sky100 },
  provenanceTxt:   { fontFamily: FONTS.bodyMedium, fontSize: 12, color: c.primary },
```

(`RADII` and `FONTS` are already imported in `StopCard.js`.)

- [ ] **Step 3: Add the "Why it's here" section to `PlaceDetailModal.js`**

In `components/itinerary/PlaceDetailModal.js`, find the "Cheddar's take" reason section (currently lines 133–138):

```jsx
              {stop.reason ? (
                <View style={styles.detailSection}>
                  <SectionLabel tone="cobalt" style={{ marginBottom: 10 }}>Cheddar's take</SectionLabel>
                  <Text style={styles.detailReasonText}>{stop.reason}</Text>
                </View>
              ) : null}
```

Immediately AFTER it, add:

```jsx
              {stop.provenance?.why ? (
                <View style={styles.detailSection}>
                  <SectionLabel tone="cobalt" style={{ marginBottom: 10 }}>📰 Why it's here</SectionLabel>
                  <Text style={styles.detailReasonText}>{stop.provenance.why}</Text>
                  {stop.provenance.sourceLabel ? (
                    <Text style={styles.provenanceSource}>Source: {stop.provenance.sourceLabel}</Text>
                  ) : null}
                </View>
              ) : null}
```

- [ ] **Step 4: Add the `provenanceSource` style to `PlaceDetailModal.js` `makeStyles`**

In `PlaceDetailModal.js` `makeStyles`, add this style entry (next to the other `detail*` styles):

```js
  provenanceSource: { fontSize: 11, color: c.textMuted, fontFamily: FONTS.body, marginTop: 6, fontStyle: 'italic' },
```

- [ ] **Step 5: Verify clean build**

Run: `npx expo export --platform web`
Expected: ends with `Exported: dist`, no errors.

- [ ] **Step 6: Manual smoke (web)**

Run `npx expo start --web` and open a plan that includes a live-find stop (one with `provenance` — typically an event/anchor stop). Confirm:
- The stop card shows a small **"📰 Live find"** chip.
- Tapping the stop opens the detail modal, which shows a **"📰 Why it's here"** section with the rationale and a "Source: …" caption when present.
- A plain (non-provenance) stop shows neither.
- Re-check in dark mode.

- [ ] **Step 7: Commit**

```bash
git add components/itinerary/StopCard.js components/itinerary/PlaceDetailModal.js
git commit -m "feat: stop-level live-find provenance chip and detail section"
```

---

## Finish

- [ ] After all three tasks pass review, finish the branch per the repo workflow (merge to `main` locally + push `main` + push branch). See memory `feedback-finish-branch-merge-and-push`.

---

## Self-Review (author check — already run)

**Spec coverage:**
- §1 API (`url` on anchors, both handlers) → Task 1. ✅
- §2 trip-level collapsible `DiscoveryAnchors`, fallback one-liner, empty/null handling, themed → Task 2. ✅
- §3 stop-level `StopCard` chip + `PlaceDetailModal` "Why it's here" + sourceLabel caption, plain text → Task 3. ✅
- §4 edge cases — null discovery (Task 2 Step 1 guard), hadLiveData-but-no-anchors (Task 2 fallback), missing `why`/`url` (Task 2 conditionals), no provenance (Task 3 guards). ✅
- Testing = build + manual smoke (no RN unit tests) → each task Steps "Verify clean build" + "Manual smoke". ✅

**Placeholder scan:** no TBD/TODO; all code shown in full. ✅

**Type consistency:** anchor shape `{ title, interest, why, url }` produced in Task 1, consumed in Task 2. `provenance.{why,sourceLabel}` consumed in Task 3 matches `validateStops` output. Component name `DiscoveryAnchors` consistent across create + import. ✅
