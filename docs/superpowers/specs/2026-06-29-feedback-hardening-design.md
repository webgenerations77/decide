# Design — `/api/feedback` production hardening (Backlog #5b)

**Date:** 2026-06-29
**Branch:** `feat/feedback-hardening`
**Status:** Approved design → implementation plan next

## Context

The beta-tester feedback feature shipped on `main` (branch `feat/beta-tester-feedback`).
The final review flagged two production-only gaps, deliberately left out of beta scope, plus
one cosmetic nit. This spec closes all three **without adding new infrastructure**.

Current state:
- `api/feedback.js` (Vercel, prod) and `app/api/feedback+api.js` (Expo, inactive in dev) are
  thin handlers that both call `validateFeedback` → `sendFeedbackEmail` from the shared module
  `api/feedbackEmail.js`. No auth, no rate limit.
- `feedbackEmail.js` hardcodes `from: 'onboarding@resend.dev'` (Resend sandbox — only delivers
  to the account owner). `userEmail`/`userName` come straight from the client body (spoofable;
  there is no server-side identity).
- `app/_layout.js:136` renders `BetaBanner` on every non-public route, including `/beta-guide`.
  The floating feedback button (line 139) already excludes `/beta-guide`.

## Constraints / honest limitations (flagged with the user, accepted)

- **A shared secret shipped to a mobile client is not truly secret.** Anything with the
  `EXPO_PUBLIC_` prefix is baked into the JS bundle and extractable. The secret header raises
  the bar against casual abuse; it is not cryptographic protection.
- **In-memory rate limiting on serverless is best-effort.** State only persists within a warm
  instance; cold starts reset it. It stops obvious tight-loop spam, not a distributed attacker.
- **Domain verification is a user action.** Verifying a Resend sending domain is a DNS +
  dashboard task at resend.com — out of code scope. The design makes the sender configurable so
  flipping to a verified address is a one-line env change, no code change.

Worst case for this endpoint today is inbox spam to a single recipient — no data exposure — so
the user chose the **lightweight, zero-infra** protection tier. Durable KV rate limiting and
server-side Firebase token verification are explicitly out of scope.

## Part 1 — Abuse protection

All gating lives in the shared `api/feedbackEmail.js` so both handlers inherit identical
behavior. Three layers:

### 1a. Shared-secret header gate
- New exported helper `gateFeedbackRequest(secretHeader)` compares the incoming
  `x-feedback-secret` header value against `process.env.FEEDBACK_SHARED_SECRET`.
- **Fail-open when unset:** if `FEEDBACK_SHARED_SECRET` is empty/undefined, the gate passes
  (returns `{ ok: true }`). This keeps local dev and the current single-tester beta working
  untouched until the secret is provisioned.
- When set: missing or mismatched header → `{ ok: false }`. Handlers translate to HTTP `401`.
- Client (`services/feedbackService.js`) sends `x-feedback-secret:
  process.env.EXPO_PUBLIC_FEEDBACK_SHARED_SECRET` when that value is present.
- Inline comment notes the bundle-extractable caveat so a future reader understands the
  protection level.

### 1b. Length caps in `validateFeedback`
- Coerce all string fields to string, then cap: `message` ≤ 4000 chars, and
  `page`/`feedbackType`/`userEmail`/`userName` ≤ 200 chars each.
- Over-cap values are **rejected** with a 400-style error (not silently truncated), so garbage
  payloads never reach Resend. Returning an explicit error matches the existing
  "message is required" contract.
- Existing checks preserved: `message` required/non-empty; defaults for missing optional fields.

### 1c. Best-effort in-memory rate limit
- Module-level `Map<string, number[]>` of `key → timestamps`. Key = the secret value if present,
  else a caller identifier (IP from `x-forwarded-for` / request, falling back to a constant).
- Allow **5 sends per 10-minute sliding window**. Prune timestamps older than the window on each
  call. Over limit → `{ ok: false, limited: true }`; handlers translate to HTTP `429`.
- Exported as `checkFeedbackRate(key)`; honest inline comment that it is per-warm-instance only.

### Handler changes
Both `api/feedback.js` and `app/api/feedback+api.js` gain two early checks before
`sendFeedbackEmail`, in order:
1. `gateFeedbackRequest(...)` → on failure return `401 { success: false, error: 'unauthorized' }`.
2. `checkFeedbackRate(...)` → on failure return `429 { success: false, error: 'rate limited' }`.

Each handler reads the header/IP using its own request shape (`req.headers` for the Vercel
`req/res` handler; `request.headers.get(...)` for the Expo `Request` handler).

The email body labels the sender email/name as **claimed (unverified)** so the spoofability gap
is visible to whoever reads the feedback.

## Part 2 — Configurable Resend sender

- `feedbackEmail.js` `from` becomes `process.env.FEEDBACK_FROM_EMAIL || 'onboarding@resend.dev'`.
- Default preserves today's behavior. Once a domain is verified at resend.com, set
  `FEEDBACK_FROM_EMAIL=feedback@<domain>` in Vercel env + local `.env` — no code change.
- `.env.example` documents the verify-then-flip steps.

## Part 3 — Hide banner on `/beta-guide`

- `app/_layout.js:136` banner render gains `&& pathname !== '/beta-guide'`, matching the feedback
  button on line 139.

## Env additions

Added to `.env`, `.env.example`, and the `../decide.env.txt` reference:
- `FEEDBACK_SHARED_SECRET=` (server) — shared secret; **blank disables the gate**.
- `EXPO_PUBLIC_FEEDBACK_SHARED_SECRET=` (client) — must match the server value.
- `FEEDBACK_FROM_EMAIL=` — verified-domain sender; **blank falls back to the Resend sandbox**.

## Testing / verification

No RN unit-test harness exists in this project (consistent with prior backlog items). Verification:
- `npx expo export --platform web` must produce a clean build.
- Manual reasoning pass over gate / rate-limit / cap branches (fail-open when unset, reject when
  mismatched, 429 after limit, cap rejection).

## Out of scope (deliberate)

- Durable rate limiting (Vercel KV / Upstash Redis).
- Server-side Firebase ID-token verification (real sender identity).
- Actual Resend domain/DNS verification (user dashboard action).
