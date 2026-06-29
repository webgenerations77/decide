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

## 1. Warm-text a11y pass  (recommended next — its own focused task)
**Problem:** `COLORS.amber`/`COLORS.gold` (#F4B63A) used as **text color** on the light paper
background is ~2.5:1 contrast (below WCAG AA). ~37 occurrences across 9 files. (Gold/amber as
*background, border, or badge fill* is fine — leave those.)

**Find them:** `grep -rn "color: *COLORS\.\(amber\|gold\)" app components screens --include=*.js`
Affected files: `app/(tabs)/history.js`, `app/(tabs)/plan.js`, `app/auth/{login,signup,forgot-password}.js`,
`app/fallback.js`, `app/paywall.js`, `app/result.js`, `screens/SettingsScreen.js`, `screens/SpinScreen.js`.

**Recommended approach:**
- **Interactive text** (links, back buttons/arrows, "Upgrade to Pro" links — e.g. `backTxt`,
  `linkText`, `tosLink`, `backArrow`) → `COLORS.primary` (cobalt). Wins on BOTH contrast and
  affordance (links should read as interactive/cobalt, not gold).
- **Non-interactive warm accents** (eyebrow labels, pill/badge text, values, ratings) → add a new
  AA-on-paper warm-text token to `theme.js`, e.g. `goldText: '#9A6A12'` (deep ochre, ~4.5:1 on
  `#FCF9F4`), and remap these. Keep `gold` (#F4B63A) for fills/accents.
- Re-check badge text that sits on a faint gold tint (e.g. `exciteText` on `COLORS.amber + '22'`):
  ensure the text token contrasts with the tint, not just paper.
- Verify with `npx expo export --platform web`; ideally eyeball key screens.
- Branch off `main` (e.g. `chore/a11y-warm-text`), then merge.

## 2. Engine cost / robustness minors
- `api/smart/discovery.js` — module cache `Map` has no eviction (unbounded growth in a
  long-running process). Add a max-size or TTL sweep.
- `api/smart/index.js` — Sonnet synthesis runs even when there are **0 finds** (and even on a
  transient scout failure). Cheap optimization: skip synthesis → go straight to
  `buildFallbackItinerary` when `finds.length === 0` AND Google places are empty. (Deliberate
  cost-vs-quality call — confirm intent.)
- `discoveryCacheKey` doesn't dedupe interests (`[...new Set(...)]` one-liner).

## 3. Trivia
- `components/brand/BrandLogo.js` — `Mark` has an unused `needleHi` prop; remove it.

## 4. Ops / housekeeping heads-ups (not code)
- **`origin/master`** still exists as a second remote branch alongside `origin/main` (the default).
  If it's a stale leftover, delete it; if intentional, ignore.
- **Vercel:** if it auto-builds `main`, this is live — confirm `FIRECRAWL_API_KEY` (cloud `fc-` key)
  is set in the Vercel project env (it's in local `.env`, which is gitignored).

---

## Not-yet-started sibling sub-projects (from the original decomposition)
- **#2 Taste Profile** — onboarding additions + an always-editable "teach Cheddar" interests
  screen + storage, to give the engine's scout richer fuel than the current saved prefs + per-trip note.
- **#3 Discovery transparency** — surface *what* the engine found and *why* in the itinerary UI.
  (The engine already returns `discovery.{hadLiveData,findCount,anchors[]}` in the API response;
  the indicator line exists in `plan.js` but only shows the one-liner — #3 would surface the anchors.)
- **#4 Loading screen** — Lottie `loading.json` + rotating widgets (3-day weather [already in the
  wttr.in response], famous-birthday [free Wikimedia API], motivational quote [bundle locally]).
  ~$0 API cost. Needs `lottie-react-native` (not yet installed).
