# History Sync (Cloud) — Design

**Date:** 2026-06-30
**Status:** Approved (design); implementation pending

## Goal

Sync a user's history — **itineraries and decisions** — across their devices, and stop
losing it on reinstall. Today history is stored only in device-local AsyncStorage
(`@decide/itineraries`, `@decide/decisions`), so a plan made on the web/laptop never appears
on the phone, and a reinstall starts empty. Move the source of truth to the cloud while keeping
history **viewable offline**.

## Approach

**Server endpoints + local-first cache** (Approach A). AsyncStorage stays as the instant,
offline-durable store the UI reads from; the cloud (Firestore, accessed only server-side via
`firebase-admin`) is the cross-device source of truth. A single **merge-on-load** reconciliation
delivers migration, offline-write sync, and cross-device visibility from one mechanism.

Rejected: client-direct Firestore (Approach B) — it would require introducing and securing a
Firestore security-rules deployment pipeline (`firestore.rules` + `firebase.json` + Firebase
CLI), which the repo does not have today, and it still needs the AsyncStorage cache for durable
native offline. Approach A reuses the existing server-auth pattern (`getUidFromAuth`, the
`/api/admin/*` handlers) and keeps all DB access server-side.

Why not rely on Firestore's own offline cache: the Firebase **JS** SDK (this app's
`firebase` package) has only an in-memory Firestore cache on native React Native — not durable
across app restarts. AsyncStorage is the durable offline layer.

## Data model

Firestore, written only by the server (admin SDK):
- `users/{uid}/itineraries/{id}`
- `users/{uid}/decisions/{id}`

Items keep their existing shapes and ids (`itinerary_<ts>`; decision ids), with one added field
`updatedAt` (ms epoch) used for conflict resolution. `id` is the document id.

## Components

### 1. `lib/history/store.js` (new, shared, admin SDK)
- `getUserHistory(uid)` → `{ itineraries: [...], decisions: [...] }` (each ordered by `timestamp` desc).
- `upsertItems(uid, type, items)` — `type` is `'itineraries' | 'decisions'`; upserts each item by its `id` (batched).
- `clearUserHistory(uid)` — deletes all docs in both subcollections for the uid.
- Uses `getAdminDb()` from `lib/firebaseAdmin.cjs`. Pure logic (merge/validation) is separated so it can be unit-tested against a fake db.

### 2. Handlers — `api/history.js` (prod) + `app/api/history+api.js` (dev)
Mirrored, per the two-handler convention. Auth-gated: `const uid = await getUidFromAuth(<auth header>)`; if `uid` is null → `401 { error: 'unauthorized' }` (history requires sign-in, unlike the public itinerary endpoints).
- `GET /api/history` → `{ itineraries, decisions }` for the caller.
- `POST /api/history` body `{ type, items }` → `upsertItems`; returns `{ ok: true }`.
- `DELETE /api/history` → `clearUserHistory`; returns `{ ok: true }`.

### 3. `services/historyService.js` (new, client)
Cache keys reuse the existing `@decide/itineraries` and `@decide/decisions`. Attaches the
`Authorization: Bearer <idToken>` header via the same `auth.currentUser?.getIdToken()` helper
as `services/adminApi.js` / `services/itineraryService.js`.
- `loadHistory()` → reads both caches and returns immediately (instant/offline). Callers then
  call `syncHistory()` and re-read on its callback.
- `syncHistory()` → `GET /api/history`; read caches; **`mergeById`** each type (union by `id`,
  newest `updatedAt ?? timestamp` wins); `POST` the local-only/newer items back up; write the
  merged sets to cache. Returns the merged `{ itineraries, decisions }`. This one function is
  the migration (first sync pushes local-only history up) AND the offline-write flush. Best-effort:
  any network failure leaves the cache intact and the UI unaffected.
- `saveItinerary(entry)` / `saveDecision(entry)` — stamp `updatedAt`, write to the cache
  immediately, then best-effort `POST` upsert. `saveItinerary` preserves the existing behavior of
  updating an entry in place by `id` (edit flow) vs prepending a new one (cap 50).
- `updateFeedback(type, id, feedback, feedbackReason)` — update the item in cache + best-effort upsert.
- `clearHistory()` — clear both caches + `DELETE /api/history`.

### 4. Pure merge — `lib/history/merge.js` (new)
- `mergeById(localList, remoteList)` → array unioned by `id`, keeping the entry with the greater
  `updatedAt ?? timestamp ?? 0`; ordered by `timestamp` desc. No I/O — unit-tested.

## Call sites to wire
- `app/(tabs)/history.js` — load from `loadHistory()`, run `syncHistory()` on focus and refresh
  on its result; feedback thumbs → `updateFeedback`.
- `app/(tabs)/plan.js` — replace the direct `AsyncStorage.setItem('@decide/itineraries', …)`
  save (~lines 457-480) with `saveItinerary(entry)`.
- `app/result.js` — replace the direct `@decide/decisions` write with `saveDecision(entry)`.
- `app/itinerary/[id].js` — read via `loadHistory()` (cache) rather than raw AsyncStorage.
- Settings clear-data (`screens/SettingsScreen.js`) — call `clearHistory()` instead of the two
  `AsyncStorage.removeItem` calls.

## Data flow

```
save:  UI → historyService.saveItinerary(entry)
             → AsyncStorage cache (instant)  +  POST /api/history (best-effort)
load:  UI → loadHistory() → cache (instant render)
             → syncHistory(): GET server → mergeById(cache, server)
                → POST local-only/newer up → write merged to cache → callback → UI refresh
```

## Error handling
- Offline / server error on save → item is in the cache; synced on the next `syncHistory()`.
  UI never blocks on the network.
- `getUidFromAuth` null (not signed in) → endpoints `401`; client falls back to cache-only.
  The app already requires sign-in to reach these screens, so this is an edge case.
- **Demo mode** → unchanged; uses `DEMO_HISTORY`, never calls the service or the cloud.
- Merge conflict → last-write-wins by `updatedAt` (no conflict UI).
- **Clear History is device-local in this version.** Because `syncHistory` is a union merge with
  no deletion tracking, a clear does NOT reliably propagate across devices: another device's
  stale cache re-pushes its items on the next sync and resurrects them (and an offline/failed
  `DELETE` is repopulated on the next sync of the same device). Cross-device delete requires
  tombstones — see Out of scope. Users should treat "Clear History" as clearing the current
  device, not all devices.

## Testing
- **Unit (pure):** `__tests__/history-merge.mjs` — `mergeById` union, newest-wins on `updatedAt`,
  `timestamp` fallback, ordering, empty-list cases.
- **Unit (store):** `lib/history/store.js` logic against a fake `db` (batched upsert shape, clear).
- **Manual E2E:** sign in on web, generate an itinerary; open the phone, focus History → the
  itinerary appears. Rate it on one device → the rating reflects on the other after focus.

## Out of scope (later)
- Real-time push (`onSnapshot`), an explicit offline write-queue beyond merge-on-sync, and any
  conflict-resolution UI.
- **Tombstone-based delete-sync** — track deletions with timestamps so "Clear History" (and
  future per-item deletes) propagate across devices instead of being resurrected by a union
  merge. Also mitigates the >cap-offline-creation edge case (oldest local-only items past the
  cap can be dropped before being pushed). Queued as the next follow-up.
