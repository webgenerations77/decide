# Implementation Plan — Sunset Guard

**Date:** 2026-07-24
**Spec:** `docs/superpowers/specs/2026-07-24-sunset-guard-design.md`
**Estimated size:** small (~half a day). Pure module + one wire-in + tests. No API twin edits,
no new dependencies, no Vercel function added.

**⚠ Blocking decision before Phase 2:** Open Question §9.1 — *correct-and-move vs flag-only*.
Phases below assume the recommended **correct-when-safe, flag-otherwise** posture. If the user
chooses flag-only, Phase 1 outcomes 2/3 collapse to "flag, never rewrite `time`" and the tests change
accordingly — otherwise the plan is identical.

---

## Phase 1 — Pure module + unit tests

**Files:** `lib/smart/sunsetGuard.js` (new), `lib/smart/sunsetGuard.test.mjs` (new)

1. `lib/smart/sunsetGuard.js`:
   - Private helpers (self-contained, no twin coupling):
     - `hhmmToMin("HH:MM") → number | null` — parse 24-hour sunset/sunrise.
     - `clockToMin("h:mm AM/PM") → number | null` — parse 12-hour stop time (mirror of the twins'
       `timeToMinutes`, but returns `null` on malformed input instead of `NaN`).
     - `minToClock(number) → "h:mm AM/PM"` — mirror of `minutesToTime`.
     - `SUNSET_RE`, `SUNRISE_RE`, `OUTDOOR_RE` — word-boundary keyword matchers (§5).
     - `GRACE = 30`.
   - `classify(stop)` → `'sunset' | 'sunrise' | 'outdoor' | null` (Tier A / Tier B detection).
   - `applySunsetGuard(stops, sun, ctx)`:
     - Guard clauses: non-array `stops` → return as-is; `sun?.sunset` unparseable → return `stops`
       untouched. Parse `windowStart`/`windowEnd` from `ctx.startTime`/`ctx.endTime`
       (fallback `11:00 AM`/`8:00 PM`).
     - Single forward pass with index so each stop knows `prevEnd` (prior stop's end, clamped ≥
       windowStart) and `nextStart` (next stop's start, or windowEnd if last).
     - Apply outcomes 1–4 from spec §6. **Never** mutate a `verified === true` stop's timing fields
       (verified wins — same guard `validateStops` uses).
     - Return a **new array** (map, don't mutate in place) so it's side-effect-free and idempotent.
     - Whole body in try/catch → return original `stops` on any error.
2. `lib/smart/sunsetGuard.test.mjs`: implement all 10 cases from spec §8 with `node:test` +
   `node:assert/strict`. Build small stop fixtures inline (only the fields the guard reads:
   `time`, `duration_mins`, `name`, `category`, `reason`, `verified`, `verify_source`).

**Verify:** `node --test lib/smart/sunsetGuard.test.mjs` → all pass.

**Commit:** `feat(smart): add pure sunsetGuard module + node:test coverage`

---

## Phase 2 — Wire into the engine

**File:** `lib/smart/index.js` (1-line import + apply after `runSynthesis`)

1. Import: `import { applySunsetGuard } from './sunsetGuard.js';` (allow a `deps.applySunsetGuard`
   override to match the module's existing dependency-injection test style, if index.js has tests
   that need it — otherwise import directly).
2. At line ~55, wrap the synthesis result:
   ```js
   let stops = await runSynthesis({ places, finds, anchors, ctx });
   stops = applySunsetGuard(stops, ctx.sun, ctx);
   if (!stops.length) return { ...empty, finds, anchors, hadLiveData, localHappenings };
   return { itinerary: stops, anchors, finds, hadLiveData, localHappenings };
   ```
3. No changes to `app/api/itinerary+api.js` or `api/itinerary.js` — they inherit via `runSmartEngine`.
   Confirm the function count is unchanged: `find api -name '*.js' | wc -l` still ≤ 12.

**Verify:** existing `lib/smart/index.test.mjs` still passes (`node --test lib/smart/index.test.mjs`).

**Commit:** `feat(smart): apply sunsetGuard to synthesized stops (both API twins)`

---

## Phase 3 — Build verify + manual QA

1. `npx expo export --platform web` → must print `Exported: dist` (per CLAUDE.md; `node --check` is
   not a valid check here).
2. Manual reproduction of the original bug. Easiest path is the **admin "Test loading screen"-style**
   flow or a real generate against a coastal location with a late-summer sunset (window default
   11 AM–8 PM, sunset ~20:15). Confirm:
   - A "sunset walk"-type stop no longer sits at 6 PM unflagged — it's either re-timed toward sunset
     or carries the "sunset isn't until 8:00 PM…" note.
   - A normal daytime stop is untouched (no spurious notes).
   - `time_note` renders on the StopCard (the field already flows through `validateStops` and the UI —
     no UI work needed; confirm it displays).
3. Note in the commit / BACKLOG whether on-device eyeball was done or is still pending (follow the
   repo's honesty convention — don't claim verified if only build-verified).

**Commit:** `docs: mark sunset-guard shipped in BACKLOG` (+ update `docs/superpowers/BACKLOG.md`)

---

## Rollout / risk

- **Blast radius:** one pure function on the synthesis output path. Fully fail-open — any parse
  problem returns stops untouched, so worst case is "no guard applied," never a broken itinerary.
- **No new env vars, no new deps, no new serverless function.**
- **Reversible:** delete the one-line call in `index.js` to disable instantly.
- **Follow-up (separate spec):** venue/event start-time verification widening (Ocean Downs case) —
  the other half of the timing-correctness work. Reference it from BACKLOG so it isn't lost.

---

## Task checklist

- [ ] Phase 1 — `sunsetGuard.js` + `sunsetGuard.test.mjs`, 10 cases green
- [ ] Phase 2 — wire into `lib/smart/index.js`, twins untouched, fn count ≤ 12
- [ ] Phase 3 — clean web export, manual repro of the 6 PM/8 PM bug, BACKLOG updated
- [ ] Confirm Open Question §9.1 posture with user before Phase 2
