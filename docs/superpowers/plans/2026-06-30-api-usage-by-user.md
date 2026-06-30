# API Usage by User Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attribute API usage (cost + request counts) to individual signed-in users and surface a per-user breakdown in the admin API Usage card.

**Architecture:** Stamp the caller's verified Firebase uid once per request using Node `AsyncLocalStorage`; every existing `logUsage` call inside that request reads the uid automatically (no smart-engine signature changes). Aggregate logged rows into a `byUser` bucket and render it in the admin panel, mapping uid→email from the already-loaded users list.

**Tech Stack:** Node `AsyncLocalStorage`, Firebase Admin (`verifyIdToken`), Firestore (`apiUsage` collection), Expo Router / Vercel API handlers, React Native (admin screen).

## Global Constraints

- This project has **no test framework**. Automated tests are standalone `.mjs` files using Node's built-in `assert`, run with `node <file>`. Do not add jest/vitest.
- ESM `.js` lib files run under plain `node` (a MODULE_TYPELESS_PACKAGE_JSON warning is expected and harmless).
- Two handler shapes exist and BOTH must be updated together: prod Vercel handlers `api/*.js` (`req.headers.authorization`, `res.json`) and dev Expo handlers `app/api/*+api.js` (`request.headers.get(...)`, `Response.json`). Vercel `api/` is production; the `+api.js` pair is inactive in dev but kept in sync.
- All client→API auth uses `auth.currentUser?.getIdToken()` and an `Authorization: Bearer <token>` header (match `services/adminApi.js`).
- Itinerary/swap endpoints MUST stay public — attribution never rejects a request. Unverifiable callers log `userId: null`, bucketed as `'anonymous'`.
- No hardcoded hex in components; use `useTheme()` colors and existing `makeStyles` patterns (`app/admin/index.js`).

---

### Task 1: `byUser` aggregation bucket

**Files:**
- Modify: `lib/admin/usage.js` (function `aggregateUsage`, lines 20-30)
- Test: `lib/admin/usage.test.mjs` (create)

**Interfaces:**
- Consumes: existing `emptyBucket()`, `add(bucket, row)` helpers in `lib/admin/usage.js`.
- Produces: `aggregateUsage(rows)` now returns `{ totals, byModel, byRoute, byUser }` where `byUser` is keyed by `row.userId`, with `null`/`undefined`/`''` mapped to the literal key `'anonymous'`. Each value has the bucket shape `{ requests, inputTokens, outputTokens, estCost }`.

- [ ] **Step 1: Write the failing test**

Create `lib/admin/usage.test.mjs`:

```js
import assert from 'node:assert/strict';
import { aggregateUsage } from './usage.js';

const rows = [
  { userId: 'u1', route: 'synthesis', model: 'claude-sonnet-4-6', requests: 0, inputTokens: 100, outputTokens: 50, estCost: 0.30 },
  { userId: 'u1', route: 'places-nearby', model: 'google-places', requests: 1, inputTokens: 0, outputTokens: 0, estCost: 0.02 },
  { userId: 'u2', route: 'synthesis', model: 'claude-sonnet-4-6', requests: 0, inputTokens: 200, outputTokens: 80, estCost: 0.50 },
  { userId: null, route: 'places-nearby', model: 'google-places', requests: 1, inputTokens: 0, outputTokens: 0, estCost: 0.02 },
];

const { byUser } = aggregateUsage(rows);

// u1 aggregates both of its rows
assert.equal(byUser.u1.requests, 1);
assert.equal(byUser.u1.inputTokens, 100);
assert.equal(byUser.u1.outputTokens, 50);
assert.ok(Math.abs(byUser.u1.estCost - 0.32) < 1e-9, `u1 estCost was ${byUser.u1.estCost}`);

// u2 is separate
assert.equal(byUser.u2.estCost, 0.50);

// null userId buckets under 'anonymous'
assert.equal(byUser.anonymous.requests, 1);
assert.equal(byUser.anonymous.estCost, 0.02);

// exactly the three expected keys
assert.deepEqual(Object.keys(byUser).sort(), ['anonymous', 'u1', 'u2']);

console.log('usage.test.mjs: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node lib/admin/usage.test.mjs`
Expected: FAIL — `TypeError: Cannot read properties of undefined (reading 'requests')` (because `byUser` is undefined).

- [ ] **Step 3: Implement the `byUser` bucket**

In `lib/admin/usage.js`, modify `aggregateUsage`:

```js
export function aggregateUsage(rows) {
  const totals = emptyBucket();
  const byModel = {};
  const byRoute = {};
  const byUser = {};
  for (const row of rows) {
    add(totals, row);
    (byModel[row.model] ??= emptyBucket()), add(byModel[row.model], row);
    (byRoute[row.route] ??= emptyBucket()), add(byRoute[row.route], row);
    const userKey = row.userId || 'anonymous';
    (byUser[userKey] ??= emptyBucket()), add(byUser[userKey], row);
  }
  return { totals, byModel, byRoute, byUser };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node lib/admin/usage.test.mjs`
Expected: PASS — `usage.test.mjs: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add lib/admin/usage.js lib/admin/usage.test.mjs
git commit -m "Add byUser bucket to usage aggregation"
```

---

### Task 2: Request-scoped user context + logUsage default

**Files:**
- Create: `lib/usageContext.js`
- Modify: `lib/usageLog.js` (function `logUsage`, lines 12-23)
- Test: `lib/usageContext.test.mjs` (create)

**Interfaces:**
- Produces: `lib/usageContext.js` exports `runWithUser(userId, fn)` — runs `fn` (sync or async) inside an `AsyncLocalStorage` store carrying `{ userId }`, returns `fn`'s result/promise — and `currentUserId()` — returns the store's `userId`, or `null` when called outside any `runWithUser`.
- Consumes (in Task 4): handlers call `runWithUser(uid, async () => { ...existing body... })`.
- Effect: `logUsage` defaults its `userId` to `currentUserId()` when no explicit `userId` is passed.

- [ ] **Step 1: Write the failing test**

Create `lib/usageContext.test.mjs`:

```js
import assert from 'node:assert/strict';
import { runWithUser, currentUserId } from './usageContext.js';

// Outside any context → null
assert.equal(currentUserId(), null);

// Inside context → the uid, including across an await boundary
const result = await runWithUser('user-123', async () => {
  assert.equal(currentUserId(), 'user-123');
  await Promise.resolve();
  assert.equal(currentUserId(), 'user-123');
  return 'done';
});
assert.equal(result, 'done');

// Context does not leak after it returns
assert.equal(currentUserId(), null);

// null uid is allowed and reads back as null
await runWithUser(null, async () => {
  assert.equal(currentUserId(), null);
});

console.log('usageContext.test.mjs: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node lib/usageContext.test.mjs`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `./usageContext.js`.

- [ ] **Step 3: Implement `lib/usageContext.js`**

```js
import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

// Run fn within a context carrying the caller's userId. logUsage calls made
// anywhere inside fn (including across awaits) attribute to this user.
export function runWithUser(userId, fn) {
  return storage.run({ userId: userId ?? null }, fn);
}

// The userId for the current request, or null outside any runWithUser scope.
export function currentUserId() {
  return storage.getStore()?.userId ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node lib/usageContext.test.mjs`
Expected: PASS — `usageContext.test.mjs: all assertions passed`

- [ ] **Step 5: Wire the default into `logUsage`**

In `lib/usageLog.js`, add the import at the top (after the existing imports):

```js
import { currentUserId } from './usageContext.js';
```

Change the `logUsage` signature default and the stored `userId`. Replace the signature line:

```js
export function logUsage({ route, model, inputTokens = 0, outputTokens = 0, requests = 0, userId } = {}) {
```

and inside the `try`, before `db.collection(...)`, resolve the effective user:

```js
    const estCost = computeCost({ model, inputTokens, outputTokens, requests });
    const effectiveUserId = userId ?? currentUserId();
    const db = getAdminDb();
    db.collection('apiUsage').add({
      ts: Date.now(),
      route, model, inputTokens, outputTokens, requests, estCost, userId: effectiveUserId,
    }).catch((e) => console.warn('[usageLog] write failed:', e.message));
```

(Removing the old `userId = null` default is required so an unset `userId` falls through to `currentUserId()`.)

- [ ] **Step 6: Commit**

```bash
git add lib/usageContext.js lib/usageContext.test.mjs lib/usageLog.js
git commit -m "Add request-scoped user context; default logUsage userId from it"
```

---

### Task 3: `getUidFromAuth` token helper

**Files:**
- Create: `lib/admin/auth.js`
- Test: `lib/admin/auth.test.mjs` (create)

**Interfaces:**
- Consumes: `extractBearer` from `lib/admin/requireAdmin.js`; `getAdminAuth` from `lib/firebaseAdmin.cjs`.
- Produces: `getUidFromAuth(authHeader)` — async; returns the verified Firebase `uid` string, or `null` for any failure (no/garbled header, invalid token, admin unconfigured). Never throws.

- [ ] **Step 1: Write the failing test**

Create `lib/admin/auth.test.mjs` (covers only the no-token path, which never touches Firebase):

```js
import assert from 'node:assert/strict';
import { getUidFromAuth } from './auth.js';

assert.equal(await getUidFromAuth(undefined), null);
assert.equal(await getUidFromAuth(null), null);
assert.equal(await getUidFromAuth(''), null);
assert.equal(await getUidFromAuth('NotBearer xyz'), null);

console.log('auth.test.mjs: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node lib/admin/auth.test.mjs`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `./auth.js`.

- [ ] **Step 3: Implement `lib/admin/auth.js`**

```js
import { extractBearer } from './requireAdmin.js';
import { getAdminAuth } from '../firebaseAdmin.cjs';

// Best-effort identity extraction for otherwise-public endpoints. Verifies the
// Firebase ID token and returns its uid, or null on any miss. Never throws —
// callers use it for usage attribution only and must not reject on failure.
export async function getUidFromAuth(authHeader) {
  const token = extractBearer(authHeader);
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded?.uid ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node lib/admin/auth.test.mjs`
Expected: PASS — `auth.test.mjs: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add lib/admin/auth.js lib/admin/auth.test.mjs
git commit -m "Add getUidFromAuth: best-effort uid from bearer token"
```

---

### Task 4: Wire all four handlers to attribute usage

**Files:**
- Modify: `app/api/itinerary+api.js` (function `POST`, lines 354-362 and the closing brace of the try body)
- Modify: `app/api/itinerary-swap+api.js` (its `POST` handler)
- Modify: `api/itinerary.js` (its `handler(req, res)`)
- Modify: `api/itinerary-swap.js` (its `handler(req, res)`)

**Interfaces:**
- Consumes: `getUidFromAuth` (Task 3), `runWithUser` (Task 2).
- Produces: every `logUsage` call made during a request now carries the caller's uid (or `null`). No response-shape changes.

**Pattern — dev Web handlers (`app/api/*+api.js`)** — add imports, then wrap the body:

```js
import { getUidFromAuth } from '../../lib/admin/auth.js';
import { runWithUser } from '../../lib/usageContext.js';
```

```js
export async function POST(request) {
  const uid = await getUidFromAuth(request.headers.get('authorization'));
  return runWithUser(uid, async () => {
    // ... entire existing try/catch body unchanged ...
  });
}
```

**Pattern — prod Vercel handlers (`api/*.js`)** — add imports (note the one-level-shallower path), then wrap:

```js
import { getUidFromAuth } from '../lib/admin/auth.js';
import { runWithUser } from '../lib/usageContext.js';
```

```js
export default async function handler(req, res) {
  const uid = await getUidFromAuth(req.headers.authorization);
  return runWithUser(uid, async () => {
    // ... entire existing handler body unchanged ...
  });
}
```

- [ ] **Step 1: Update `app/api/itinerary+api.js`**

Add the two imports at the top. Wrap the existing `POST` body: insert the `uid`/`runWithUser` lines immediately inside `POST`, and indent the existing `try { ... } catch { ... }` block inside the `runWithUser` callback. Do not change any logic inside.

- [ ] **Step 2: Update `app/api/itinerary-swap+api.js`**

Same dev-handler pattern. Imports use `../../lib/...`. Wrap the existing `POST` body in `runWithUser(uid, async () => { ... })`.

- [ ] **Step 3: Update `api/itinerary.js`**

Prod pattern. Imports use `../lib/...`. Wrap the existing `handler` body in `runWithUser(uid, async () => { ... })`, returning its result.

- [ ] **Step 4: Update `api/itinerary-swap.js`**

Prod pattern. Imports use `../lib/...`. Wrap the existing `handler` body.

- [ ] **Step 5: Sanity-check the files parse**

Run: `node --check app/api/itinerary+api.js && node --check app/api/itinerary-swap+api.js && node --check api/itinerary.js && node --check api/itinerary-swap.js`
Expected: no output, exit 0 (all four parse).

Note: `node --check` validates syntax only. It does not resolve imports, so it passes even though these modules import RN/Expo-only code.

- [ ] **Step 6: Commit**

```bash
git add app/api/itinerary+api.js app/api/itinerary-swap+api.js api/itinerary.js api/itinerary-swap.js
git commit -m "Attribute itinerary/swap usage to the requesting user"
```

---

### Task 5: Send the ID token from the client

**Files:**
- Modify: `services/itineraryService.js` (functions `generateItinerary` lines 16-45, `swapStop` lines 47-62)

**Interfaces:**
- Consumes: `auth` from `services/firebase.js` (same import `services/adminApi.js` uses).
- Produces: both itinerary requests carry `Authorization: Bearer <idToken>` when a user is signed in; unchanged behavior when signed out (no header).

- [ ] **Step 1: Add the auth-header helper and import**

At the top of `services/itineraryService.js`, add:

```js
import { auth } from './firebase';
```

Add a helper (mirrors `adminApi.js`):

```js
async function authHeader() {
  try {
    const token = await auth.currentUser?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
```

- [ ] **Step 2: Attach the header in `generateItinerary`**

Change the fetch headers from `{ 'Content-Type': 'application/json' }` to merge the auth header:

```js
  const res  = await fetch(`${base}/api/itinerary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ latitude, longitude, date, preferences: { ...preferences, activityStyles, dietary, neurodivergent }, startTime, endTime, feedback, maxDistanceMiles, tripNote }),
  });
```

- [ ] **Step 3: Attach the header in `swapStop`**

```js
  const res  = await fetch(`${base}/api/itinerary-swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ itinerary, stopIndex, latitude, longitude }),
  });
```

- [ ] **Step 4: Sanity-check it parses**

Run: `node --check services/itineraryService.js`
Expected: no output, exit 0.

- [ ] **Step 5: Commit**

```bash
git add services/itineraryService.js
git commit -m "Send Firebase ID token with itinerary requests"
```

---

### Task 6: Render "By user" in the admin API Usage card

**Files:**
- Modify: `app/admin/index.js` (API Usage `Card`, lines 114-128; add a small helper near `money`, line 23)

**Interfaces:**
- Consumes: `usage.byUser` (Task 1 shape); the already-loaded `users` array (`{ uid, email, ... }`) from `getUsers()`.
- Produces: a "By user" list under the existing "By route" list, rows sorted by `estCost` desc, each showing `email · {requests} req · {money(estCost)}`. Unknown uids and `'anonymous'` render as "Anonymous".

- [ ] **Step 1: Add a uid→label resolver**

In `app/admin/index.js`, inside `AdminScreen` (after `users` is available), add a memoized email lookup:

```js
  const emailByUid = useMemo(() => {
    const m = {};
    (users || []).forEach((u) => { m[u.uid] = u.email; });
    return m;
  }, [users]);

  const userLabel = (uid) => (uid === 'anonymous' ? 'Anonymous' : (emailByUid[uid] || 'Anonymous'));
```

- [ ] **Step 2: Render the By-user rows**

In the usage `Card`, immediately after the existing "By route" block (the `Object.entries(usage.byRoute)...` line), add:

```jsx
              <Text style={styles.subhead}>By user</Text>
              {Object.entries(usage.byUser || {})
                .sort((a, b) => (b[1].estCost || 0) - (a[1].estCost || 0))
                .map(([uid, b]) => (
                  <Row key={uid} label={userLabel(uid)} value={`${b.requests} req · ${money(b.estCost)}`} />
                ))}
```

- [ ] **Step 3: Verify it parses**

Run: `node --check app/admin/index.js`
Expected: no output, exit 0 (JSX note: if `node --check` rejects JSX, skip this step — the file is RN/JSX and is validated by Metro, not Node).

- [ ] **Step 4: Manual verification (end-to-end)**

1. `cd decide-app && npx expo start --web`
2. Sign in, generate an itinerary on the DECIDE screen.
3. Open the admin panel (Settings → Admin) as an admin user.
4. Confirm the API Usage card shows a "By user" section with your email and a non-zero request count / cost.

- [ ] **Step 5: Commit**

```bash
git add app/admin/index.js
git commit -m "Show per-user breakdown in admin API Usage card"
```

---

## Self-Review

**Spec coverage:**
- Capture identity → Tasks 3 (verify token), 4 (wire handlers), 5 (client sends token). ✓
- Request-scoped attribution (AsyncLocalStorage) → Task 2. ✓
- `byUser` aggregation incl. `null → anonymous` → Task 1. ✓
- Admin display, uid→email, sorted by cost → Task 6. ✓
- Endpoints stay public / never reject → `getUidFromAuth` returns null (Task 3), handlers don't gate on it (Task 4). ✓
- Out of scope: activity feed — not in any task, as intended. ✓

**Type consistency:** `runWithUser(userId, fn)` / `currentUserId()` (Task 2) used verbatim in Task 4. `getUidFromAuth(authHeader)` (Task 3) used verbatim in Task 4. `byUser` bucket shape `{ requests, inputTokens, outputTokens, estCost }` (Task 1) consumed in Task 6. `authHeader()` local helper distinct from handler usage. ✓

**Placeholder scan:** No TBD/TODO; all code steps show full code. ✓
