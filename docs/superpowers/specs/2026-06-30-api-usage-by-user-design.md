# API Usage by User — Design

**Date:** 2026-06-30
**Status:** Approved (design); implementation pending

## Goal

Expand the admin **API Usage** card to attribute cost and request counts to individual
signed-in users. Primary goal: cost-per-end-user (budget / abuse monitoring). Request
counts come from the same aggregation for free. A per-user activity feed is explicitly a
fast-follow, out of scope here.

## Problem

`apiUsage` documents already carry a `userId` field, but **no call site ever passes it** —
every itinerary/swap request is logged with `userId: null`. The itinerary and swap API
endpoints are public (no auth header), so the server currently has no idea who made a call.

Two gaps to close:
1. **Capture** — get a trustworthy user identity onto each logged usage row.
2. **Aggregate + display** — bucket usage by user and surface it in the admin panel.

## Approach: request-scoped attribution via AsyncLocalStorage

Usage is logged from many places inside a single request: the direct `fetchPlaces` calls
(`places-nearby`, `places-searchtext`) and, inside `runSmartEngine`, the
scout / anchors / synthesis / events / liveMusic calls. Threading a `userId` parameter
through every one of those signatures is invasive and easy to get wrong.

Instead, stamp the uid **once** at the top of the request using Node's `AsyncLocalStorage`.
Every `logUsage` call within that async context reads the uid automatically. No smart-engine
internals change.

## Components

### 1. `lib/usageContext.js` (new)
Wraps a module-level `AsyncLocalStorage`.
- `runWithUser(userId, fn)` — runs `fn` inside a store carrying `{ userId }`.
- `currentUserId()` — returns the store's `userId`, or `null` outside any context.

### 2. `lib/usageLog.js` (edit)
`logUsage` defaults `userId` to `currentUserId()` when not passed explicitly:
`userId = userId ?? currentUserId()`. Explicit callers (none today) still win. Fire-and-forget
and error-swallowing behavior unchanged.

### 3. `lib/admin/auth.js` (new)
`getUidFromAuth(authHeader)` — extracts the bearer token (reuse `extractBearer`), verifies it
via the existing `getAdminAuth().verifyIdToken`, returns the `uid` on success or `null` on
any miss (no token, invalid token, admin unconfigured). **Never throws, never rejects** — the
itinerary endpoints stay public; unverifiable calls simply log `userId: null`.

### 4. Request handlers (4 files)
Prod: `api/itinerary.js`, `api/itinerary-swap.js`.
Dev: `app/api/itinerary+api.js`, `app/api/itinerary-swap+api.js`.

Each handler:
1. Reads the `authorization` header (`req.headers.authorization` for prod Node handlers;
   `request.headers.get('authorization')` for the dev Web handlers).
2. `const uid = await getUidFromAuth(authHeader)`.
3. Wraps the existing handler body in `runWithUser(uid, async () => { ... })`.

### 5. `services/itineraryService.js` (edit)
Attach `Authorization: Bearer <idToken>` to both `generateItinerary` and `swapStop`, using the
same `auth.currentUser?.getIdToken()` pattern as `services/adminApi.js`. Demo mode returns
early client-side and never hits the API, so it is unaffected.

### 6. `lib/admin/usage.js` (edit)
Add a `byUser` bucket to `aggregateUsage`, keyed by `row.userId` with `null` mapped to the
literal key `'anonymous'`. Same bucket shape as `byModel`/`byRoute`
(`requests`, `inputTokens`, `outputTokens`, `estCost`). `fetchUsage` returns it automatically,
so both admin endpoints expose it with no endpoint changes.

### 7. `app/admin/index.js` (edit)
New "By user" block inside the existing API Usage `Card`:
- Source `usage.byUser`; sort entries by `estCost` descending.
- Map `uid → email` from the already-loaded `users` list; unknown uids and `'anonymous'`
  render as "Anonymous".
- Each row: `email · {requests} req · {money(estCost)}`.

## Data flow

```
client (itineraryService) ──Bearer idToken──▶ handler
  handler: uid = getUidFromAuth(header)
  handler: runWithUser(uid, () => original work)
     └─ fetchPlaces / runSmartEngine / synthesis / ... 
          └─ logUsage(...)  ── userId defaulted from currentUserId() ──▶ apiUsage doc { userId }

admin panel ──Bearer idToken──▶ /api/admin/usage
  fetchUsage(range) ─▶ aggregateUsage(rows) ─▶ { totals, byModel, byRoute, byUser }
  app/admin: render byUser, uid→email via users list
```

## Error handling
- No/invalid token → `getUidFromAuth` returns `null` → usage logged as `'anonymous'`. Endpoints
  never reject on auth.
- `getIdToken()` failing client-side → request proceeds without the header → `'anonymous'`.
- `logUsage` remains fire-and-forget; attribution failure never affects the user response.

## Testing
- **Unit (pure):** extend the existing `aggregateUsage` test seam to cover `byUser` bucketing,
  including the `null → 'anonymous'` mapping and multi-user rows.
- **Manual:** run a real itinerary generation while signed in, then open the admin panel and
  confirm the cost/requests attribute to the signed-in user's email.

## Out of scope (fast follow)
- Per-user activity feed (timeline of recent calls per user) — needs raw rows, not aggregates.
