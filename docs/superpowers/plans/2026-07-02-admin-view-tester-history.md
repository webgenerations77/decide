# Admin View Tester History — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin open a beta tester's admin detail page and view that tester's full itineraries (stop-by-stop) and decisions, read-only.

**Architecture:** Reuse the existing itinerary detail rendering by extracting it into a shared `ItineraryDetailView`; extract the existing `DecisionCard`; add a `data=history` query branch to the existing `/api/admin/users` handler (no new `api/` file); add admin drill-in routes under `app/admin/user/[uid]/`.

**Tech Stack:** Expo SDK 56, expo-router (file-based routing), React Native (+ react-native-web), Firebase Auth/Firestore, server API twins (dev `app/api/*+api.js` using `Request`/`Response`; prod `api/*.js` using `req`/`res`).

## Global Constraints

- **Vercel function cap: max 12 files under `api/`.** Never add a file under `api/`. New server capability must be a query branch on an existing handler with logic in `lib/`. (This plan adds none.)
- **API twins must stay in sync:** every change to `app/api/admin/users+api.js` must be mirrored in `api/admin/users.js`.
- **No unit-test harness in this project.** The verification gate for every task is `npx expo export --platform web` succeeding (prints `Exported: dist`) plus the manual check described in the task. `node --check` is useless here — do NOT use it.
- **All npm installs (if any) use `--legacy-peer-deps`.** (None expected in this plan.)
- **No hardcoded hex** — style via `useTheme()` colors / `constants/theme.js` tokens.
- **Never show "Cheddar" or "AI" in user-facing copy.** (No user-facing copy added here beyond section labels.)
- Run all commands from `decide-app/` (the git repo root). Git repo is inside `decide-app/`, not the workspace parent.

---

### Task 1: Backend — expose full user history to admins (both API twins)

**Files:**
- Modify: `app/api/admin/users+api.js` (dev twin, `GET` handler)
- Modify: `api/admin/users.js` (prod twin, `GET` branch)

**Interfaces:**
- Consumes: `getUserHistory(uid)` from `lib/history/store.js` (already exists) → returns `{ itineraries: [...], decisions: [...] }`.
- Produces: `GET /api/admin/users?uid=<uid>&data=history` → `{ itineraries, decisions }` (admin-guarded). The `?uid=<uid>` (no `data`) path is unchanged (`getUserStats`).

- [ ] **Step 1: Add the `data=history` branch to the dev twin.**

In `app/api/admin/users+api.js`, add `import { getUserHistory } from '../../../lib/history/store.js';` at the top (next to the other `lib` imports). Then, inside `GET`, replace the existing `if (uid) { ... }` block with:

```js
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');
  const data = url.searchParams.get('data');
  if (uid && data === 'history') {
    try {
      return Response.json(await getUserHistory(uid));
    } catch (e) {
      console.error('[api/admin/users] user_history_failed:', e);
      return Response.json({ error: 'user_history_failed', message: e.message }, { status: 500 });
    }
  }
  if (uid) {
    try {
      return Response.json(await getUserStats(uid));
    } catch (e) {
      console.error('[api/admin/users] user_stats_failed:', e);
      return Response.json({ error: 'user_stats_failed', message: e.message }, { status: 500 });
    }
  }
```

(Delete the previous `const uid = new URL(request.url).searchParams.get('uid');` line — it is now created above.)

- [ ] **Step 2: Add the `data=history` branch to the prod twin.**

In `api/admin/users.js`, add `import { getUserHistory } from '../../lib/history/store.js';` at the top. Then, inside the `GET` portion (after the `POST` block), replace the existing `if (req.query.uid) { ... }` block with:

```js
  if (req.query.uid && req.query.data === 'history') {
    try {
      return res.json(await getUserHistory(req.query.uid));
    } catch (e) {
      console.error('[api/admin/users] user_history_failed:', e);
      return res.status(500).json({ error: 'user_history_failed', message: e.message });
    }
  }
  if (req.query.uid) {
    try {
      return res.json(await getUserStats(req.query.uid));
    } catch (e) {
      console.error('[api/admin/users] user_stats_failed:', e);
      return res.status(500).json({ error: 'user_stats_failed', message: e.message });
    }
  }
```

- [ ] **Step 3: Confirm the api file count is still ≤ 12.**

Run: `find api -name '*.js' | wc -l`
Expected: a number ≤ 12 (no new file was added).

- [ ] **Step 4: Build.**

Run: `npx expo export --platform web`
Expected: ends with `Exported: dist` (no errors).

- [ ] **Step 5: Commit.**

```bash
git add app/api/admin/users+api.js api/admin/users.js
git commit -m "admin api: add data=history branch returning a user's full itineraries+decisions"
```

---

### Task 2: Client service — `getUserHistory(uid)`

**Files:**
- Modify: `services/adminApi.js`

**Interfaces:**
- Consumes: Task 1's `GET /api/admin/users?uid&data=history`.
- Produces: `export async function getUserHistory(uid): Promise<{ itineraries, decisions }>`.

- [ ] **Step 1: Add the function.**

Append to `services/adminApi.js` (it already has `authHeader()`):

```js
export async function getUserHistory(uid) {
  const res = await fetch(`/api/admin/users?uid=${encodeURIComponent(uid)}&data=history`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`user_history_${res.status}`);
  return res.json(); // { itineraries, decisions }
}
```

- [ ] **Step 2: Build.**

Run: `npx expo export --platform web`
Expected: `Exported: dist`.

- [ ] **Step 3: Commit.**

```bash
git add services/adminApi.js
git commit -m "adminApi: add getUserHistory(uid) client helper"
```

---

### Task 3: Extract `ItineraryDetailView`; make `app/itinerary/[id].js` a thin wrapper

**Files:**
- Create: `components/itinerary/ItineraryDetailView.js`
- Modify: `app/itinerary/[id].js` (replace whole file)

**Interfaces:**
- Produces: `export default function ItineraryDetailView({ entry, sensitivities, onBack })`.
  `entry` is a history itinerary record `{ id, itinerary: [...stops], weather, meta, timestamp }` (or `null`). `sensitivities` is a string array (default `[]`). `onBack` is a `() => void`. Renders the "not available" state when `entry` is null or has no `itinerary` array.

- [ ] **Step 1: Create `components/itinerary/ItineraryDetailView.js`.**

```jsx
import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import ScreenBackground from '../brand/ScreenBackground';
import WeatherArt from './WeatherArt';
import ItineraryMeta from './ItineraryMeta';
import StopCard from './StopCard';
import PlaceDetailModal from './PlaceDetailModal';

function Header({ onBack, children, weather }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backRow}>
        <Ionicons name="chevron-back" size={18} color={colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      {weather ? <WeatherArt weather={weather} height={84} style={styles.headerArt} /> : null}
      {children}
    </View>
  );
}

export default function ItineraryDetailView({ entry, sensitivities = [], onBack }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selectedStop, setSelectedStop] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const hasFull = entry && Array.isArray(entry.itinerary) && entry.itinerary.length > 0;

  if (!hasFull) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenBackground variant="paper" style={styles.fill}>
          <Header onBack={onBack} />
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>This plan is no longer available</Text>
            <Text style={styles.emptySub}>Full detail isn't saved for older itineraries.</Text>
          </View>
        </ScreenBackground>
      </SafeAreaView>
    );
  }

  const { itinerary, weather, meta } = entry;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenBackground variant="paper" style={styles.fill}>
        <ScrollView style={styles.fill} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Header onBack={onBack} weather={weather} />
          <View style={styles.body}>
            <ItineraryMeta meta={meta} stopCount={itinerary.length} research={null} weather={weather} />
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
      </ScreenBackground>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  screen:     { flex: 1, backgroundColor: c.bg },
  fill:       { flex: 1 },
  header:     { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
  headerArt:  { marginTop: 4, marginBottom: 8, borderRadius: 14, zIndex: 0 },
  backRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  backText:   { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: c.primary, marginLeft: 2 },
  body:       { paddingHorizontal: 20, zIndex: 1 },
  emptyWrap:  { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60 },
  emptyTitle: { fontFamily: FONTS.display, fontSize: 19, color: c.textPrimary, textAlign: 'center' },
  emptySub:   { fontFamily: FONTS.body, fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 2: Replace `app/itinerary/[id].js` with a thin wrapper.**

```jsx
import { useState, useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { loadHistory } from '../../services/historyService';
import { useTheme } from '../../context/ThemeContext';
import ScreenBackground from '../../components/brand/ScreenBackground';
import ItineraryDetailView from '../../components/itinerary/ItineraryDetailView';

export default function ItineraryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const [entry, setEntry] = useState(undefined); // undefined=loading, null=not found
  const [sensitivities, setSensitivities] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [{ itineraries }, sensRaw] = await Promise.all([
          loadHistory(),
          AsyncStorage.getItem('@decide/sensitivities'),
        ]);
        setSensitivities(sensRaw ? JSON.parse(sensRaw) : []);
        setEntry(itineraries.find((e) => e.id === id) || null);
      } catch {
        setEntry(null);
      }
    })();
  }, [id]);

  if (entry === undefined) {
    return (
      <ScreenBackground variant="paper">
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ItineraryDetailView
      entry={entry}
      sensitivities={sensitivities}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/history'))}
    />
  );
}
```

- [ ] **Step 3: Build.**

Run: `npx expo export --platform web`
Expected: `Exported: dist`.

- [ ] **Step 4: Manual verify (dev).**

Run `npx expo start`, open History, tap an itinerary that has full stop data → confirm the detail screen renders identically to before (header, weather band, meta, stop cards, tapping a stop opens the place-detail modal). Tap an older itinerary without saved stops → "This plan is no longer available".

- [ ] **Step 5: Commit.**

```bash
git add components/itinerary/ItineraryDetailView.js app/itinerary/[id].js
git commit -m "Extract ItineraryDetailView; app/itinerary/[id].js becomes a thin wrapper"
```

---

### Task 4: Extract `DecisionCard` (+ `readOnly`) into its own component

**Files:**
- Create: `components/history/DecisionCard.js`
- Modify: `app/(tabs)/history.js` (remove the local `DecisionCard` function + the now-unused `formatTimestamp`; import the new component)

**Interfaces:**
- Produces: `export default function DecisionCard({ item, onFeedbackUp, onFeedbackDown, readOnly = false })`. When `readOnly` is true, the thumbs-up/down row is hidden and the feedback callbacks are unused.
- `formatTimestamp` (currently `app/(tabs)/history.js:26`) is used ONLY by `DecisionCard` — it moves into the new file.

- [ ] **Step 1: Create `components/history/DecisionCard.js`.**

```jsx
import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { categoryVisual } from '../../constants/categoryVisuals';
import { useTheme } from '../../context/ThemeContext';
import Card from '../brand/Card';

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export default function DecisionCard({ item, onFeedbackUp, onFeedbackDown, readOnly = false }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { icon: catIcon, color } = categoryVisual(item.category);
  const score = item.excitementScore ?? item.excitement_score ?? 0;

  return (
    <Card style={[styles.decisionCard, { borderLeftColor: color }]}>
      <View style={styles.decisionTop}>
        <View style={styles.decisionNameRow}>
          <Ionicons name={catIcon} size={15} color={color} style={styles.decisionCatIcon} />
          <Text style={styles.decisionName} numberOfLines={1}>{item.name}</Text>
          {score > 0 && (
            <View style={styles.exciteBadge}>
              <Text style={styles.exciteText}>⚡{score}</Text>
            </View>
          )}
        </View>

        {item.reason ? (
          <Text style={styles.decisionReason} numberOfLines={2}>{item.reason}</Text>
        ) : null}

        <View style={styles.decisionMetaRow}>
          <Text style={styles.decisionTime}>{formatTimestamp(item.timestamp)}</Text>
          {item.rating > 0 && <Text style={styles.decisionMeta}>⭐ {item.rating}</Text>}
          {item.distance ? <Text style={styles.decisionMeta}>{item.distance}</Text> : null}
        </View>

        {item.feedback === 'down' && item.feedbackReason ? (
          <View style={styles.feedbackTag}>
            <Text style={styles.feedbackTagTxt}>❌ {item.feedbackReason}</Text>
          </View>
        ) : null}
      </View>

      {!readOnly && (
        <View style={styles.thumbsRow}>
          <TouchableOpacity
            style={[styles.thumbBtn, item.feedback === 'up' && styles.thumbBtnUp]}
            onPress={onFeedbackUp}
            activeOpacity={0.7}
          >
            <Text style={styles.thumbTxt}>👍</Text>
          </TouchableOpacity>
          <View style={styles.thumbDivider} />
          <TouchableOpacity
            style={[styles.thumbBtn, item.feedback === 'down' && styles.thumbBtnDown]}
            onPress={onFeedbackDown}
            activeOpacity={0.7}
          >
            <Text style={styles.thumbTxt}>👎</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

const makeStyles = (c) => StyleSheet.create({
  decisionCard: {
    borderRadius: 16,
    borderWidth: 0.5, borderColor: c.border, borderLeftWidth: 3,
    marginBottom: 12, overflow: 'hidden', padding: 0,
  },
  decisionTop:      { padding: 14, gap: 5 },
  decisionNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  decisionCatIcon:  { marginRight: 2 },
  decisionName:     { flex: 1, fontSize: 15, fontFamily: FONTS.bodyBold, color: c.textPrimary },
  exciteBadge: {
    backgroundColor: c.primary + '33', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: c.primary + '55',
  },
  exciteText: { color: c.primaryDark, fontSize: 10, fontFamily: FONTS.bodyBold },
  decisionReason:  { fontSize: 13, color: c.textSecondary, fontStyle: 'italic', lineHeight: 17 },
  decisionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  decisionTime:    { fontSize: 11, color: c.textMuted },
  decisionMeta:    { fontSize: 11, color: c.textMuted },
  feedbackTag: {
    alignSelf: 'flex-start', backgroundColor: c.error + '22',
    borderRadius: 8, borderWidth: 1, borderColor: c.error + '44',
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 2,
  },
  feedbackTagTxt: { fontSize: 11, fontFamily: FONTS.bodySemiBold, color: c.error },
  thumbsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: 14, paddingVertical: 8,
  },
  thumbBtn:     { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  thumbBtnUp:   { backgroundColor: c.success + '33' },
  thumbBtnDown: { backgroundColor: c.error + '22' },
  thumbTxt:     { fontSize: 15 },
  thumbDivider: { width: 1, height: 18, backgroundColor: c.border, marginHorizontal: 6 },
});
```

> NOTE: `formatTimestamp` above uses `toLocaleDateString()`. Before writing, open `app/(tabs)/history.js` and copy the ACTUAL body of `formatTimestamp` (defined around line 26) verbatim into this file, in case it formats differently (e.g. includes time). Then delete it from `history.js`.

- [ ] **Step 2: Update `app/(tabs)/history.js`.**

- Delete the local `function DecisionCard(...) { ... }` (the block starting `// ─── DecisionCard ───` at ~line 69 through its closing `}` at ~line 125).
- Delete the local `function formatTimestamp(ts) { ... }` (~line 26) — confirm via search that it has no other references in the file first (`formatTimestamp` should appear only in the deleted DecisionCard). If it IS used elsewhere, keep it and instead import `formatTimestamp` is NOT exported — in that case leave `formatTimestamp` in history.js and remove only from the new file's dependency (the new file has its own copy, so this is fine either way).
- Add import near the other component imports: `import DecisionCard from '../../components/history/DecisionCard';`
- The existing decisions render (`decisions.map((item) => (<DecisionCard ... />))`) is unchanged — it now resolves to the imported component (do NOT pass `readOnly`, so feedback stays enabled here).
- Remove the decision-only style keys that are now unused in `history.js`'s `makeStyles` ONLY IF they are not referenced by any remaining code in the file (search each key first). If any is still referenced (e.g. `feedbackTag`, `thumbsRow` are shared with `ItineraryEntry`), LEAVE it. When unsure, leave the style — an unused style key is harmless.

- [ ] **Step 3: Build.**

Run: `npx expo export --platform web`
Expected: `Exported: dist`.

- [ ] **Step 4: Manual verify (dev).**

Open History → Decisions filter → confirm decision cards render exactly as before, including the 👍/👎 thumbs and that tapping them still records feedback.

- [ ] **Step 5: Commit.**

```bash
git add components/history/DecisionCard.js "app/(tabs)/history.js"
git commit -m "Extract DecisionCard into components/history; add readOnly prop"
```

---

### Task 5: Restructure admin user-detail route into a folder

**Why:** expo-router cannot have both `app/admin/user/[uid].js` (file) and `app/admin/user/[uid]/` (folder). Task 6 adds a nested route under `[uid]/`, so the screen must first move to `[uid]/index.js`.

**Files:**
- Move: `app/admin/user/[uid].js` → `app/admin/user/[uid]/index.js`
- Modify: the moved file's relative import depths (one level deeper).

**Interfaces:**
- Produces: route `/admin/user/[uid]` served by `app/admin/user/[uid]/index.js` (callers like `router.push('/admin/user/' + uid)` are unchanged).

- [ ] **Step 1: Move the file with git.**

```bash
mkdir -p "app/admin/user/[uid]"
git mv "app/admin/user/[uid].js" "app/admin/user/[uid]/index.js"
```

- [ ] **Step 2: Fix relative imports (add one `../`).**

In `app/admin/user/[uid]/index.js`, every relative import that was `../../../` becomes `../../../../`. Specifically change:

```js
import { useTheme } from '../../../context/ThemeContext';
import { getUsage, getUserStats, getUsers } from '../../../services/adminApi';
import ScreenBackground from '../../../components/brand/ScreenBackground';
import Card from '../../../components/brand/Card';
import SectionLabel from '../../../components/brand/SectionLabel';
import { FONTS, RADII } from '../../../constants/theme';
```
to:
```js
import { useTheme } from '../../../../context/ThemeContext';
import { getUsage, getUserStats, getUsers } from '../../../../services/adminApi';
import ScreenBackground from '../../../../components/brand/ScreenBackground';
import Card from '../../../../components/brand/Card';
import SectionLabel from '../../../../components/brand/SectionLabel';
import { FONTS, RADII } from '../../../../constants/theme';
```
(Search the file for `'../../../` and add one `../` to each. Leave any non-relative imports like `react`, `react-native`, `expo-router`, `@expo/vector-icons` untouched.)

- [ ] **Step 3: Build.**

Run: `npx expo export --platform web`
Expected: `Exported: dist`.

- [ ] **Step 4: Manual verify (dev).**

As admin, open `/admin`, tap a user → confirm `/admin/user/<uid>` still renders (Account, API usage, Activity) exactly as before.

- [ ] **Step 5: Commit.**

```bash
git add -A "app/admin/user"
git commit -m "Move admin user-detail route to [uid]/index.js (make room for nested routes)"
```

---

### Task 6: Admin itinerary detail route

**Files:**
- Create: `app/admin/user/[uid]/itinerary/[id].js`

**Interfaces:**
- Consumes: `getUserHistory(uid)` (Task 2); `ItineraryDetailView` (Task 3).
- Produces: route `/admin/user/[uid]/itinerary/[id]` rendering the tester's full itinerary detail. NOTE the import depth is FIVE levels (`../../../../../`) — this file lives at `app/admin/user/[uid]/itinerary/[id].js`.

- [ ] **Step 1: Create the route.**

```jsx
import { useState, useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../../../context/ThemeContext';
import { getUserHistory } from '../../../../../services/adminApi';
import ScreenBackground from '../../../../../components/brand/ScreenBackground';
import ItineraryDetailView from '../../../../../components/itinerary/ItineraryDetailView';

export default function AdminItineraryDetailScreen() {
  const router = useRouter();
  const { uid, id } = useLocalSearchParams();
  const { colors } = useTheme();
  const [entry, setEntry] = useState(undefined); // undefined=loading, null=not found

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { itineraries = [] } = await getUserHistory(uid);
        if (!alive) return;
        setEntry(itineraries.find((e) => e.id === id) || null);
      } catch {
        if (alive) setEntry(null);
      }
    })();
    return () => { alive = false; };
  }, [uid, id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/admin/user/${uid}`));

  if (entry === undefined) {
    return (
      <ScreenBackground variant="paper">
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return <ItineraryDetailView entry={entry} sensitivities={[]} onBack={back} />;
}
```

- [ ] **Step 2: Build.**

Run: `npx expo export --platform web`
Expected: `Exported: dist`.

- [ ] **Step 3: Commit.**

```bash
git add "app/admin/user/[uid]/itinerary/[id].js"
git commit -m "Add admin itinerary detail route reusing ItineraryDetailView"
```

(Manual verification happens in Task 7 once the list links exist.)

---

### Task 7: Add Itineraries + Decisions sections to the admin user-detail screen

**Files:**
- Modify: `app/admin/user/[uid]/index.js`

**Interfaces:**
- Consumes: `getUserHistory(uid)` (Task 2); `DecisionCard` (Task 4); admin itinerary route (Task 6).
- Produces: the two new sections + navigation into `/admin/user/[uid]/itinerary/[id]`.

- [ ] **Step 1: Swap the data source and imports.**

In `app/admin/user/[uid]/index.js`:
- Change the adminApi import to include `getUserHistory` and drop `getUserStats`:
  `import { getUsage, getUserHistory, getUsers } from '../../../../services/adminApi';`
- Add: `import DecisionCard from '../../../../components/history/DecisionCard';`
- Replace the stats state (`detailStats`, `detailLoading`, `detailErr`) and its `getUserStats(uid)` effect with a single history fetch. Add state:
  ```js
  const [history, setHistory] = useState(null);   // { itineraries, decisions } | null
  const [historyErr, setHistoryErr] = useState(null);
  ```
  and an effect:
  ```js
  useEffect(() => {
    let alive = true;
    getUserHistory(uid)
      .then((h) => { if (alive) setHistory(h); })
      .catch((e) => { if (alive) setHistoryErr(e.message); });
    return () => { alive = false; };
  }, [uid]);
  ```
  (Keep the existing `getUsers` and `getUsage` fetches as they are.)

- [ ] **Step 2: Derive the Activity counts from `history` (replacing the old `detailStats`).**

Add near the top of the component body (after state):
```js
const itineraries = history?.itineraries || [];
const decisions = history?.decisions || [];
const cityMap = new Map();
for (const it of itineraries) {
  const city = typeof it?.meta?.city === 'string' ? it.meta.city.trim() : '';
  if (city && !cityMap.has(city.toLowerCase())) cityMap.set(city.toLowerCase(), city);
}
const cities = Array.from(cityMap.values()).slice(0, 10);
```
In the existing **Activity** section JSX, replace references to `detailStats.itineraries`/`detailStats.decisions`/`detailStats.locations`/`detailStats.cities` with `itineraries.length` / `decisions.length` / `cityMap.size` / `cities`, and replace the `detailLoading`/`detailErr` gating with `!history && !historyErr` (loading spinner) / `historyErr` (error text).

- [ ] **Step 3: Add the Itineraries and Decisions sections.**

Place these after the existing Activity `Card`, before the screen's closing `</ScrollView>` (use the existing `SectionLabel`, `Card`, and `router` already imported in the file; `styles` is the file's `makeStyles` result):

```jsx
<SectionLabel tone="cobalt">ITINERARIES</SectionLabel>
<Card>
  {!history && !historyErr ? (
    <ActivityIndicator color={colors.primary} />
  ) : itineraries.length === 0 ? (
    <Text style={styles.muted}>No itineraries yet</Text>
  ) : (
    itineraries.map((it) => (
      <Pressable
        key={it.id}
        style={styles.recordRow}
        onPress={() => router.push(`/admin/user/${encodeURIComponent(uid)}/itinerary/${encodeURIComponent(it.id)}`)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.recordTitle}>
            {`${it.meta?.day_of_week ?? ''} ${it.meta?.date ?? ''}`.trim() || 'Itinerary'}
          </Text>
          <Text style={styles.recordSub}>
            {[it.meta?.city, `${it.itinerary?.length ?? it.stops?.length ?? 0} stops`].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Text style={styles.recordChevron}>›</Text>
      </Pressable>
    ))
  )}
</Card>

<SectionLabel tone="cobalt">DECISIONS</SectionLabel>
{!history && !historyErr ? (
  <Card><ActivityIndicator color={colors.primary} /></Card>
) : decisions.length === 0 ? (
  <Card><Text style={styles.muted}>No decisions yet</Text></Card>
) : (
  decisions.map((d) => <DecisionCard key={d.id} item={d} readOnly />)
)}
```

- [ ] **Step 4: Add the new styles.**

In this file's `makeStyles`, add:
```js
recordRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
recordTitle: { fontFamily: FONTS.bodySemiBold, color: c.textPrimary },
recordSub: { fontFamily: FONTS.body, color: c.textMuted, fontSize: 12, marginTop: 1 },
recordChevron: { fontFamily: FONTS.body, color: c.textMuted, fontSize: 22 },
```
(`muted` already exists in this file's styles; reuse it. `Pressable` and `ActivityIndicator` are already imported from `react-native` in this file — verify and add to the import if missing.)

- [ ] **Step 5: Build.**

Run: `npx expo export --platform web`
Expected: `Exported: dist`.

- [ ] **Step 6: Manual verify (dev).**

As admin: open a tester with history → confirm the ITINERARIES list (day/date · city · stops) and DECISIONS cards (read-only, no thumbs) render, and the Activity counts still match. Tap an itinerary → confirm `/admin/user/<uid>/itinerary/<id>` shows the full stop-by-stop detail. Tap Back → returns to the tester's detail. Open a tester with no history → both sections show their empty states.

- [ ] **Step 7: Commit.**

```bash
git add "app/admin/user/[uid]/index.js"
git commit -m "Admin user detail: list tester itineraries (drill-in) + decisions"
```

---

## Final verification

- [ ] `npx expo export --platform web` → `Exported: dist`.
- [ ] `find api -name '*.js' | wc -l` → ≤ 12.
- [ ] End-to-end manual pass of the Task 7 verification against a real tester account (dev or a preview deploy).
- [ ] Push `main` (Vercel auto-deploys); confirm the deployment goes green (a failed build silently freezes prod).

## Self-review notes (author)

- **Spec coverage:** backend branch (T1), service (T2), ItineraryDetailView extraction (T3), DecisionCard extraction + readOnly (T4), admin route restructure required by expo-router (T5, not in spec but a prerequisite the spec's "new route" implies), admin itinerary route (T6), admin sections + counts-from-history (T7). All spec sections mapped.
- **Twin sync:** T1 edits both `+api.js` and `api/admin/users.js`.
- **Type consistency:** `getUserHistory(uid) → { itineraries, decisions }` used identically in T2/T6/T7; `ItineraryDetailView({ entry, sensitivities, onBack })` used identically in T3/T6; `DecisionCard({ item, readOnly })` in T4/T7.
