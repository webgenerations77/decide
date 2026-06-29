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
