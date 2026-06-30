# Backlog / Handoff — Decide

Snapshot at the close of the engine + brand-reskin work (all merged to `main`).
Start a fresh session and tackle items top-down. Source of truth for design tokens
is `constants/theme.js`; brand system is documented in `CLAUDE.md` (## Brand & Theme).

## Context (what's already shipped on `main`)
- **Smart Discovery & Synthesis Engine** — `api/smart/` (scout → registry/search discovery
  → anchors → Sonnet synthesis), wired into both `api/itinerary.js` (Vercel) and
  `app/api/itinerary+api.js` (Expo). Spec/plan: `docs/superpowers/specs|plans/2026-06-28-smart-discovery-synthesis-engine*`.
- **Brand re-skin** — light theme + `components/brand/` primitives (BrandLogo, ScreenBackground,
  Card, CTAButton, SectionLabel, GradientHeader) applied across all screens. Spec/plan:
  `docs/superpowers/*/2026-06-28-brand-reskin*`.
- Token discipline complete: no literal hex or `fontWeight` conflicts outside `theme.js`.
  Verify builds with `npx expo export --platform web` (no unit tests for RN styling).

---

## 1. Warm-text a11y pass  ✅ DONE (merged to `main` — branch `chore/a11y-warm-text`)
**Was:** `COLORS.amber`/`COLORS.gold` (#F4B63A) used as **text color** on light paper was
~2.5:1 contrast (below WCAG AA). 37 occurrences across 9 files. Fills/borders/badge backgrounds
were left as gold.

**What shipped:**
- New token `COLORS.goldText: '#8C6010'` (deep ochre) — ~5.3:1 on paper, ~4.9:1 on gold-tint
  badges (`gold + '22'`). Used for all non-interactive warm accents (eyebrows, pill/badge text,
  values, ratings, prices) — 29 spots. `gold` (#F4B63A) retained for fills/accents.
  *(Note: deeper than the originally-suggested `#9A6A12`, which sat right at 4.5:1 on paper with
  zero margin and dipped to ~4.2:1 on the gold-tint badges — `#8C6010` clears AA on both.)*
- Interactive text (links, back arrows, "Upgrade to Pro") → `COLORS.primary` (cobalt) — 7 spots.
  Wins on both contrast and link affordance.
- `history.js` `exciteText` sits on a **cobalt** tint (`primary + '33'`), not gold — warm text
  can't reach AA there, so it → `COLORS.primaryDark` (~7:1), matching its own badge.
- Verified with `npx expo export --platform web` (clean build). Not yet eyeballed in a running app.

## 2. Engine cost / robustness minors  ✅ DONE (merged to `main`)
- ✅ `api/smart/discovery.js` — `discoveryCache` now capped at 200 entries (evicts oldest on
  insert) and drops expired entries on read. Bounded both ways (TTL + size).
- ✅ `api/smart/index.js` — when `finds.length === 0` AND all Google places arrays are empty,
  the engine returns empty (skips the Sonnet synthesis call) so the caller builds the local
  fallback. Confirmed with user: avoids paying for a call that could only hallucinate venues.
  Synthesis still runs whenever places OR finds exist.
- ✅ `discoveryCacheKey` now dedupes interests via `Set`.

## 3. Trivia  ✅ DONE (merged to `main`)
- ✅ `components/brand/BrandLogo.js` — removed the unused `needleHi` prop from `Mark`.

## 4. Ops / housekeeping heads-ups (not code)
- **`origin/master`** still exists as a second remote branch alongside `origin/main` (the default).
  If it's a stale leftover, delete it; if intentional, ignore.
- **Vercel:** if it auto-builds `main`, this is live — confirm `FIRECRAWL_API_KEY` (cloud `fc-` key)
  is set in the Vercel project env (it's in local `.env`, which is gitignored).
- **⚠ SECURITY (deferred by user):** the live `FIRECRAWL_API_KEY` (`fc-110f…`) was committed to
  history (commit `3d3056f`, pushed to `origin/main` on GitHub) via a stray skill block in
  `CLAUDE.md`. Removed from the working tree (commit `27cb6ea`), but it remains in history and must
  be treated as compromised. **TODO when ready: rotate the key at firecrawl.dev → update `.env` +
  Vercel env.** Rotation neutralizes it; optional history scrub (filter-repo/BFG + force-push) only
  if desired afterward.

---

## 5. Beta tester access + feedback system  (NEW — full feature, needs RN adaptation + brainstorm before build)
Add one authorized beta tester (`dwaynephil@gmail.com`, role `beta_tester`) and a feedback
loop around them. Spec below is faithful to the request; **⚠ flags mark where the web-centric
spec must be adapted to this Expo/Firebase/expo-router app** — resolve these in a brainstorm
before implementing.

**⚠ Architecture reality check (do first):**
- No RBAC / authorized-user allowlist / user-profile DB exists today. Auth is Firebase
  (email + Google); "free vs pro" is the only tier and lives in AsyncStorage + `subscriptionService`.
- ⚠ Decide where `beta_tester` lives: simplest = a small allowlist map (email → role) in a new
  `constants/betaTesters.js` or `services/`, resolved against `firebase.auth().currentUser.email`.
  Centralize in ONE helper `isBetaTester(user)` / `useIsBetaTester()` hook. **Role check, never
  hardcode the email in UI logic.**
- ⚠ Two API-route locations: `api/*.js` (Vercel, prod) and `app/api/*+api.js` (Expo, inactive in
  dev due to `web.output: 'single'`). `/api/feedback` likely needs BOTH, like itinerary handlers.
- ⚠ No email provider currently in the project — Resend would be net-new. (Confirm: nothing else
  like SendGrid is wired. If found, ask before adding Resend.)

**Task 1 — Authorized beta tester user** → `feat: add dwaynephil@gmail.com as authorized beta tester`
- Add `dwaynephil@gmail.com` → role `beta_tester` to the (new) allowlist. Recognize `beta_tester`
  as a role; passes all normal auth checks (no restrictions). Expose role at session/context level.

**Task 2 — Persistent beta banner, all authenticated routes** → `feat: add beta tester banner to app shell`
- Implement in the shell (`app/_layout.js`, alongside existing demo + offline banners), NOT per-page.
- Visible only to `beta_tester`. Text: **"🧪 You're a Cheddar Beta Tester — thanks for helping us build something great!"**
- ⚠ Color: spec suggests amber `#F59E0B`, but **defer to `theme.js` tokens** — we have `gold`/`warning`
  (#F4B63A). Use a token; no raw hex (token discipline). Body font, medium/semibold.
- Dismissible **per session** (returns on next login/reload) via `×` on the right.

**Task 3 — Floating feedback button (beta only)** → `feat: add floating beta feedback button and modal`
- Fixed bottom-right (24/24). Pill, **"💬 Give Feedback"**, primary button style (`CTAButton` cobalt).
- Opens modal/drawer: Page/Feature (auto-filled w/ current route, editable) · Feedback Type dropdown
  (Bug Report · Feature Suggestion · General Impression · Something Felt Off) · Your feedback
  (textarea, required, placeholder "Tell us what you're thinking...") · Rating (optional 1–5 stars) ·
  submit **"Send to Cheddar HQ"**. POST to `/api/feedback`.

**Task 4 — `/api/feedback` + Resend email** → `feat: add /api/feedback endpoint with Resend email notification`
- Accept `{ page, feedbackType, message, rating, userEmail, timestamp }`; 400 if `message` empty.
- `npm install resend --legacy-peer-deps`. Add to `.env` + `.env.example`:
  `RESEND_API_KEY=` (`# Resend API key for beta feedback emails — get yours at resend.com`) and
  `FEEDBACK_RECIPIENT_EMAIL=` (`# Your email address to receive beta tester feedback`).
- From `cheddar-feedback@resend.dev` (sandbox) until a custom domain is set. ⚠ Server-side key only.
- Email subject `🧪 Beta Feedback — [feedbackType] on [page]`; body: from Dwayne, page/type/rating/
  timestamp + `---` + message.
- Success → `{ success: true }` + toast **"Feedback sent! Thanks Dwayne 🙌"**.
  Failure → `{ success: false, error }` + toast **"Hmm, that didn't go through. Try again?"**

**Task 5 — Audit & cleanup** → `chore: beta tester feature audit and cleanup`
- Verify banner + button are hidden for non-beta users and on unauthenticated/public routes
  (login, splash, ToS). Add the two env vars to `.env.example` / `decide.env.txt` reference + README.
- Scan new user-facing strings for any "AI" references (must say "Cheddar", never "AI").

---

## 5b. Beta feedback — production hardening  ✅ DONE (merged to `main` — branch `feat/feedback-hardening`, 2026-06-29)
Spec/plan: `docs/superpowers/{specs,plans}/2026-06-29-feedback-hardening*`. Final review clean (Yes-to-merge).

**What shipped (all gating lives in shared `api/feedbackEmail.js`; both handlers inherit it):**
- **Auth/rate-limiting** — shared-secret header (`x-feedback-secret`) via `gateFeedbackRequest`, which
  **fails open** when `FEEDBACK_SHARED_SECRET` is unset (dev/beta keep working). Length caps in
  `validateFeedback` (message ≤4000, fields ≤200 — reject, not truncate) + `rating` clamped to int 1–5
  or null. Best-effort in-memory rate limit (`checkFeedbackRate`, 5/10 min per key) with a bounded
  opportunistic sweep (evicts expired keys once the map exceeds 1000). Email body labels the
  client-supplied email/name as **unverified**. ⚠ Honest limits (accepted): the EXPO_PUBLIC client
  secret is bundle-extractable (raises the bar, not cryptographic); in-memory limit is per-warm-instance;
  with the secret set, all clients share one rate-limit bucket (fine for a single tester).
- **Configurable sender** — `from = process.env.FEEDBACK_FROM_EMAIL || 'onboarding@resend.dev'`. Verify a
  domain at resend.com, then set `FEEDBACK_FROM_EMAIL=feedback@<domain>` in Vercel + `.env` (no code change).
- **Cosmetic** — `BetaBanner` now hidden on `/beta-guide` (`app/_layout.js`), matching the feedback button.
- New env vars documented in `.env.example` (+ `.env`/`decide.env.txt` on disk): `FEEDBACK_FROM_EMAIL`,
  `FEEDBACK_SHARED_SECRET`, `EXPO_PUBLIC_FEEDBACK_SHARED_SECRET`. All blank by default (gate disabled).

**⚠ TODO when ready to enable the gate (user action, not code):** set `FEEDBACK_SHARED_SECRET` (server) +
`EXPO_PUBLIC_FEEDBACK_SHARED_SECRET` (client, **same value**) in Vercel env + local `.env`. Until then the
endpoint stays open (fail-open). And verify a Resend domain before emailing anyone but the account owner.

## 6. Full brand-consistency audit  ✅ DONE (branch `chore/brand-consistency`, 2026-06-29)
- **Audit clean:** verified no raw hex, no `fontWeight` conflicts, no raster logos in
  `app/screens/components`; all 14 screens use brand `ScreenBackground`. The reskin had already
  covered auth/onboarding/splash — the home page was the main gap.
- **Home/Plan landing** redesigned to mirror the sign-in screen: stacked `BrandLogo` hero + tagline,
  content in a `Card` (replaced the raster `logo-small.png`).
- **Native assets regenerated from the real compass mark:** `assets/icon.png` (white ring + orange
  north needle on navy `#102A4C`, 1024px) now backs icon/splash/Android adaptive icon/favicon, with
  navy splash/adaptive backgrounds. `assets/notification-icon.png` (monochrome white-on-transparent)
  for the notification icon. Notification accent → cobalt `#2563C9`. Old purple `logo-small.png` fully
  de-referenced from `app.json` (file kept but unused).
- ⚠ **Native icon/splash only appear after a new native build** (`eas build` / `expo prebuild`) — the
  web export/existing installed app won't show them.
- Icons rendered via `sharp` from the BrandLogo SVG (one-off script in scratch; `sharp` installed
  `--no-save`, not a project dep).
- **#2 Taste Profile** — onboarding additions + an always-editable "teach Cheddar" interests
  screen + storage, to give the engine's scout richer fuel than the current saved prefs + per-trip note.
- **#3 Discovery transparency** — surface *what* the engine found and *why* in the itinerary UI.
  (The engine already returns `discovery.{hadLiveData,findCount,anchors[]}` in the API response;
  the indicator line exists in `plan.js` but only shows the one-liner — #3 would surface the anchors.)
- **#4 Loading screen** — Lottie `loading.json` + rotating widgets (3-day weather [already in the
  wttr.in response], famous-birthday [free Wikimedia API], motivational quote [bundle locally]).
  ~$0 API cost. Needs `lottie-react-native` (not yet installed).

---

## 7. Dark mode + Settings improvements  ✅ SHIPPED (merged to `main` @ `62ca6f7`, 2026-06-30)
Spec/plan: `docs/superpowers/{specs,plans}/2026-06-30-settings-improvements*`. 16-commit branch
`settings-improvements`, subagent-driven, per-task reviews clean, opus whole-branch review "Yes-to-merge".
See memory [[project-theme-system]] for the styling convention.

**What shipped:**
- Real app-wide dark mode: `context/ThemeContext.js` (`useTheme()` → `{ mode, scheme, colors, setMode }`,
  Auto/Light/Dark, persisted via `KEYS.THEME_MODE`); `constants/theme.js` ships `LIGHT`/`DARK`/`PALETTES`.
  ~38 view files converted to `const styles = useMemo(() => makeStyles(colors), [colors])`. `COLORS` is now
  a `LIGHT` alias, **deprecated for styling** (data-layer category maps may still use it by design).
- Settings: new Appearance segmented control; reordered cards; Notifications "Coming Soon" + disabled
  (handlers retained inert); collapsible Subscription/Preferences/About (`components/brand/CollapsibleCard.js`,
  start collapsed, persisted in `KEYS.COLLAPSED_SECTIONS`). New `components/brand/Badge.js`.

**On-device QA — partial (2026-06-30):** ✅ user confirmed the **dark-mode toggle works** on-device
(light↔dark switch + the `hydrated` gate did not break startup). Still unverified: Auto follows an OS
appearance flip live; choice survives an app restart with no one-frame splash flash; the 3 collapsible
cards persist; the Location autocomplete dropdown renders un-clipped in both themes.

**Optional polish Minors (from final review)  ✅ DONE (branch `polish/dark-mode-minors`, 2026-06-30)**
Verified with `npx expo export --platform web` (clean build). Not yet eyeballed in a running app.
1. ✅ Cold-start theme flash — `context/ThemeContext.js` now gates the first render on a `hydrated` flag
   (set in the load effect's `.finally`); returns `null` until the saved mode is read, so the native/expo
   splash stays up and no wrong-scheme frame paints.
2. ✅ Dark hairline parity — added `scheme === 'dark'` hairline borders to the ad-hoc surfaces:
   `app/result.js` `PlaceCard` `card` and `BetaFeedback` `sheet`. (`app/fallback.js` `PlaceCard` already
   wraps the shared `Card`, so it inherited the border — no change needed. The old `fbCard`/`modalCard`
   style names in this note were stale.)
3. ✅ `components/itinerary/helpers.js` — `highlightConfig` is now `makeHighlightConfig(colors)` (theme-aware);
   `buzz` maps to `colors.textSecondary` (legible on dark `surfaceAlt`, unlike the old static `textMuted`).
   `PlaceDetailModal` memoizes it off `colors`.
4. ✅ `context/ThemeContext.js` `setMode` wrapped in `useCallback([])` and added to the value `useMemo` deps.
5. ✅ `screens/SettingsScreen.js` — retained-but-inert `handleNotif`/`handleReminderTime` annotated with
   `// eslint-disable-next-line no-unused-vars` + a comment so future linting won't flag them (kept for re-enable;
   note: project has no eslint config today, so this is pre-emptive).

**Deploy:** pushed to `origin/main`; live `https://decide-app.vercel.app` returns 200 (serves app login redirect),
so prod is not frozen. Confirm the `62ca6f7` deployment shows **Ready** in the Vercel dashboard (MCP token is
SAML-blocked from reading deployments headlessly). See [[project-vercel-deploy-gotchas]].
