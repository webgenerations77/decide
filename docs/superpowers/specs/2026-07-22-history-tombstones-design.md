# Design — History Delete-Sync (clearedAt high-water mark)

**Date:** 2026-07-22
**Branch:** feat/history-tombstones
**Status:** design (autonomous — user unavailable, overnight execution per established pattern)

## Problem

Cross-device history sync (`services/historyService.js` `syncHistory` + `lib/history/merge.js`
`mergeById`) is a union merge with **no deletion tracking**. "Clear History" therefore does not
propagate across devices. Two concrete resurrection paths (whole-branch review findings I1/I2,
2026-06-30):

1. **Stale-cache re-push.** Device A clears history → server emptied, A's cache empty. Device B
   still holds old items in cache. B syncs: `mergeById(localB, server=[])` = B's items → written
   back to cache **and pushed to the server** (they're not on remote). Server repopulated. A's next
   sync pulls them back. The cleared items resurrect.
2. **Offline/failed DELETE.** A clear whose server `DELETE` fails (offline) empties the local cache,
   but the same device's next `syncHistory` pulls the still-present server items and repopulates.

The only deletion affordance today is a full **"Clear History"** wipe in `screens/SettingsScreen.js`
(`clearHistory()`), which deletes *both* `itineraries` and `decisions`. **There is no per-item
delete anywhere in the UI.**

## Approach chosen: `clearedAt` high-water mark

A single monotonic per-user timestamp `clearedAt` meaning *"every history item created/updated
strictly before this instant is deleted."* Clearing sets `clearedAt = now`. Merge drops any item
whose stamp (`updatedAt ?? timestamp`) is `< clearedAt`. `clearedAt` syncs like data (server-stored,
returned by GET, reconciled by `max`).

### Why not per-id tombstones (the originally-queued idea)

Per-id tombstones (record each deleted id + deletion timestamp; merge drops an id whose tombstone is
newer than its item) are the general solution and would support a future per-item delete for free.
But:

- **No per-item delete exists** — YAGNI. The only operation is clear-all.
- Tombstone storage grows unbounded (one row per ever-deleted item); needs GC.
- More merge surface and more sync payload.

For clear-all, a single `clearedAt` number is O(1) storage, trivially reconciled (`max`), and fully
correct. If per-item delete is added later, per-id tombstones can be layered on top **alongside**
`clearedAt` — the two compose (`clearedAt` = bulk cut, tombstones = point deletes). Documented as a
follow-up, not built now.

### Semantics: strict `<`

An item is dropped when `stamp < clearedAt` (survives when `stamp >= clearedAt`). Rationale:
resurrection items were always created **before** the clear (`stamp < clearedAt` → dropped); a genuinely
new item created after the clear has `stamp >= clearedAt` (sequential `Date.now()` calls → strictly
later in practice) → survives. Choosing strict `<` guarantees a brand-new item is **never**
accidentally dropped, prioritizing against data loss over the (theoretical, same-millisecond) collision.

## Components & changes

### 1. `lib/history/merge.js` — `mergeById(local, remote, clearedAt = 0)` (pure)
Add an optional third arg. After the existing union, filter out any item with `stamp(item) <
clearedAt`. Default `0` = no-op, so existing behavior and callers are unchanged. Stays pure and
node:test-covered.

### 2. `lib/history/store.js` — server data layer (pure-ish, Firestore)
- **`getUserHistory(uid, db)`** → also read `users/{uid}.historyClearedAt` and return it as
  `clearedAt` (default `0` if the doc/field is missing). Shape becomes
  `{ itineraries, decisions, clearedAt }`.
- **`clearUserHistory(uid, clearedAt, db)`** → becomes an **idempotent prune**: for each type, get
  docs and delete only those whose stamp (`updatedAt ?? timestamp`) is `< clearedAt`; then
  `users/{uid}.set({ historyClearedAt: max(existing, clearedAt) }, { merge: true })`. Writes **only**
  the `historyClearedAt` field (must not clobber `email`/`role`/`status`/`updatedAt` — those are the
  admin role doc, written elsewhere with merge). Re-running never deletes items newer than
  `clearedAt`, so it is safe as both the explicit clear and the sync self-heal.
  - Default `clearedAt` param to `now`-equivalent is not possible server-side without a clock arg;
    caller always passes an explicit `clearedAt`. If somehow absent, treat as "clear everything"
    is **wrong** — instead require it and no-op the delete when it's falsy (guard). The client
    always sends it.

### 3. API twins — `api/history.js` + `app/api/history+api.js` (keep in sync, **no new files**)
- **GET** returns whatever `getUserHistory` returns (now includes `clearedAt`) — no code change
  beyond passing it through (already returns the object verbatim).
- **DELETE** reads `clearedAt` from the request body and passes it to `clearUserHistory(uid,
  clearedAt)`. (Vercel `req.body`; Expo `await request.json()`.) Guard: if body is missing/unparseable,
  fall back to `clearedAt = 0` → prune deletes nothing and no high-water advance (safe no-op rather
  than nuking). Function count stays **12/12**.

### 4. `services/historyService.js` — client sync
- New cache key `@decide/history_cleared_at`; `readClearedAt()` / `writeClearedAt(ms)` helpers
  (numbers; malformed → `0`).
- **`clearHistory()`**: compute `clearedAt = Date.now()`; `writeClearedAt(clearedAt)`; empty both
  caches; best-effort `DELETE` with JSON body `{ clearedAt }` (Content-Type header added).
- **`syncHistory()`**:
  1. GET → `{ itineraries, decisions, clearedAt: serverCleared }`.
  2. `localCleared = await readClearedAt()`; `effective = Math.max(localCleared, serverCleared || 0)`.
  3. `await writeClearedAt(effective)`.
  4. Per type: `m = mergeById(local, remote, effective).slice(0, CAP)` — drops stale items so they are
     neither cached nor re-pushed (the `toPush` filter runs on the already-filtered list).
  5. If `localCleared > serverCleared`, best-effort `DELETE { clearedAt: localCleared }` to propagate
     the offline clear (prunes server + advances server high-water so other devices learn).

### 5. UI — no change
`SettingsScreen.js` already calls `clearHistory()`; behavior is transparent.

## Data flow (resurrection fixed)

- **Path 1:** A clears (localCleared=T, DELETE prunes server, server `historyClearedAt=T`). B syncs:
  GET returns `clearedAt=T`; `mergeById(localB, [], T)` drops B's pre-T items → cache empties, nothing
  pushed. Resurrection prevented.
- **Path 2 (offline clear):** A clears offline (localCleared=T, DELETE fails). A's next sync: GET
  `serverCleared=0`; `effective=T`; merge drops A's stale items; because `localCleared(T) >
  serverCleared(0)`, A re-issues `DELETE {clearedAt:T}` → server pruned + `historyClearedAt=T`. Self-heals.

## Error handling / fail-open
Every network op stays best-effort (existing `try/catch` → return cache). A failed GET returns cache
unchanged (existing). A failed DELETE leaves `localCleared` set, so the next successful sync re-propagates
(idempotent prune). No throw path reaches the UI.

## Testing (node:test, `lib/history/*.test.mjs`)
- `merge.test.mjs`: `mergeById` with `clearedAt` — drops `stamp < clearedAt`, keeps `stamp >=
  clearedAt`, boundary equality survives, resurrection scenario (local stale + empty remote + clearedAt
  ⇒ empty), default `clearedAt=0` is a no-op (existing behavior preserved).
- Pure reconciliation is `Math.max` (no dedicated test needed); store/Firestore paths validated by
  build + existing regression suite. `expo export --platform web` must stay green; `api/` stays 12/12.

## Out of scope (documented follow-ups)
- **Per-item delete + per-id tombstones** — no such affordance exists yet; layer on when it does.
- **`>cap` offline-creation loss** — oldest local-only items past the 50/100 cap can be evicted before
  ever being pushed (a push-ordering bug, orthogonal to deletion). Not addressed here.
- **Server GC of pruned-but-orphaned docs** — items older than `clearedAt` that a clearing device never
  held remain physically on the server until some device's prune sweeps them; harmless (clients filter),
  minor storage.

## Verify gate
`npx expo export --platform web` → "Exported: dist". Lib tests: `node --test lib/history/*.test.mjs`.
`node --check` is useless here (CLAUDE.md). Function cap: `find api -name '*.js' | wc -l` == 12.
