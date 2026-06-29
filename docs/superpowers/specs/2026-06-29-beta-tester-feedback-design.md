# Design — Beta Tester Access + Feedback System

**Date:** 2026-06-29
**Status:** Approved (brainstorm) — pending implementation plan
**Backlog item:** #5

## Goal

Add a single authorized beta tester (`dwaynephil@gmail.com`, role `beta_tester`) and a
feedback loop around them: a persistent beta banner, a floating feedback button + modal on
authenticated app routes, a `/api/feedback` endpoint that emails each submission via Resend,
and a beta guide ("wiki") the tester reads first to understand the app (auto-shown once on
first beta session, then always reachable from Settings).

The role check is **centralized and role-based** (never an inline email comparison) so adding
more testers later is a one-line change. The feature is purely **additive** — it grants no
special access and restricts nothing; it only shows extra UI to beta testers.

## Context / constraints (from the existing app)

- **Auth:** Firebase via `context/AuthContext.js` → `useAuth()` returns the raw Firebase `user`
  (has `.email`) plus `loading`. No roles/RBAC or user-profile DB exists today.
- **Shell:** `app/_layout.js` → `RootLayoutInner` renders `<Stack/>` and overlays absolute
  banners (`DemoBanner`, `OfflineBanner`). Auth guard redirects to `/auth/login` when `!user`.
- **Routing:** expo-router; `usePathname()` available for route-aware gating.
- **API:** `web.output: "single"` (SPA), so Expo Router `+api.js` routes do **not** run in
  production. **Production is Vercel serving `api/*.js` functions.** `api/itinerary.js` uses the
  Node `(req, res)` style; `app/api/*+api.js` use the Web `POST(request)` / `Response.json()`
  style. Itinerary ships both; this feature follows that dual pattern.
- **Client → API:** `services/itineraryService.js` pattern — `getApiBase()` (`''` on web,
  `http://<host>:8081` on native) + `fetch('/api/...')`.
- **Theme:** `constants/theme.js` is the single source of color tokens — **no raw hex in
  components** (token discipline). Fonts via `FONTS.*` (never `fontWeight` alongside a baked
  family). `CTAButton` (cobalt variant) is the primary button primitive.
- **Naming:** the assistant is **"Cheddar"** in all user-facing text — never "AI".
- **Resend:** sandbox only sends FROM `onboarding@resend.dev` and TO the Resend account's own
  email. Confirmed delivery target: `webgenerations77@gmail.com`. `RESEND_API_KEY` is **not yet
  in `.env`** — user will paste it.

## Decisions (resolved during brainstorm)

- **Email delivery:** Resend sandbox, `onboarding@resend.dev` → `FEEDBACK_RECIPIENT_EMAIL`
  (`webgenerations77@gmail.com`). Domain upgrade path noted for later, not built now.
- **Banner color:** new `COLORS.beta` token, a distinct **violet/indigo** so it reads as "beta,"
  not as the gold `warning` or cobalt `primary`. (Chosen over reusing `warning`.)
- **Personalization:** derive the tester's **first name** from the Firebase `displayName`
  (fallback: generic, e.g. "Thanks for the feedback 🙌") rather than hardcoding "Dwayne." Keeps
  copy correct as testers are added.
- **Banner dismissal:** per session via React state in the shell (returns on reload/relaunch);
  not persisted to AsyncStorage.
- **API:** build `api/feedback.js` (Vercel, prod) AND mirror `app/api/feedback+api.js` (dev parity).
- **Beta guide ("wiki"):** an **in-app** brand-styled scrollable screen (not an externally hosted
  wiki) — works offline, on-brand, no hosting. Auto-shown **once** on the first authenticated beta
  session (tracked via AsyncStorage `@decide/beta_guide_seen`), and always reachable from a
  beta-only entry in Settings.

## Architecture / components

### 1. Role plumbing (Task 1)
- **`constants/betaTesters.js`** — `export const BETA_TESTERS = { 'dwaynephil@gmail.com': 'beta_tester' }`
  (keys lowercased). Single place to add testers.
- **`utils/betaTester.js`** — `getRole(user)` returns the mapped role or `null`;
  `isBetaTester(user)` returns `getRole(user) === 'beta_tester'`. Email lookup is lowercased +
  trimmed. No email literal lives anywhere else.
- **`context/AuthContext.js`** — extend the context `value` with `role` and `isBetaTester`
  (derived from `user`), so it's available at the session/context level via `useAuth()`.

### 2. Beta banner + visibility gating (Task 2)
- **`components/BetaBanner.js`** — presentational, styled like `DemoBanner` (absolute, full
  width, height 32, `zIndex`, `✕` dismiss button, `safe-area` top inset). Background
  `COLORS.beta`; text `FONTS.bodySemiBold`. Copy:
  **"🧪 You're a Cheddar Beta Tester — thanks for helping us build something great!"**
- **`utils/betaRoutes.js`** (or a small helper in the shell) — `isPublicRoute(pathname)` →
  true for `/auth/*`, `/onboarding`, `/terms` (splash is pre-`ready`, already excluded).
- **Shell wiring** (`RootLayoutInner`): compute `showBeta = isBetaTester && !isPublicRoute(pathname)`
  and a session `betaBannerDismissed` state. Render `<BetaBanner/>` when `showBeta && !dismissed`.
  When both demo and beta banners show, **stack** them (beta `top` offset by the demo height).

### 3. Floating feedback button + modal (Task 3)
- **`components/BetaFeedback.js`** — renders only when `showBeta` (same gate). Contains:
  - Fixed bottom-right pill button (`bottom: 24, right: 24`), label **"💬 Give Feedback"**,
    cobalt `CTAButton` style.
  - A `Modal` with fields:
    - **Page / Feature** — `TextInput` pre-filled from `usePathname()`, editable.
    - **Feedback Type** — selectable pills: `Bug Report` · `Feature Suggestion` ·
      `General Impression` · `Something Felt Off` (RN has no native dropdown; pills match app).
    - **Your feedback** — required multiline `TextInput`, placeholder "Tell us what you're thinking...".
    - **Rating** — optional 1–5 star row (simple `TouchableOpacity` stars, `★`/`☆`).
    - Submit button **"Send to Cheddar HQ"** (disabled while message empty / submitting).
  - Lightweight in-component toast: success **"Feedback sent! Thanks {firstName} 🙌"**
    (fallback "Thanks for the feedback 🙌"); error **"Hmm, that didn't go through. Try again?"**.
- **`services/feedbackService.js`** — `submitFeedback({ page, feedbackType, message, rating })`
  posts to `/api/feedback` via the `itineraryService` pattern; attaches `userEmail` (from
  `useAuth().user.email`) and `timestamp` (ISO). Returns `{ success, error? }`.

### 4. API endpoint + Resend email (Task 4)
- **`api/feedback.js`** (Vercel, `(req,res)`) and **`app/api/feedback+api.js`** (Expo,
  `POST(request)`) — same logic, both styles. Shared body small enough to duplicate (matches
  the itinerary handlers, which duplicate rather than share across the api/ ↔ app/api boundary).
- Behavior:
  - Parse `{ page, feedbackType, message, rating, userEmail, timestamp }`.
  - Validate `message` non-empty (trimmed) → `400 { success:false, error }` if missing.
  - `new Resend(process.env.RESEND_API_KEY)`; send from `onboarding@resend.dev` to
    `process.env.FEEDBACK_RECIPIENT_EMAIL`.
  - On success → `{ success: true }`; on Resend/throw → `{ success: false, error }` (500).
- **Email format:**
  ```
  Subject: 🧪 Beta Feedback — [feedbackType] on [page]

  New feedback from [name] ([userEmail])

  Page: [page]
  Type: [feedbackType]
  Rating: [rating]/5 (omitted if not provided)
  Submitted: [timestamp]

  ---
  [message]
  ```
- **Dependency:** `npm install resend --legacy-peer-deps`.
- **Env:** add to `.env`, `.env.example`, and `decide.env.txt`:
  - `RESEND_API_KEY=` `# Resend API key for beta feedback emails — get yours at resend.com`
  - `FEEDBACK_RECIPIENT_EMAIL=` `# Your email address to receive beta tester feedback`
  - ⚠ Both are **server-side only** (no `EXPO_PUBLIC_` prefix). Also set in the Vercel project env.

### 5. Beta guide / "wiki" + Settings entry (Task 5)
- **`app/beta-guide.js`** — a brand-styled, scrollable guide screen (uses `ScreenBackground`,
  `Card`, `SectionLabel`, `GradientHeader`, `CTAButton`). Content sections:
  - *Welcome / what Cheddar is* — Cheddar decides where you go so you don't have to; the day-plan
    concept. (Voice: warm, never "AI".)
  - *The basics* — Decide (Plan tab: how a full-day itinerary is built), Quick Spin, History.
  - *Settings worth setting* — location mode, preferences/pace/budget, dietary + sensitivities.
  - *What we'd love you to test* — try a few cities/dates, swap stops, check the live "what's
    happening now" picks, push the edges.
  - *How to send feedback* — point at the floating "💬 Give Feedback" button + what makes a
    useful report (page, what you expected, what happened).
  - A closing `CTAButton` ("Got it — let's go") that marks the guide seen and calls `router.back()`
    — correct for both entry paths, since each **pushes** `/beta-guide` onto a real screen (Plan on
    auto-show, Settings on manual open).
- **Auto-show-once:** in `RootLayoutInner`, after the auth/onboarding redirect resolves to an app
  route, if `isBetaTester` and `AsyncStorage @decide/beta_guide_seen !== 'true'`, **push**
  `/beta-guide` (the screen writes the flag on dismiss). Never auto-shows again; non-beta users
  never see it. Does not interrupt the onboarding flow — only fires once the tester is on an app route.
- **Settings entry:** in `screens/SettingsScreen.js`, add a dedicated **beta-only "Beta" section**
  (rendered only when `useAuth().isBetaTester`) containing a row **"📖 Beta Tester Guide"** that
  pushes `/beta-guide`. The whole section is hidden for non-beta users.
- `/beta-guide` is treated as a beta/app route — the banner + feedback button gate already
  excludes only `/auth/*`, `/onboarding`, `/terms`; the guide may show the banner (fine) but to
  keep first-read clean we suppress the floating feedback button on `/beta-guide`
  (add it to the feedback-button's hidden-routes set).
- **Screenshots:** none bundled for v1 — the UI is actively changing during beta, so static
  screenshots would go stale and mislead, and the tester is in the live app while reading. Use
  non-staling visual cues instead (BrandLogo/`GradientHeader`, emoji + tab-name callouts, small
  on-brand mock cards). Real screenshots remain an easy later add (`assets/beta-guide/*.png` +
  `<Image>`). Final copy: **Appendix A**.

### 6. Audit & cleanup (Task 6)
- Confirm banner + button are **hidden** for a non-beta user and on public routes
  (`/auth/*`, `/onboarding`, `/terms`, splash).
- Confirm the Settings "Beta Tester Guide" row and the first-run auto-show are **absent** for a
  non-beta user, and that the guide auto-shows exactly **once** (flag respected).
- Add the two env vars to `.env.example` + `decide.env.txt` + README/secrets notes.
- Grep all newly added user-facing strings for "AI" / "artificial intelligence" — must be none
  (only "Cheddar").

## Data flow

```
Beta tester taps "💬 Give Feedback"
  → BetaFeedback modal collects { page, feedbackType, message, rating }
  → feedbackService.submitFeedback adds { userEmail, timestamp }
  → POST /api/feedback  (Vercel api/feedback.js in prod)
  → validate message → Resend send (onboarding@resend.dev → FEEDBACK_RECIPIENT_EMAIL)
  → { success } → toast in UI
```

## Error handling

- **Empty message:** client disables submit; server returns 400 as a backstop.
- **Resend failure / network error:** server returns `{ success:false, error }`; client shows the
  friendly error toast and keeps the modal open so the user can retry (input preserved).
- **Missing env (`RESEND_API_KEY`/recipient):** endpoint returns 500 with a clear error; surfaced
  as the error toast. (Documented as a setup prerequisite.)
- **Non-beta user / public route:** components never render — no client-side enforcement gap that
  matters since the endpoint only sends email (no data store); still, the UI gate is the control.

## Testing / verification

No unit-test harness for RN styling/UI in this repo (per project convention). Verify by:
- `npx expo export --platform web` — clean build (catches import/syntax errors incl. the Expo
  API route and Resend import).
- Manual: sign in as the beta email → guide auto-shows once on first session → banner + button
  appear on app routes, hidden on `/auth`,`/onboarding`,`/terms`; Settings shows the "Beta Tester
  Guide" row that re-opens the guide; submit feedback → success toast + email arrives at
  `webgenerations77@gmail.com`; empty message blocked; sign in as a non-beta user → nothing shows
  (no guide, no auto-show, no Settings row).
- `curl`/REST check of `/api/feedback` with empty `message` → 400; with valid body → 200 + email.

## File inventory

**New:**
- `constants/betaTesters.js`
- `utils/betaTester.js`
- `utils/betaRoutes.js` (or inline helper)
- `components/BetaBanner.js`
- `components/BetaFeedback.js`
- `services/feedbackService.js`
- `api/feedback.js`
- `app/api/feedback+api.js`
- `app/beta-guide.js` (the in-app guide / "wiki")

**Modified:**
- `constants/theme.js` (add `COLORS.beta`)
- `context/AuthContext.js` (expose `role`, `isBetaTester`)
- `app/_layout.js` (render gated banner + feedback button, banner stacking, auto-show guide once)
- `screens/SettingsScreen.js` (beta-only "Beta Tester Guide" row)
- `.env`, `.env.example`, `decide.env.txt`, README/secrets notes
- `package.json` / lockfile (`resend`)

## Out of scope (YAGNI)

- Persisting feedback to a database, an admin dashboard, or threaded replies.
- A general feature-flag / RBAC system (one boolean from auth is enough today).
- Verified custom email domain (sandbox suffices for one tester; upgrade path noted).
- Multi-tester management UI (allowlist edit is a code change).

## Appendix A — Beta guide copy (draft, final)

Cheddar's voice: warm, opinionated local friend. Never "AI". `[name]` = tester's first name
(fallback "friend"). Section headers map to `SectionLabel`/`Card` blocks on the screen.

> **Welcome to Cheddar 🧀**
>
> You're one of the very first people inside Decide — thanks for that. Here's the deal: tell me
> roughly what you're in the mood for, and I'll plan the whole day — where to eat, what to do, in
> what order, drive times sorted. No more standing around asking "so what do you want to do?"
> **We'll decide. You just go.**
>
> This takes two minutes to read. Then go break things.

> **Three ways to decide**
>
> - **🗺️ Plan** — the main event. Set your vibe — pace, budget, who's with you, a quick note like
>   "anniversary, we love seafood" — and I build a full day, stop by stop, with a reason for each
>   pick. Don't like one? Swap it and I'll find another.
> - **🎯 Quick Spin** — can't even commit to planning? Hit Spin and I'll throw you one solid pick
>   on the spot. Perfect for "just tell me where to eat."
> - **📜 History** — every day I've planned and every spin lands here, so you can pull up that
>   great taco place from last week.

> **Set yourself up first (2 min in Settings)**
>
> The more I know, the better the day. In **Settings**, set your **location**, your **default pace
> and budget**, and — this one matters — your **dietary needs and sensitivities**. Tell me you're
> vegetarian or allergic to shellfish and I'll plan around it every single time.

> **What I'd love you to test**
>
> - Plan a day in a few different places and dates — your hometown, then somewhere you're visiting.
> - Try a weird combo on purpose (packed pace + tight budget + a picky note) and see if I hold up.
> - Swap a stop or two — does the replacement actually make sense?
> - Watch for the **"what's happening right now"** picks — events and specials tied to your real
>   dates. Tell me when they land and when they're off.
> - Push the edges. The stuff that breaks is exactly what I need to hear about.

> **Found something? Tell me.**
>
> See the **💬 Give Feedback** button floating in the corner? Tap it anytime — it's on every
> screen. The most useful reports tell me three things: what screen you were on, what you expected,
> and what actually happened. Even "this just felt off" is genuinely useful — don't hold back.
>
> Thanks for helping shape this, **[name]**. Now go plan something.
> — Cheddar
>
> **[ Got it — let's go ]**

## Commits (one per task)

1. `feat: add dwaynephil@gmail.com as authorized beta tester`
2. `feat: add beta tester banner to app shell`
3. `feat: add floating beta feedback button and modal`
4. `feat: add /api/feedback endpoint with Resend email notification`
5. `feat: add beta tester guide screen with Settings entry and first-run auto-show`
6. `chore: beta tester feature audit and cleanup`
