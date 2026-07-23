# History Delete-Sync (clearedAt) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Clear History" propagate across devices by adding a per-user monotonic `clearedAt` high-water mark that the sync merge honors, replacing the deletion-blind union merge.

**Architecture:** A single `clearedAt` timestamp per user means "every history item with stamp (`updatedAt ?? timestamp`) strictly before this instant is deleted." Clearing stamps it locally + on the server; `syncHistory` reconciles by `max`, `mergeById` drops stale items, and an offline clear self-heals by re-issuing an idempotent server prune. No per-id tombstones (YAGNI — no per-item delete exists). No new `api/` files.

**Tech Stack:** Expo SDK 56, plain ESM libs, Firestore (admin SDK, injectable `db`), node:test for pure/lib tests, AsyncStorage client cache.

## Global Constraints

- **VERCEL FUNCTION CAP: max 12 `.js` under `api/`.** This feature adds NONE. Check: `find api -name '*.js' | wc -l` == 12.
- **API twins MUST stay in sync:** prod `api/history.js` (req/res) + dev `app/api/history+api.js` (Request/Response). Edit both.
- **Verify builds with `npx expo export --platform web`** (success = "Exported: dist"). `node --check` is USELESS here.
- **Lib tests via node:test** (built-in), files `lib/history/*.test.mjs`. Run: `node --test lib/history/*.test.mjs`.
- `stamp(item)` = `item?.updatedAt ?? item?.timestamp ?? 0` everywhere (client, server, merge — keep identical).
- Drop semantics are **strict `<`**: item dropped when `stamp(item) < clearedAt`; survives when `>= clearedAt`.
- Module singletons that matter are unaffected here; no globalThis work needed.

---

### Task 1: `mergeById` clearedAt filter

**Files:**
- Modify: `lib/history/merge.js`
- Test: `lib/history/merge.test.mjs` (create)

**Interfaces:**
- Produces: `mergeById(localList = [], remoteList = [], clearedAt = 0)` — pure; unions by id (newer stamp wins, local wins ties), **drops any item with `stamp < clearedAt`**, returns list sorted by `timestamp` desc. Default `clearedAt = 0` ⇒ no-op filter (backward compatible).

- [ ] **Step 1: Write the failing test**

Create `lib/history/merge.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeById } from './merge.js';

test('mergeById unions by id, newer stamp wins (no clearedAt)', () => {
  const local = [{ id: 'a', timestamp: 1, updatedAt: 5 }];
  const remote = [{ id: 'a', timestamp: 1, updatedAt: 3 }, { id: 'b', timestamp: 2 }];
  const out = mergeById(local, remote);
  assert.equal(out.length, 2);
  assert.equal(out.find((x) => x.id === 'a').updatedAt, 5); // local newer wins
});

test('mergeById default clearedAt=0 drops nothing (backward compatible)', () => {
  const out = mergeById([{ id: 'a', timestamp: 10 }], [{ id: 'b', timestamp: 20 }]);
  assert.deepEqual(out.map((x) => x.id), ['b', 'a']);
});

test('mergeById drops items with stamp < clearedAt, keeps >=', () => {
  const items = [
    { id: 'old', timestamp: 100 },
    { id: 'boundary', timestamp: 200 },
    { id: 'new', timestamp: 300 },
  ];
  const out = mergeById(items, [], 200);
  assert.deepEqual(out.map((x) => x.id).sort(), ['boundary', 'new']); // old (100<200) dropped, boundary (200>=200) kept
});

test('mergeById uses updatedAt over timestamp for the cut', () => {
  const out = mergeById([{ id: 'a', timestamp: 100, updatedAt: 500 }], [], 200);
  assert.equal(out.length, 1); // stamp=500 >= 200, survives despite timestamp 100
});

test('mergeById resurrection scenario: stale local + empty remote + clearedAt => empty', () => {
  const staleLocal = [{ id: 'x', timestamp: 50 }, { id: 'y', timestamp: 60 }];
  const out = mergeById(staleLocal, [], 100);
  assert.deepEqual(out, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/history/merge.test.mjs`
Expected: FAIL — the `clearedAt` cases fail because the current `mergeById` ignores a third argument (nothing dropped).

- [ ] **Step 3: Write minimal implementation**

Replace `lib/history/merge.js` with:

```js
// Union two lists of history items by `id`, keeping the entry with the newer
// stamp (updatedAt preferred, then timestamp). Drops any item whose stamp is
// older than `clearedAt` (the delete high-water mark). Ordered by timestamp
// desc. Pure.
function stamp(item) {
  return item.updatedAt ?? item.timestamp ?? 0;
}

export function mergeById(localList = [], remoteList = [], clearedAt = 0) {
  const byId = new Map();
  // remote first, then local, so a local item wins ties (it is the just-saved copy).
  for (const item of [...remoteList, ...localList]) {
    if (!item || item.id == null) continue;
    if (stamp(item) < clearedAt) continue; // cleared before the high-water mark
    const existing = byId.get(item.id);
    if (!existing || stamp(item) >= stamp(existing)) byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/history/merge.test.mjs`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add lib/history/merge.js lib/history/merge.test.mjs
git commit -m "Add clearedAt filter to mergeById + node:test coverage"
```

---

### Task 2: `store.js` — idempotent prune + clearedAt read

**Files:**
- Modify: `lib/history/store.js`
- Test: `lib/history/store.test.mjs` (create — with an in-memory fake Firestore)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `getUserHistory(uid, db)` → `{ itineraries, decisions, clearedAt }` (`clearedAt` = `users/{uid}.historyClearedAt` or `0`).
  - `clearUserHistory(uid, clearedAt = 0, db)` → for each type, deletes only docs with `stamp < clearedAt`; then sets `users/{uid}.historyClearedAt = max(existing, clearedAt)` via merge-write. Guard: `clearedAt <= 0` ⇒ **no-op** (never nukes). Note the **new middle parameter** — the `db` injection moves to the 3rd position.

- [ ] **Step 1: Write the failing test**

Create `lib/history/store.test.mjs`. Includes a compact fake Firestore supporting the exact surface `store.js` uses (`collection().doc().collection().get()/doc().set()`, `db.batch()`, `db.collection('users').doc(uid).get()/set(...,{merge})`):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getUserHistory, clearUserHistory } from './store.js';

// ---- Minimal in-memory Firestore fake ----
function makeDb() {
  // tree: users/{uid} -> { fields, subs: { itineraries: {id: data}, decisions: {id: data} } }
  const users = new Map();
  const userNode = (uid) => {
    if (!users.has(uid)) users.set(uid, { fields: {}, subs: {} });
    return users.get(uid);
  };
  function docRef(uid) {
    const node = userNode(uid);
    return {
      get: async () => ({ exists: Object.keys(node.fields).length > 0, data: () => node.fields }),
      set: async (data, opts) => {
        node.fields = opts?.merge ? { ...node.fields, ...data } : { ...data };
      },
      collection: (type) => colRef(uid, type),
    };
  }
  function colRef(uid, type) {
    const node = userNode(uid);
    node.subs[type] ??= new Map();
    const store = node.subs[type];
    return {
      get: async () => {
        const docs = [...store.entries()].map(([id, data]) => ({
          id, data: () => data, ref: { __uid: uid, __type: type, __id: id },
        }));
        return { docs, empty: docs.length === 0 };
      },
      doc: (id) => ({
        set: async (data, opts) => {
          store.set(id, opts?.merge ? { ...(store.get(id) || {}), ...data } : { ...data });
        },
      }),
    };
  }
  return {
    collection: (name) => {
      assert.equal(name, 'users');
      return { doc: (uid) => docRef(uid) };
    },
    batch: () => {
      const ops = [];
      return {
        delete: (ref) => ops.push(['del', ref]),
        set: (ref, data, opts) => ops.push(['set', ref, data, opts]),
        commit: async () => {
          for (const op of ops) {
            if (op[0] === 'del') {
              const { __uid, __type, __id } = op[1];
              users.get(__uid).subs[__type].delete(__id);
            }
          }
        },
      };
    },
    _seed: (uid, type, items) => {
      const node = userNode(uid);
      node.subs[type] ??= new Map();
      for (const it of items) node.subs[type].set(String(it.id), it);
    },
    _fields: (uid) => userNode(uid).fields,
    _count: (uid, type) => (userNode(uid).subs[type]?.size ?? 0),
  };
}

test('getUserHistory returns clearedAt (default 0 when absent)', async () => {
  const db = makeDb();
  db._seed('u1', 'itineraries', [{ id: 'a', timestamp: 5 }]);
  const out = await getUserHistory('u1', db);
  assert.equal(out.clearedAt, 0);
  assert.equal(out.itineraries.length, 1);
  assert.deepEqual(out.decisions, []);
});

test('clearUserHistory prunes only docs older than clearedAt and sets high-water', async () => {
  const db = makeDb();
  db._seed('u1', 'itineraries', [
    { id: 'old', timestamp: 100 },
    { id: 'new', timestamp: 300 },
  ]);
  db._seed('u1', 'decisions', [{ id: 'd', timestamp: 100, updatedAt: 500 }]);
  await clearUserHistory('u1', 200, db);
  assert.equal(db._count('u1', 'itineraries'), 1); // 'old' (100<200) deleted, 'new' kept
  assert.equal(db._count('u1', 'decisions'), 1);   // stamp 500 >= 200, kept
  assert.equal(db._fields('u1').historyClearedAt, 200);
  const out = await getUserHistory('u1', db);
  assert.equal(out.clearedAt, 200);
  assert.deepEqual(out.itineraries.map((x) => x.id), ['new']);
});

test('clearUserHistory high-water is monotonic (max)', async () => {
  const db = makeDb();
  await clearUserHistory('u1', 500, db);
  await clearUserHistory('u1', 200, db); // lower — must not lower the mark
  assert.equal(db._fields('u1').historyClearedAt, 500);
});

test('clearUserHistory with clearedAt<=0 is a no-op (never nukes)', async () => {
  const db = makeDb();
  db._seed('u1', 'itineraries', [{ id: 'a', timestamp: 100 }]);
  await clearUserHistory('u1', 0, db);
  assert.equal(db._count('u1', 'itineraries'), 1);
  assert.equal(db._fields('u1').historyClearedAt, undefined);
});

test('clearUserHistory does not clobber existing user doc fields (role)', async () => {
  const db = makeDb();
  await db.collection('users').doc('u1').set({ role: 'beta_tester', email: 'x@y.z' }, { merge: true });
  await clearUserHistory('u1', 300, db);
  const f = db._fields('u1');
  assert.equal(f.role, 'beta_tester');
  assert.equal(f.email, 'x@y.z');
  assert.equal(f.historyClearedAt, 300);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/history/store.test.mjs`
Expected: FAIL — `getUserHistory` has no `clearedAt`; `clearUserHistory` old signature `(uid, db)` deletes everything and never writes `historyClearedAt`.

- [ ] **Step 3: Write minimal implementation**

Replace `lib/history/store.js` with:

```js
import { getAdminDb } from '../firebaseAdmin.cjs';

const TYPES = ['itineraries', 'decisions'];

function userDoc(db, uid) {
  return db.collection('users').doc(uid);
}
function userCol(db, uid, type) {
  return userDoc(db, uid).collection(type);
}
function stamp(item) {
  return item?.updatedAt ?? item?.timestamp ?? 0;
}
async function readClearedAt(db, uid) {
  const snap = await userDoc(db, uid).get();
  return (snap.exists ? snap.data()?.historyClearedAt : 0) ?? 0;
}

export async function getUserHistory(uid, db = getAdminDb()) {
  const out = {};
  for (const type of TYPES) {
    const snap = await userCol(db, uid, type).get();
    out[type] = snap.docs
      .map((d) => d.data())
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }
  out.clearedAt = await readClearedAt(db, uid);
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

// Idempotent prune: delete only docs older than `clearedAt`, then advance the
// per-user high-water mark. Safe to re-run (never deletes items newer than the
// cut). clearedAt <= 0 is a no-op so a bodyless DELETE can never nuke history.
export async function clearUserHistory(uid, clearedAt = 0, db = getAdminDb()) {
  const cutoff = Number(clearedAt) || 0;
  if (cutoff <= 0) return;
  for (const type of TYPES) {
    const snap = await userCol(db, uid, type).get();
    if (snap.empty) continue;
    const batch = db.batch();
    let n = 0;
    snap.docs.forEach((d) => {
      if (stamp(d.data()) < cutoff) { batch.delete(d.ref); n++; }
    });
    if (n) await batch.commit();
  }
  const existing = await readClearedAt(db, uid);
  await userDoc(db, uid).set({ historyClearedAt: Math.max(existing, cutoff) }, { merge: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/history/store.test.mjs`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add lib/history/store.js lib/history/store.test.mjs
git commit -m "store: clearUserHistory prunes by clearedAt + returns high-water in getUserHistory"
```

---

### Task 3: API twins — DELETE reads clearedAt, GET passes clearedAt through

**Files:**
- Modify: `api/history.js` (Vercel prod, req/res)
- Modify: `app/api/history+api.js` (Expo dev, Request/Response)

**Interfaces:**
- Consumes: `clearUserHistory(uid, clearedAt)`, `getUserHistory(uid)` (returns `{..., clearedAt}`).
- Produces: `DELETE` accepts JSON body `{ clearedAt }`; `GET` response includes `clearedAt`.

- [ ] **Step 1: Modify `api/history.js` (Vercel)**

Replace the DELETE branch (lines ~16-18) so it reads the body. Full file:

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
      const clearedAt = (req.body && typeof req.body === 'object') ? req.body.clearedAt : 0;
      await clearUserHistory(uid, clearedAt);
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('[api/history] failed:', e);
    return res.status(500).json({ error: 'history_failed', message: e.message });
  }
}
```

(GET already returns the object verbatim, so `clearedAt` flows through with no change.)

- [ ] **Step 2: Modify `app/api/history+api.js` (Expo)**

Replace the DELETE export so it parses the body:

```js
export async function DELETE(request) {
  const uid = await requireUid(request);
  if (!uid) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    let clearedAt = 0;
    try { ({ clearedAt } = await request.json()); } catch {}
    await clearUserHistory(uid, clearedAt);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'history_failed', message: e.message }, { status: 500 });
  }
}
```

(GET already returns `getUserHistory(uid)` verbatim → includes `clearedAt`. Leave GET/POST untouched.)

- [ ] **Step 3: Verify build + function count**

Run: `npx expo export --platform web`
Expected: ends with "Exported: dist" (no error).
Run: `find api -name '*.js' | wc -l`
Expected: `12`.

- [ ] **Step 4: Commit**

```bash
git add api/history.js app/api/history+api.js
git commit -m "history API twins: DELETE consumes clearedAt; GET carries high-water"
```

---

### Task 4: Client `historyService.js` — clearedAt cache, clear stamps it, sync reconciles + self-heals

**Files:**
- Modify: `services/historyService.js`

**Interfaces:**
- Consumes: `mergeById(local, remote, clearedAt)`; `GET /api/history` → `{ itineraries, decisions, clearedAt }`; `DELETE /api/history` body `{ clearedAt }`.
- Produces: `clearHistory()` stamps `@decide/history_cleared_at` + sends it; `syncHistory()` reconciles `clearedAt` (`max`), filters stale items, self-heals an offline clear.

- [ ] **Step 1: Add cache key + helpers**

In `services/historyService.js`, extend the `KEYS`/add helpers near the top (after `writeCache`):

```js
const CLEARED_KEY = '@decide/history_cleared_at';

async function readClearedAt() {
  try {
    const raw = await AsyncStorage.getItem(CLEARED_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch { return 0; }
}
async function writeClearedAt(ms) {
  try { await AsyncStorage.setItem(CLEARED_KEY, String(ms)); } catch {}
}
```

- [ ] **Step 2: Rewrite `clearHistory` to stamp + send clearedAt**

Replace the existing `clearHistory`:

```js
export async function clearHistory() {
  const clearedAt = Date.now();
  await writeClearedAt(clearedAt);
  await Promise.all([writeCache('itineraries', []), writeCache('decisions', [])]);
  try {
    const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
    if (headers.Authorization) {
      await fetch(`${getApiBase()}/api/history`, {
        method: 'DELETE', headers, body: JSON.stringify({ clearedAt }),
      });
    }
  } catch {}
}
```

- [ ] **Step 3: Rewrite `syncHistory` to reconcile, filter, and self-heal**

Replace the existing `syncHistory`:

```js
export async function syncHistory() {
  const headers = await authHeader();
  if (!headers.Authorization) return loadHistory();
  let server;
  try {
    const res = await fetch(`${getApiBase()}/api/history`, { headers });
    if (!res.ok) return loadHistory();
    server = await res.json();
  } catch { return loadHistory(); }

  const localCleared = await readClearedAt();
  const serverCleared = Number(server?.clearedAt) || 0;
  const effective = Math.max(localCleared, serverCleared);
  await writeClearedAt(effective);

  const merged = {};
  for (const type of TYPES) {
    const local = await readCache(type);
    const remote = Array.isArray(server?.[type]) ? server[type] : [];
    const m = mergeById(local, remote, effective).slice(0, CAPS[type]);
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

  // An offline/failed clear is ahead of the server — propagate it so the
  // server prunes and other devices learn (idempotent; only deletes < localCleared).
  if (localCleared > serverCleared) {
    try {
      await fetch(`${getApiBase()}/api/history`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ clearedAt: localCleared }),
      });
    } catch {}
  }
  return merged;
}
```

- [ ] **Step 4: Verify build**

Run: `npx expo export --platform web`
Expected: ends with "Exported: dist".

- [ ] **Step 5: Commit**

```bash
git add services/historyService.js
git commit -m "client sync: honor clearedAt high-water mark + self-heal offline clears"
```

---

### Task 5: Verify & finish branch

**Files:** none (verification + integration).

- [ ] **Step 1: Full lib test sweep**

Run: `node --test lib/history/*.test.mjs`
Expected: all pass (merge 5/5 + store 5/5). Also run the pre-existing smart tests to confirm no regression: `node --test lib/smart/*.test.mjs` → all pass.

- [ ] **Step 2: Build + function cap**

Run: `npx expo export --platform web` → "Exported: dist".
Run: `find api -name '*.js' | wc -l` → `12`.

- [ ] **Step 3: Whole-branch review**

Request code review (superpowers:requesting-code-review) over the branch diff vs `main`. Focus: no data-loss path (an item newer than the cut is never deleted), idempotency of the prune, twin parity (`api/history.js` ≡ `app/api/history+api.js` behavior), fail-open on every network op, and that `clearHistory`'s local stamp is written before the caches are emptied.

- [ ] **Step 4: Finish the branch**

Per `feedback-finish-branch-merge-and-push`: merge `feat/history-tombstones` to `main` locally (`--no-ff`), push `main`, push the branch. Then update the queued memory ([[project-history-tombstones]] → shipped) and the session log; note [[project-browser-back-nav]] is now unblocked.

---

## Self-Review

**Spec coverage:**
- clearedAt merge filter → Task 1 ✓
- server prune + high-water read/write → Task 2 ✓
- API twins DELETE body + GET passthrough → Task 3 ✓
- client stamp-on-clear + reconcile + self-heal → Task 4 ✓
- resurrection paths 1 & 2 → covered by Task 1 (merge drop) + Task 4 (self-heal) ✓
- strict `<` semantics → Global Constraints + Task 1/2 tests ✓
- no new `api/` files / 12-cap → Global Constraints + Task 3/5 checks ✓
- out-of-scope items (per-item tombstones, >cap loss, server GC) → intentionally excluded ✓

**Placeholder scan:** none — every code step shows full code; every run step shows exact command + expected output.

**Type consistency:** `stamp()` identical across merge.js/store.js/historyService inline `s()`; `clearUserHistory(uid, clearedAt, db)` signature consistent in store.js + both API twins + tests; `getUserHistory` returns `{itineraries, decisions, clearedAt}` consumed as `server.clearedAt` in client; `mergeById(local, remote, clearedAt)` 3-arg form used in Task 4. Consistent.
