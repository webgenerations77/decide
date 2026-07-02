# Design — Admins view beta testers' itineraries & decisions

**Date:** 2026-07-02
**Status:** Approved (design); ready for implementation plan
**Approach:** A (admin drill-in routes that reuse the real detail rendering)

## Goal

Let an admin, from a beta tester's admin detail page, see that tester's actual
**itineraries** (full stop-by-stop detail, exactly as the tester sees them) and
**decisions** (full record). Read-only. This extends the existing admin user-detail
screen, which today shows only activity *counts*.

## Non-goals (YAGNI)

- No pagination, search, or filtering (beta-scale data is small).
- No editing/deleting of tester records — read-only.
- No new user-facing behavior; the tester's own experience is unchanged.

## Current state (what already exists)

- `lib/history/store.js` → `getUserHistory(uid)` returns a user's full
  `{ itineraries, decisions }` from Firestore. Already used by `getUserStats`.
- `lib/admin/userStats.js` → `getUserStats(uid)` calls `getUserHistory(uid)` and
  returns counts only.
- API twins (both admin-guarded by `verifyAdminRequest`):
  - dev: `app/api/admin/users+api.js` (`Request`/`Response`)
  - prod: `api/admin/users.js` (`req`/`res`)
  - `GET ?uid=X` → `getUserStats`; `GET` (no uid) → user list; `POST` → set role.
- `services/adminApi.js` → `getUsers`, `getUsage`, `setUserRole`, `getUserStats`.
- `app/admin/user/[uid].js` → admin user-detail screen: Account, API usage, Activity
  counts (Itineraries/Decisions/Locations/cities). Fetches `getUsers`, `getUsage`,
  `getUserStats`.
- `app/itinerary/[id].js` → the tester-facing full itinerary detail: loads via
  `loadHistory()`, renders header + `ItineraryMeta` + `StopCard`s + `PlaceDetailModal`.
  Handles "older plan without saved stop data" with a graceful empty state.
- `app/(tabs)/history.js` → defines standalone (but not exported) components
  `ItineraryEntry` and `DecisionCard` (line ~70), each taking feedback handlers.

## Constraints

- **Vercel function cap: max 12 files under `api/`.** Adding a file freezes prod.
  New server capability MUST be a query branch on an existing `api/` handler, with
  logic in `lib/`. (This feature adds none — it reuses `getUserHistory`.)
- **API twins must stay in sync** — edit both `app/api/admin/users+api.js` and
  `api/admin/users.js`.
- Verify builds with `npx expo export --platform web` (not `node --check`).

## Architecture

```
/admin  →  tap user  →  /admin/user/[uid]
                          ├─ Account + API usage (as today)
                          ├─ Itineraries  → tappable rows → /admin/user/[uid]/itinerary/[id]
                          └─ Decisions    → full DecisionCard(s), read-only, inline
```

### 1. Backend — expose full history to admins

Add a query branch to the existing `GET /api/admin/users`:

- `GET /api/admin/users?uid=X&data=history` → `Response.json(await getUserHistory(X))`
  → `{ itineraries, decisions }` (full records).
- Existing `?uid=X` (no `data`) → unchanged (`getUserStats`).
- Apply to **both** twins (`+api.js` and `api/admin/users.js`), same
  `verifyAdminRequest` guard already present. Wrap in try/catch → 500
  `{ error: 'user_history_failed', message }` on failure.

No new `api/` file; `getUserHistory` already exists.

### 2. Client service

`services/adminApi.js`: add
```js
export async function getUserHistory(uid) {
  const res = await fetch(`/api/admin/users?uid=${encodeURIComponent(uid)}&data=history`,
    { headers: await authHeader() });
  if (!res.ok) throw new Error(`user_history_${res.status}`);
  return res.json(); // { itineraries, decisions }
}
```

### 3. Extract `ItineraryDetailView` (shared presentational component)

- New `components/itinerary/ItineraryDetailView.js`: the render body of
  `app/itinerary/[id].js`, taking props `{ entry, sensitivities }` instead of loading
  data. Owns the header, `ItineraryMeta`, `StopCard` list, and `PlaceDetailModal`.
  Includes the existing "full detail isn't saved for older itineraries" empty state
  (triggered when `entry.itinerary` is missing/empty).
- `app/itinerary/[id].js` becomes a thin wrapper: `loadHistory()` → find by `id` →
  load `@decide/sensitivities` → `<ItineraryDetailView entry={entry} sensitivities={…} />`.
  **No visual change for testers.**

### 4. Extract & generalize `DecisionCard`

- Move `DecisionCard` out of `app/(tabs)/history.js` into
  `components/history/DecisionCard.js`; import it back into `history.js` (no behavior
  change there).
- Add a `readOnly` prop: when true, hide the thumbs-up/down feedback row (admins don't
  rate a tester's decision). Default false preserves current history behavior.

### 5. Admin user-detail screen — add the two sections

`app/admin/user/[uid].js`:
- Replace the `getUserStats(uid)` call with `getUserHistory(uid)`, and derive the
  Activity counts (itineraries/decisions/distinct cities) client-side from the returned
  records — removes a redundant round-trip (getUserStats already re-fetches history).
- Add **Itineraries** section: one tappable row per itinerary showing
  day/date · city · stop count → `router.push('/admin/user/'+uid+'/itinerary/'+item.id)`.
  Empty state: "No itineraries yet."
- Add **Decisions** section: render each decision via `<DecisionCard item={d} readOnly />`.
  Empty state: "No decisions yet."

### 6. Admin itinerary detail route

New `app/admin/user/[uid]/itinerary/[id].js`:
- Read `uid` + `id` params; fetch `getUserHistory(uid)`; find itinerary by `id`.
- Render `<ItineraryDetailView entry={found} sensitivities={[]} />` with an admin back
  header (back → the tester's `/admin/user/[uid]`).
- States: loading spinner; not-found → "Itinerary not found"; older/no-stop-data →
  handled inside `ItineraryDetailView`.
- Re-fetches history rather than threading it through navigation (small, admin-only
  data). An in-memory cache is a possible later optimization, out of scope now.

## Data flow

1. `/admin/user/[uid]` mounts → `getUsers()` (resolve email/role), `getUsage(range)`,
   `getUserHistory(uid)`.
2. Renders Account, API usage, Activity counts (derived), Itineraries list, Decisions list.
3. Tap itinerary → `/admin/user/[uid]/itinerary/[id]` → `getUserHistory(uid)` → find by id
   → `ItineraryDetailView`.

## Error handling

- Non-admin request → 401 via existing `verifyAdminRequest`.
- Backend failure → 500 `{ error: 'user_history_failed' }`; client surfaces error text.
- Tester with no records → per-section empty states.
- Itinerary id not found / lacks saved stop data → not-found / "older itinerary" states.

## Testing / verification

- `npx expo export --platform web` must succeed ("Exported: dist").
- Manual: as admin, open a tester → confirm Itineraries + Decisions render; open an
  itinerary → confirm full stop-by-stop detail matches the tester's own view; confirm a
  non-admin is blocked; confirm empty states for a tester with no data.
- No unit-test harness in this project.

## Files touched

- `app/api/admin/users+api.js` — add `data=history` branch (dev twin)
- `api/admin/users.js` — add `data=history` branch (prod twin)
- `services/adminApi.js` — add `getUserHistory`
- `components/itinerary/ItineraryDetailView.js` — NEW (extracted)
- `app/itinerary/[id].js` — become thin wrapper over `ItineraryDetailView`
- `components/history/DecisionCard.js` — NEW (extracted from history.js) + `readOnly`
- `app/(tabs)/history.js` — import `DecisionCard` from new location
- `app/admin/user/[uid].js` — fetch full history; add Itineraries + Decisions sections
- `app/admin/user/[uid]/itinerary/[id].js` — NEW admin itinerary detail route
