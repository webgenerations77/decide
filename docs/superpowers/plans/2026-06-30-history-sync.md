# History Sync (Cloud) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync a user's itineraries and decisions across devices via server-side Firestore, keeping AsyncStorage as an offline-durable cache reconciled by a merge-on-load.

**Architecture:** Server endpoints (`firebase-admin`) own the cloud source of truth at `users/{uid}/{itineraries|decisions}/{id}`; a client `historyService` reads the AsyncStorage cache instantly and runs `syncHistory()` (union-merge cache+server by id, newest wins) which also performs migration and offline-write flush. Reuses `getUidFromAuth` (from the api-usage feature) for auth.

**Tech Stack:** Firebase Admin (Firestore), Expo Router / Vercel API handlers, React Native + AsyncStorage, Firebase client auth (`getIdToken`).

## Global Constraints

- Tests live in `__tests__/*.mjs`, repo assert-counter convention (`let passed=0,failed=0; const assert=(l,c,d='')=>...; console.log(\`\n${passed} passed, ${failed} failed\`); process.exit(failed?1:0);`), run `node __tests__/<file>.mjs`. No jest/vitest.
- ESM `.js` lib files run under plain `node` (MODULE_TYPELESS_PACKAGE_JSON warning is expected/harmless). RN/Expo client files cannot be node-run — verify those with `node --check` (syntax only) and `npx expo export --platform web` (ends `Exported: dist`).
- Two handler shapes stay mirrored: prod Vercel `api/*.js` (`req.headers.authorization`, `req.body`, `res.json`, `export default handler(req,res)`) and dev Expo `app/api/*+api.js` (`request.headers.get(...)`, `await request.json()`, `Response.json`, `export async function GET/POST/DELETE(request)`).
- History endpoints REQUIRE auth: `getUidFromAuth` → null ⇒ `401 { error: 'unauthorized' }`.
- Client API base comes from `services/apiBase.js` (`getApiBase()`), already used by `app/(tabs)/plan.js`. Auth header uses `auth.currentUser?.getIdToken()` (pattern from `services/adminApi.js`).
- Item ids/shapes are preserved: itineraries `itinerary_<ts>` (cap 50), decisions `decision_<ts>` (cap 100); both carry `id`, `timestamp`, `feedback`, `feedbackReason`. Add `updatedAt` (ms) on write.
- Demo mode is untouched — it uses `DEMO_HISTORY` and must never call the service or the cloud.
- No hardcoded hex in components; server keys stay server-side.

---

### Task 1: Pure `mergeById`

**Files:**
- Create: `lib/history/merge.js`
- Create (test): `__tests__/history-merge.mjs`

**Interfaces:**
- Produces: `mergeById(localList = [], remoteList = [])` → array unioned by `id`, keeping the entry with the greater `updatedAt ?? timestamp ?? 0`; items missing/`id == null` are skipped; result ordered by `timestamp` desc. Pure, no I/O.

- [ ] **Step 1: Write the failing test**

Create `__tests__/history-merge.mjs`:

```js
// __tests__/history-merge.mjs — run: node __tests__/history-merge.mjs
import { mergeById } from '../lib/history/merge.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

// union: local-only + remote-only both survive
const u = mergeById([{ id: 'a', timestamp: 2 }], [{ id: 'b', timestamp: 1 }]);
assert('union keeps both ids', u.length === 2 && u.some(x => x.id === 'a') && u.some(x => x.id === 'b'));
assert('ordered by timestamp desc', u[0].id === 'a' && u[1].id === 'b');

// conflict: newer updatedAt wins
const c1 = mergeById(
  [{ id: 'a', timestamp: 1, updatedAt: 500, v: 'local' }],
  [{ id: 'a', timestamp: 1, updatedAt: 100, v: 'remote' }],
);
assert('newer updatedAt wins', c1.length === 1 && c1[0].v === 'local');

// conflict: falls back to timestamp when no updatedAt
const c2 = mergeById(
  [{ id: 'a', timestamp: 1, v: 'local-old' }],
  [{ id: 'a', timestamp: 9, v: 'remote-new' }],
);
assert('timestamp fallback picks newer', c2[0].v === 'remote-new');

// skips junk
const s = mergeById([null, { timestamp: 1 }, { id: 'x', timestamp: 3 }], []);
assert('skips null / id-less items', s.length === 1 && s[0].id === 'x');

// empty inputs
assert('empty both → empty', mergeById().length === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node __tests__/history-merge.mjs`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../lib/history/merge.js`.

- [ ] **Step 3: Implement `lib/history/merge.js`**

```js
// Union two lists of history items by `id`, keeping the entry with the newer
// stamp (updatedAt preferred, then timestamp). Ordered by timestamp desc. Pure.
function stamp(item) {
  return item.updatedAt ?? item.timestamp ?? 0;
}

export function mergeById(localList = [], remoteList = []) {
  const byId = new Map();
  // remote first, then local, so a local item wins ties (it is the just-saved copy).
  for (const item of [...remoteList, ...localList]) {
    if (!item || item.id == null) continue;
    const existing = byId.get(item.id);
    if (!existing || stamp(item) >= stamp(existing)) byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node __tests__/history-merge.mjs`
Expected: PASS — `6 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add lib/history/merge.js __tests__/history-merge.mjs
git commit -m "Add pure mergeById for history reconciliation"
```

---

### Task 2: Server history store

**Files:**
- Create: `lib/history/store.js`
- Create (test): `__tests__/history-store.mjs`

**Interfaces:**
- Consumes: `getAdminDb` from `lib/firebaseAdmin.cjs`. Each function takes an optional `db` param (defaults to `getAdminDb()`) so tests inject a fake.
- Produces:
  - `getUserHistory(uid, db?)` → `{ itineraries: [...], decisions: [...] }`, each sorted by `timestamp` desc.
  - `upsertItems(uid, type, items, db?)` → number upserted; `type` ∈ `{'itineraries','decisions'}`; batched `set(..., { merge: true })` keyed by `String(item.id)`; no-ops on bad type / empty array.
  - `clearUserHistory(uid, db?)` → deletes all docs in both subcollections.

- [ ] **Step 1: Write the failing test**

Create `__tests__/history-store.mjs` (a minimal fake Firestore records writes and returns canned snapshots):

```js
// __tests__/history-store.mjs — run: node __tests__/history-store.mjs
import { getUserHistory, upsertItems, clearUserHistory } from '../lib/history/store.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

// Fake Firestore: users/{uid}/{type} collections backed by plain maps.
function makeFakeDb(seed = {}) {
  const store = seed; // { 'uid/itineraries': { id: data } }
  const ops = { sets: [], deletes: [] };
  const colKey = (uid, type) => `${uid}/${type}`;
  const docRef = (uid, type, id) => ({ __key: colKey(uid, type), __id: id });
  const collection = (name) => ({
    doc: (uid) => ({
      collection: (type) => ({
        get: async () => {
          const m = store[colKey(uid, type)] || {};
          return { empty: Object.keys(m).length === 0,
            docs: Object.entries(m).map(([id, data]) => ({ id, data: () => data, ref: docRef(uid, type, id) })) };
        },
        doc: (id) => docRef(uid, type, id),
      }),
    }),
  });
  const batch = () => ({
    set: (ref, data, opts) => { ops.sets.push({ ref, data, opts });
      (store[ref.__key] ??= {})[ref.__id] = data; },
    delete: (ref) => { ops.deletes.push({ ref }); delete (store[ref.__key] || {})[ref.__id]; },
    commit: async () => {},
  });
  return { db: { collection, batch }, ops, store };
}

// getUserHistory sorts by timestamp desc
{
  const { db } = makeFakeDb({ 'u1/itineraries': { a: { id: 'a', timestamp: 1 }, b: { id: 'b', timestamp: 5 } }, 'u1/decisions': {} });
  const out = await getUserHistory('u1', db);
  assert('returns both types', Array.isArray(out.itineraries) && Array.isArray(out.decisions));
  assert('itineraries sorted desc', out.itineraries[0].id === 'b' && out.itineraries[1].id === 'a');
}

// upsertItems writes each item by String(id) with merge
{
  const { db, ops, store } = makeFakeDb();
  const n = await upsertItems('u1', 'itineraries', [{ id: 7, timestamp: 3 }, { id: 8, timestamp: 4 }], db);
  assert('upsert returns count', n === 2);
  assert('set called with merge', ops.sets.length === 2 && ops.sets[0].opts?.merge === true);
  assert('doc id stringified', store['u1/itineraries']['7']?.timestamp === 3);
}

// upsertItems no-ops on bad type / empty
{
  const { db } = makeFakeDb();
  assert('bad type no-op', (await upsertItems('u1', 'nope', [{ id: 1 }], db)) === 0);
  assert('empty no-op', (await upsertItems('u1', 'decisions', [], db)) === 0);
}

// clearUserHistory deletes everything
{
  const { db, store } = makeFakeDb({ 'u1/itineraries': { a: { id: 'a' } }, 'u1/decisions': { d: { id: 'd' } } });
  await clearUserHistory('u1', db);
  assert('itineraries cleared', Object.keys(store['u1/itineraries']).length === 0);
  assert('decisions cleared', Object.keys(store['u1/decisions']).length === 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node __tests__/history-store.mjs`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../lib/history/store.js`.

- [ ] **Step 3: Implement `lib/history/store.js`**

```js
import { getAdminDb } from '../firebaseAdmin.cjs';

const TYPES = ['itineraries', 'decisions'];

function userCol(db, uid, type) {
  return db.collection('users').doc(uid).collection(type);
}

export async function getUserHistory(uid, db = getAdminDb()) {
  const out = {};
  for (const type of TYPES) {
    const snap = await userCol(db, uid, type).get();
    out[type] = snap.docs
      .map((d) => d.data())
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }
  return out;
}

export async function upsertItems(uid, type, items, db = getAdminDb()) {
  if (!TYPES.includes(type) || !Array.isArray(items) || items.length === 0) return 0;
  const col = userCol(db, uid, type);
  const batch = db.batch();
  for (const item of items) {
    if (!item || item.id == null) continue;
    batch.set(col.doc(String(item.id)), item, { merge: true });
  }
  await batch.commit();
  return items.length;
}

export async function clearUserHistory(uid, db = getAdminDb()) {
  for (const type of TYPES) {
    const snap = await userCol(db, uid, type).get();
    if (snap.empty) continue;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node __tests__/history-store.mjs`
Expected: PASS — `9 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add lib/history/store.js __tests__/history-store.mjs
git commit -m "Add server-side history store (Firestore admin)"
```

---

### Task 3: History API handlers (prod + dev)

**Files:**
- Create: `api/history.js` (prod Vercel)
- Create: `app/api/history+api.js` (dev Expo)

**Interfaces:**
- Consumes: `getUidFromAuth` (`lib/admin/auth.js`), `getUserHistory`/`upsertItems`/`clearUserHistory` (`lib/history/store.js`).
- Produces: `GET /api/history` → `{ itineraries, decisions }`; `POST /api/history` `{ type, items }` → `{ ok: true }`; `DELETE /api/history` → `{ ok: true }`. All `401` when unauthenticated.

- [ ] **Step 1: Create `api/history.js`**

```js
import { getUidFromAuth } from '../lib/admin/auth.js';
import { getUserHistory, upsertItems, clearUserHistory } from '../lib/history/store.js';

export default async function handler(req, res) {
  const uid = await getUidFromAuth(req.headers.authorization);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  try {
    if (req.method === 'GET') {
      return res.json(await getUserHistory(uid));
    }
    if (req.method === 'POST') {
      const { type, items } = req.body ?? {};
      await upsertItems(uid, type, items);
      return res.json({ ok: true });
    }
    if (req.method === 'DELETE') {
      await clearUserHistory(uid);
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('[api/history] failed:', e);
    return res.status(500).json({ error: 'history_failed', message: e.message });
  }
}
```

- [ ] **Step 2: Create `app/api/history+api.js`**

```js
import { getUidFromAuth } from '../../lib/admin/auth.js';
import { getUserHistory, upsertItems, clearUserHistory } from '../../lib/history/store.js';

async function requireUid(request) {
  const uid = await getUidFromAuth(request.headers.get('authorization'));
  return uid || null;
}

export async function GET(request) {
  const uid = await requireUid(request);
  if (!uid) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return Response.json(await getUserHistory(uid));
  } catch (e) {
    return Response.json({ error: 'history_failed', message: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const uid = await requireUid(request);
  if (!uid) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { type, items } = await request.json();
    await upsertItems(uid, type, items);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'history_failed', message: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const uid = await requireUid(request);
  if (!uid) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await clearUserHistory(uid);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'history_failed', message: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify both parse**

Run: `node --check api/history.js && node --check app/api/history+api.js`
Expected: no output, exit 0. (`node --check` is syntax-only; it does not resolve imports.)

- [ ] **Step 4: Commit**

```bash
git add api/history.js app/api/history+api.js
git commit -m "Add auth-gated /api/history handlers (GET/POST/DELETE)"
```

---

### Task 4: Client `historyService`

**Files:**
- Create: `services/historyService.js`

**Interfaces:**
- Consumes: `getApiBase` from `services/apiBase.js`; `auth` from `services/firebase`; `mergeById` from `lib/history/merge.js`.
- Produces:
  - `loadHistory()` → `{ itineraries, decisions }` from the AsyncStorage cache (instant/offline).
  - `saveItinerary(entry)` / `saveDecision(entry)` → stamp `updatedAt`, upsert into cache by `id`, best-effort `POST`. Returns the stamped entry.
  - `updateFeedback(type, id, feedback, feedbackReason)` → update cache item + best-effort `POST`.
  - `clearHistory()` → clear both caches + best-effort `DELETE`.
  - `syncHistory()` → `GET` server, `mergeById` with cache per type, write merged to cache, push local-only/newer up; returns merged `{ itineraries, decisions }`. Signed-out or network failure → returns the cache unchanged.

- [ ] **Step 1: Create `services/historyService.js`**

```js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase';
import { getApiBase } from './apiBase';
import { mergeById } from '../lib/history/merge.js';

const KEYS = { itineraries: '@decide/itineraries', decisions: '@decide/decisions' };
const CAPS = { itineraries: 50, decisions: 100 };
const TYPES = ['itineraries', 'decisions'];

async function authHeader() {
  try {
    const token = await auth.currentUser?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function readCache(type) {
  try { const raw = await AsyncStorage.getItem(KEYS[type]); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
async function writeCache(type, list) {
  try { await AsyncStorage.setItem(KEYS[type], JSON.stringify(list.slice(0, CAPS[type]))); } catch {}
}

export async function loadHistory() {
  const [itineraries, decisions] = await Promise.all([readCache('itineraries'), readCache('decisions')]);
  return { itineraries, decisions };
}

// best-effort POST upsert; silently no-ops when signed out or offline
async function postUpsert(type, items) {
  try {
    const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
    if (!headers.Authorization) return;
    await fetch(`${getApiBase()}/api/history`, {
      method: 'POST', headers, body: JSON.stringify({ type, items }),
    });
  } catch {}
}

async function upsertLocal(type, entry) {
  const stamped = { ...entry, updatedAt: Date.now() };
  const cache = await readCache(type);
  const idx = cache.findIndex((e) => e.id === stamped.id);
  const next = idx !== -1
    ? cache.map((e) => (e.id === stamped.id ? stamped : e))
    : [stamped, ...cache];
  await writeCache(type, next);
  postUpsert(type, [stamped]);
  return stamped;
}

export function saveItinerary(entry) { return upsertLocal('itineraries', entry); }
export function saveDecision(entry)  { return upsertLocal('decisions', entry); }

export async function updateFeedback(type, id, feedback, feedbackReason) {
  const cache = await readCache(type);
  const found = cache.find((e) => e.id === id);
  if (!found) return;
  const updated = { ...found, feedback, feedbackReason, updatedAt: Date.now() };
  await writeCache(type, cache.map((e) => (e.id === id ? updated : e)));
  postUpsert(type, [updated]);
}

export async function clearHistory() {
  await Promise.all([writeCache('itineraries', []), writeCache('decisions', [])]);
  try {
    const headers = await authHeader();
    if (headers.Authorization) await fetch(`${getApiBase()}/api/history`, { method: 'DELETE', headers });
  } catch {}
}

// Fetch server, merge with cache (newest wins), write merged to cache, push
// local-only/newer items up. Signed-out or any failure → returns cache unchanged.
export async function syncHistory() {
  const headers = await authHeader();
  if (!headers.Authorization) return loadHistory();
  let server;
  try {
    const res = await fetch(`${getApiBase()}/api/history`, { headers });
    if (!res.ok) return loadHistory();
    server = await res.json();
  } catch { return loadHistory(); }

  const merged = {};
  for (const type of TYPES) {
    const local = await readCache(type);
    const remote = Array.isArray(server?.[type]) ? server[type] : [];
    const m = mergeById(local, remote).slice(0, CAPS[type]);
    await writeCache(type, m);
    const remoteById = new Map(remote.map((r) => [r.id, r]));
    const toPush = m.filter((it) => {
      const r = remoteById.get(it.id);
      const s = (x) => (x?.updatedAt ?? x?.timestamp ?? 0);
      return !r || s(it) > s(r);
    });
    if (toPush.length) postUpsert(type, toPush);
    merged[type] = m;
  }
  return merged;
}
```

- [ ] **Step 2: Verify it parses**

Run: `node --check services/historyService.js`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add services/historyService.js
git commit -m "Add client historyService: cache + sync/merge over /api/history"
```

---

### Task 5: Wire writers and clear-data

**Files:**
- Modify: `app/(tabs)/plan.js` (itinerary save block, ~lines 457-480)
- Modify: `app/result.js` (decision save block, ~lines 57-78)
- Modify: `screens/SettingsScreen.js` (clear-data handler, the two `AsyncStorage.removeItem('@decide/decisions'|'@decide/itineraries')` calls near line 854-855)

**Interfaces:**
- Consumes: `saveItinerary`, `saveDecision`, `clearHistory` from `services/historyService`.

- [ ] **Step 1: Wire `app/result.js`**

Add import near the other imports:

```js
import { saveDecision } from '../services/historyService';
```

Replace the AsyncStorage read/build/write block inside `handleGo` (the `try { const raw = await AsyncStorage.getItem('@decide/decisions') ... setItem(...) }`) with the entry build + service call (keep the same entry fields):

```js
    try {
      const entry = {
        id:              `decision_${Date.now()}`,
        placeId:         place.placeId        ?? '',
        name:            place.name           ?? '',
        category:        place.category       ?? 'activity',
        emoji:           place.emoji          ?? '⚡',
        reason:          place.reason         ?? '',
        address:         place.vicinity       ?? place.address ?? '',
        rating:          place.rating         ?? 0,
        distance:        place.distance       ?? '',
        excitementScore: place.excitementScore ?? 0,
        timestamp:       Date.now(),
        feedback:        null,
        feedbackReason:  null,
      };
      await saveDecision(entry);
    } catch (e) {
      console.warn('[history] save decision error', e);
    }
```

(If `AsyncStorage` is now unused in `result.js`, remove its import; if still used elsewhere in the file, leave it.)

- [ ] **Step 2: Wire `app/(tabs)/plan.js`**

Add import near the other service imports (after `generateItinerary` import):

```js
import { saveItinerary } from '../../services/historyService';
```

Replace the itinerary-save `try { ... }` block (the one reading `@decide/itineraries`, building `entry`/updating `existing`, and calling `AsyncStorage.setItem('@decide/itineraries', ...)`) with an id-stable service call that preserves edit-in-place vs new:

```js
      try {
        const summary = (data.itinerary ?? []).map((s) => ({ name: s.name, category: s.category }));
        const id = asEdit && currentItineraryId ? currentItineraryId : `itinerary_${Date.now()}`;
        const entry = {
          id, timestamp: Date.now(), meta: data.meta, weather: data.weather,
          stops: summary, itinerary: data.itinerary ?? [], v: 2,
          feedback: null, feedbackReason: null,
        };
        setCurrentItineraryId(id);
        await saveItinerary(entry);
      } catch (e) {
        console.warn('[history] save itinerary error', e);
      }
```

Note: `saveItinerary` upserts by `id` in the cache, so an edit (same `currentItineraryId`) overwrites in place and a new plan prepends — matching the previous behavior. Leave the `@decide/itineraries` read in `plan.js:414-415` (landing preload) as-is; it reads the same cache the service writes.

- [ ] **Step 3: Wire `screens/SettingsScreen.js` clear-data**

Add import near the other service imports:

```js
import { clearHistory } from '../services/historyService';
```

In the clear-data confirm handler, replace the two history removes:

```js
                      AsyncStorage.removeItem('@decide/decisions'),
                      AsyncStorage.removeItem('@decide/itineraries'),
```

with a single call (leave any other `removeItem` calls in that `Promise.all` untouched):

```js
                      clearHistory(),
```

- [ ] **Step 4: Verify build**

Run: `npx expo export --platform web`
Expected: ends with `Exported: dist`.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/plan.js" app/result.js screens/SettingsScreen.js
git commit -m "Route itinerary/decision saves and clear-data through historyService"
```

---

### Task 6: Wire readers and sync-on-focus

**Files:**
- Modify: `app/(tabs)/history.js` (load in `useFocusEffect`, feedback handlers)
- Modify: `app/itinerary/[id].js` (read the itineraries cache via the service)

**Interfaces:**
- Consumes: `loadHistory`, `syncHistory`, `updateFeedback` from `services/historyService`.

- [ ] **Step 1: Wire `app/(tabs)/history.js` load + sync**

Add import:

```js
import { loadHistory, syncHistory, updateFeedback } from '../../services/historyService';
```

In the non-demo branch of the `useFocusEffect` loader, replace the two raw `AsyncStorage.getItem` reads + `setDecisions/setItineraries` with a cache-first load then background sync:

```js
        setIsDemo(false);
        const cached = await loadHistory();
        setDecisions(cached.decisions);
        setItineraries(cached.itineraries);
        // background reconcile with the cloud; refresh UI when it returns
        syncHistory().then((merged) => {
          setDecisions(merged.decisions);
          setItineraries(merged.itineraries);
        }).catch(() => {});
```

(The `demoRaw === 'true'` branch and the `catch { setDecisions([]); setItineraries([]); }` stay unchanged.)

- [ ] **Step 2: Wire `history.js` feedback handlers to the service**

`handleThumbsUp` and `applyFeedback` currently write the updated list back with `AsyncStorage.setItem('@decide/decisions'|'@decide/itineraries', ...)` guarded by `if (!isDemo)`. Keep the in-memory `setDecisions/setItineraries` updates for instant UI, but replace each `AsyncStorage.setItem(...)` persistence line with the service call so the change also syncs. For a decision toggle:

```js
      if (!isDemo) { updateFeedback('decisions', item.id, nextFeedback, null); }
```

and for an itinerary toggle:

```js
      if (!isDemo) { updateFeedback('itineraries', item.id, nextFeedback, null); }
```

In `applyFeedback` (the thumbs-down-with-reason path), after updating local state, persist via:

```js
      if (!isDemo) { updateFeedback(pendingType === 'decision' ? 'decisions' : 'itineraries', pendingItem.id, type, reason); }
```

(`updateFeedback` reads the cache, applies the change, writes it back, and best-effort POSTs — so the explicit `setItem` is no longer needed. Leave the optimistic `setDecisions/setItineraries` state updates in place.)

- [ ] **Step 3: Wire `app/itinerary/[id].js` read**

Replace the raw itineraries read. Change the import list to add the service and drop the direct itineraries fetch:

```js
import { loadHistory } from '../../services/historyService';
```

In the load effect, replace the `Promise.all([AsyncStorage.getItem('@decide/itineraries'), AsyncStorage.getItem('@decide/sensitivities')])` block with:

```js
        const [{ itineraries }, sensRaw] = await Promise.all([
          loadHistory(),
          AsyncStorage.getItem('@decide/sensitivities'),
        ]);
        const found = itineraries.find((e) => e.id === id);
        setSensitivities(sensRaw ? JSON.parse(sensRaw) : []);
        setEntry(found && Array.isArray(found.itinerary) && found.itinerary.length ? found : null);
```

(Keep the `AsyncStorage` import — it's still used for `@decide/sensitivities`.)

- [ ] **Step 4: Verify build**

Run: `npx expo export --platform web`
Expected: ends with `Exported: dist`.

- [ ] **Step 5: Manual verification (end-to-end)**

1. Sign in on web (`npx expo start --web`), generate an itinerary and make a quick-spin decision.
2. On a second device/browser signed in as the same user, open History and focus the tab → the itinerary and decision appear after `syncHistory()` returns.
3. Thumbs-rate an item on one device → after focusing History on the other, the rating reflects.
4. Settings → clear data → both lists empty on refresh; the other device empties after its next sync.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/history.js" "app/itinerary/[id].js"
git commit -m "Load history via service with sync-on-focus; sync feedback"
```

---

## Self-Review

**Spec coverage:**
- Server store + Firestore paths `users/{uid}/{type}/{id}` → Task 2. ✓
- Auth-gated GET/POST/DELETE, mirrored handlers, 401 on null uid → Task 3. ✓
- Client cache + `syncHistory` merge (migration + offline flush) → Tasks 1 (merge) + 4 (service). ✓
- `updatedAt` stamping + newest-wins conflict rule → Task 1 (`mergeById`) + Task 4 (`upsertLocal`/`updateFeedback`). ✓
- Wire all call sites (plan/result/settings writers; history/[id] readers) → Tasks 5–6. ✓
- Demo mode untouched → Tasks 5–6 keep the demo branch/guards. ✓
- Offline durability (cache-first, best-effort network) → Task 4 read/write + Task 6 load. ✓

**Type consistency:** `mergeById(local, remote)` (Task 1) used in `syncHistory` (Task 4). Store `getUserHistory/upsertItems(uid,type,items)/clearUserHistory` (Task 2) consumed by handlers (Task 3). Service `loadHistory/saveItinerary/saveDecision/updateFeedback(type,id,feedback,reason)/clearHistory/syncHistory` (Task 4) consumed by Tasks 5–6 with matching signatures. `type` is always `'itineraries'`/`'decisions'`. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Out of scope (per spec):** real-time `onSnapshot`, explicit offline write-queue, conflict UI — not in any task. ✓
