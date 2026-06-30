# Admin Section — Design Spec

**Date:** 2026-06-30
**Batch:** Cheddar Bug Fixes & Features — Session 4 of 6, Task 11
**Status:** Approved design → ready for implementation plan

## Goal

A protected Admin dashboard at `/admin`, accessible only to `webgenerations77@gmail.com`,
with two sections: **API Usage** (token consumption, request counts, estimated cost by
day/week/month) and **User Administration** (list users, view/edit roles including
assigning/removing beta-tester status, view account status). Access is enforced on both
client and server. No admin navigation or UI is surfaced to non-admin users.

This is the "full backend" scope: introduce `firebase-admin` + Firestore, real usage
logging, and runtime-mutable roles.

## Context (current state)

- **Auth:** Firebase **client** SDK only (`services/firebase.js`). No Admin SDK, no Firestore, no DB.
- **Roles:** hardcoded map `constants/betaTesters.js` → `utils/betaTester.js` (`getRole`,
  `isBetaTester`) → `AuthContext` exposes `role` + `isBetaTester` via `useAuth()`.
  There is no literal `useIsBetaTester()` hook (the task brief's name was illustrative).
- **API routes:** stateless Vercel serverless. **Dual handler trees** — `api/*.js` (prod)
  and `app/api/*+api.js` (expo-router dev). Shared logic lives in `lib/`. Anthropic calls
  live in `lib/smart/*` (`synthesis.js` uses sonnet-4-6; `scout.js`/`anchors.js`/swap use
  haiku-4-5) and expose `msg.usage` (`input_tokens` / `output_tokens`).
- **No usage logging exists today** — it must be built.

## Decisions (locked)

1. **Backend scope:** full backend — `firebase-admin` + Firestore.
2. **API Usage data:** add lightweight usage logging now (real data going forward).
3. **Role migration:** beta-tester roles migrate to Firestore (`users/{uid}`), seeded once
   from the existing `betaTesters.js` map, which remains an offline fallback.
4. **Admin credentials:** split env fields — `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
   `FIREBASE_PRIVATE_KEY` (avoids JSON private-key newline-escaping issues on Vercel).

## Architecture

### 1. Role model

- **Admin (hardcoded, synchronous):** `constants/admins.js` → `ADMINS = { 'webgenerations77@gmail.com': 'admin' }`.
  `utils/admin.js` → `getAdminRole(user)`, `isAdmin(user)` (lowercased+trimmed email match,
  mirrors `utils/betaTester.js`). Admin gate is sync and never depends on a network read.
- **Beta-tester (Firestore, mutable):** `users/{uid}` document:
  `{ email, role: 'beta_tester' | null, status, updatedAt }`.
  - `services/rolesService.js` (client): `fetchUserRole(uid)` reads `users/{uid}`; falls back
    to the hardcoded `betaTesters.js` map if the read fails or the doc is absent.
  - Seeding (deterministic, lazy): `GET /api/admin/users` writes a `users/{uid}` doc for any
    hardcoded `betaTesters.js` entry that has a Firebase account but no Firestore doc yet.
    The map is retained as an offline read fallback in `rolesService.js`.
- **AuthContext:** add `isAdmin` (sync, from `utils/admin.js`) and make `role`/`isBetaTester`
  resolve from Firestore (async fetch on auth change, with the hardcoded fallback). Expose
  `useIsAdmin()` convenience hook. Loading state guarded so the gate doesn't flash.

### 2. Server-side enforcement

- `lib/firebaseAdmin.js` — initializes `firebase-admin` once (singleton) from the split env
  vars; `FIREBASE_PRIVATE_KEY` is `.replace(/\\n/g, '\n')`-normalized.
- Client attaches the Firebase ID token: `Authorization: Bearer <idToken>` on every
  `/api/admin/*` request (token from `auth.currentUser.getIdToken()`).
- `lib/admin/requireAdmin.js` — verifies the token via `admin.auth().verifyIdToken()`, checks
  the decoded email ∈ `ADMINS`. Returns the decoded token on success; throws/responds
  `401` (no/invalid token) or `403` (valid token, not admin) otherwise.
- Handlers are thin and mirrored in both `api/admin/*.js` (prod) and `app/api/admin/*+api.js`
  (dev); all real logic imported from `lib/admin/*`.

### 3. Usage logging

- `constants/pricing.js` — per-model Anthropic rates (per MTok input/output for
  haiku-4-5 and sonnet-4-6) and an estimated per-request Google Places cost. Clearly
  versioned/dated so estimates are auditable.
- `lib/usageLog.js` — `logUsage({ route, model, inputTokens, outputTokens, requests, userId })`
  computes cost from `constants/pricing.js` and writes an `apiUsage` doc:
  `{ ts, route, model, inputTokens, outputTokens, requests, estCost, userId }`.
  **Fire-and-forget** (never awaited in the request path; errors swallowed + warned) so it
  cannot slow or break a user response.
- Instrumented at the **shared** call sites so both handler trees get it for free:
  - Anthropic: `lib/smart/synthesis.js`, `lib/smart/scout.js`, `lib/smart/anchors.js`, and
    the swap call — log `msg.usage`.
  - Google Places: the shared nearby/text/details fetch sites — log request counts.

### 4. Admin API endpoints (`/api/admin/*`, mirrored both trees)

- `GET /api/admin/usage?range=day|week|month` → aggregates `apiUsage` for the range:
  total requests, input/output tokens, and est. cost broken down by model and by route.
  Aggregation done server-side in `lib/admin/usage.js`.
- `GET /api/admin/users` → `admin.auth().listUsers()` merged with Firestore `users/{uid}`
  role docs → `[{ uid, email, role, status, createdAt, lastSignIn }]`.
- `POST /api/admin/users/role` `{ uid, role }` → writes `users/{uid}.role`
  (grant/revoke `beta_tester`). The admin's own email cannot be demoted; admin role is not
  editable here (it lives in the hardcoded `ADMINS` map).
- All four guarded by `requireAdmin`.

### 5. `/admin` route + dashboard UI

- `app/admin/index.js` — gated by `useIsAdmin()`; non-admins `router.replace('/')`. Shows a
  brief loading state while auth resolves to avoid a redirect flash.
- **Entry point:** an admin-only card/link in Settings (`screens/SettingsScreen.js`),
  rendered only when `isAdmin`. No admin affordance anywhere for non-admins.
- **API Usage** section: range toggle (day/week/month) → cards/table of request counts,
  token totals, and cost breakdown by model + route. Numbers labeled with the pricing
  table's effective date.
- **User Administration** section: user list (email, status, role) with a toggle to
  grant/revoke beta-tester; admin row marked and locked. Optimistic update + refetch.
- All styling from `constants/theme.js` tokens and `components/brand/*` primitives; CTAs
  cobalt per brand rules (no orange buttons).

## Data flow

```
Client (admin) ──getIdToken()──▶ Authorization: Bearer
        │
        ▼
/api/admin/* handler ──requireAdmin()──▶ verifyIdToken + ADMINS check
        │ (200)                              │ (401/403)
        ▼                                     ▼
  lib/admin/{usage,users}                redirect / error
        │
        ▼
   Firestore (apiUsage, users)

Itinerary/spin request ─▶ lib/smart/* ─▶ Anthropic/Places ─▶ logUsage() ─▶ Firestore apiUsage
                                                              (fire-and-forget)
```

## Error handling

- Missing/invalid service-account env → `firebaseAdmin` init throws a clear error; admin
  endpoints return 500 with a logged message. Client UI shows a "server admin not
  configured" notice rather than crashing.
- `requireAdmin`: 401 (missing/expired token), 403 (not admin).
- Firestore role read failure (client) → fall back to hardcoded `betaTesters.js` map.
- `logUsage` failures never propagate to the user response.
- `/admin` UI: per-section load/empty/error states; never blank.

## Testing

- `utils/admin.js`: unit tests for `isAdmin` (case/whitespace, non-admin, null user).
- `lib/admin/requireAdmin.js`: missing token → 401, non-admin token → 403, admin → pass
  (mock `verifyIdToken`).
- `lib/usageLog.js`: cost computation from a known usage payload + pricing table; Firestore
  write mocked; failure is swallowed.
- `lib/admin/usage.js`: aggregation/grouping math over a fixed `apiUsage` fixture.
- `services/rolesService.js`: Firestore-present path and fallback-to-map path.
- Manual acceptance: `/admin` redirects a non-admin to home; renders for
  `webgenerations77@gmail.com`; granting beta status reflects in the user's gate.

## Dependencies / deploy

- New package: `firebase-admin` (install with `--legacy-peer-deps`).
- New env (local `.env` + Vercel): `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`. Document in `.env.example`. **User must supply the service account.**
- Firestore must be enabled on the Firebase project (collections: `users`, `apiUsage`).
- UI + client gate build and test without the service account; server endpoints require it.

## Out of scope

- RevenueCat/subscription admin (Phase 4, not wired).
- Backfilling historical usage (logging starts going forward).
- Editing admin membership from the UI (admins live in the hardcoded `ADMINS` map).
- Per-user usage attribution beyond `userId` on each log row.

## Build order

1. `firebase-admin` install + `lib/firebaseAdmin.js` + env wiring + `.env.example`.
2. `constants/admins.js` + `utils/admin.js` (+ tests).
3. Role migration: `services/rolesService.js`, `AuthContext` async role + `isAdmin` +
   `useIsAdmin()`, seed from `betaTesters.js`.
4. `lib/admin/requireAdmin.js` (+ tests).
5. `constants/pricing.js` + `lib/usageLog.js` (+ tests) + instrument shared call sites.
6. Admin API endpoints in both handler trees + `lib/admin/{usage,users}.js`.
7. `app/admin/index.js` dashboard UI + Settings admin-only entry point.
```
