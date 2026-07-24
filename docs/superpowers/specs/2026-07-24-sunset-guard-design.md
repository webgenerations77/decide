# Design Spec — Sunset Guard

**Date:** 2026-07-24
**Status:** Proposed
**Sibling feature:** Verified Times (`lib/smart/verifyTimes.js`, shipped 2026-07-22). This spec
reuses that feature's defensive contract and extends the same "timing correctness" goal.

---

## 1. Problem

The synthesis model (Sonnet) is handed the **real local sunset time** (Open-Meteo → `ctx.sun.sunset`)
and an explicit prompt rule to anchor outdoor/sunset/scenic/walk stops to it (`synthesis.js` line 57).
It does not reliably obey. Observed in a real itinerary:

> A "sunset walk" scheduled at **6:00 PM** while the stop's own description states **sunset is 8:00 PM**.

The model had the correct fact, wrote it into its own copy, and still scheduled the stop two hours off.
This is a **prompt-compliance failure**, and the fix for that class of bug is deterministic validation
of the model's output — not more prompt text.

This is the sunset half of the broader "bad timing" report. The event/venue start-time half
(e.g. Ocean Downs harness racing scheduled at 5 PM when first post is 6:40 PM) is a **separate spec**
(venue-verification widening) and is explicitly out of scope here.

## 2. Goal

A pure, deterministic post-synthesis pass that catches sunset-anchored stops whose scheduled time
contradicts the real sunset, and either **corrects** the time (when provably safe) or **flags** it
(when correcting would corrupt the day's sequence). Must only ever improve timing — never reorder
the day, never throw, never downgrade a correctly-timed stop.

## 3. Non-goals

- **Not** a full day re-cascade. We do not shift every subsequent stop to keep the timeline gap-free
  (that's a v2 concern and touches drive-time recomputation). We correct at most the one stop, within
  its existing neighbors' bounds, or we flag.
- **Not** event/venue start-time verification (Ocean Downs case) — sibling spec.
- **Not** applied to the local **fallback itinerary** (`buildFallbackItinerary`) — it's deterministic
  template output with no model-invented sunset stops, so there's nothing to guard.
- **Not** a weather/"golden hour photography" quality feature — purely a correctness guard.

---

## 4. Data facts (verified against current code)

| Thing | Format | Source |
|---|---|---|
| `ctx.sun.sunset` / `ctx.sun.sunrise` | 24-hour `"HH:MM"` local, e.g. `"20:12"`, or `null` | `lib/itineraryHelpers.js` `localTime()`; may be `null` beyond the 7-day forecast |
| Stop `time` | 12-hour `"h:mm AM/PM"`, e.g. `"6:00 PM"` | Synthesis output; same format as `ctx.startTime`/`endTime` |
| Window | `ctx.startTime`→`ctx.endTime`, both `"h:mm AM/PM"` (default `11:00 AM`→`8:00 PM`) | `itinerary+api.js` |
| Stop `duration_mins` | integer minutes (default 60) | `validateStops` |
| Stop order | array is already time-ordered as emitted by synthesis | `runSynthesis` |

Note the format mismatch: **sunset is 24h, stop times are 12h.** The guard normalizes both to
*minutes-since-midnight* before comparing. Existing `timeToMinutes`/`minutesToTime` helpers live
inside each API twin (duplicated, not exported); the guard module carries its own tiny pure parsers
to avoid coupling to either twin. (De-duping those into `lib/itineraryHelpers.js` is a known nit,
tracked separately — out of scope.)

---

## 5. Detection — which stops are "sunset-anchored"

Two tiers, deliberately conservative to avoid false positives (a legitimate 9 AM beach walk must not
be dragged to the evening).

**Tier A — explicit sunset intent (always guarded).** The stop's `name`, `category`, or `reason`
matches a sunset keyword (case-insensitive, word-boundary):

```
sunset | sundown | golden hour | dusk | twilight | sunrise*
```

*`sunrise` is anchored to `ctx.sun.sunrise` instead of sunset, symmetric logic. If sunrise data is
absent, skip.

**Tier B — generic outdoor evening stop (flag-only, never moved).** Category/name matches an outdoor
keyword (`beach | boardwalk | pier | park | scenic | overlook | waterfront | trail | hike | walk`)
**and** the stop is scheduled to **end after sunset** (i.e. it runs into the dark). This is the
"never schedule after dark" violation. We only ever **flag** these — moving a generic mid-day outdoor
stop risks reordering the day, and the intent is weaker than Tier A.

Everything else is untouched.

---

## 6. Correction algorithm (per Tier-A stop)

Let `sunsetMin` = sunset in minutes, `startMin`/`endMin` = the itinerary window bounds,
`stopStart`/`stopEnd` = this stop's current start/end (`stopEnd = stopStart + duration_mins`),
`prevEnd` = previous stop's end (or `startMin` if first), `nextStart` = next stop's start
(or `endMin` if last).

**Target:** the stop should *finish at* sunset → `targetStart = sunsetMin − duration_mins`.

Decide the outcome:

1. **Already correct** — `|stopEnd − sunsetMin| ≤ GRACE` (GRACE = 30 min): do nothing.

2. **Sunset is at/after the window end** — `sunsetMin ≥ endMin − GRACE`
   (the 6 PM-walk / 8 PM-sunset / window-ends-8 PM case): finishing at sunset inside the day is
   impossible. Push the stop as late as the window and neighbors allow
   (`newStart = clamp(targetStart, prevEnd, endMin − duration_mins)`) **and flag**:
   `time_note = "Sunset isn't until {8:00 PM} — after your planned day ends. Consider extending if you want to catch it."`,
   `unverified = true`. (Never overwrite a `verified` stop's fields — verified wins, same rule as
   `validateStops`.)

3. **Correctable & safe** — `targetStart` fits without overlap:
   `prevEnd ≤ targetStart` **and** `targetStart + duration_mins ≤ nextStart`: rewrite
   `time = formatClock(targetStart)`. No flag needed — it's now correctly timed. Leave a light
   `time_note` only if it moved > 60 min (optional; see Open Question 2).

4. **Correcting would overlap a neighbor** (mid-day sunset stop hemmed in by other stops):
   do **not** move it. **Flag** with
   `time_note = "Heads up — real sunset is {8:00 PM}; this stop is timed earlier."` and
   `unverified = true`. Conservative: never corrupt the sequence.

Tier-B stops only ever hit a flag path (outcome 2/4 style note: "runs past sunset (~{time}); bring a
light or wrap up by dark").

**Idempotency:** running the guard twice yields the same result (a corrected stop is now within GRACE;
a flagged stop already carries its note — re-flagging is a no-op string overwrite).

**Defensiveness (hard contract, matches `verifyTimes`):**
- `sunset` null / not `"HH:MM"` / unparseable → return stops untouched.
- Any stop with unparseable `time` → skip that stop, continue.
- Never throws; wrap the whole pass in try/catch returning the original array on error.
- Never removes a stop, never changes `name`/`place_id`/`lat`/`lng`/order.

---

## 7. Placement

New pure module **`lib/smart/sunsetGuard.js`**, exporting
`applySunsetGuard(stops, sun, ctx) → stops`.

Applied once in **`lib/smart/index.js`**, immediately after synthesis returns (line ~55):

```js
let stops = await runSynthesis({ places, finds, anchors, ctx });
stops = applySunsetGuard(stops, ctx.sun, ctx);   // ← single call site, both twins inherit it
```

Both API twins (`app/api/itinerary+api.js`, `api/itinerary.js`) call `runSmartEngine`, so one call
site covers prod and dev. No twin edits required → no Vercel 12-function-cap risk.

---

## 8. Test plan (`lib/smart/sunsetGuard.test.mjs`, `node:test` — matches `verifyTimes.test.mjs`)

| # | Scenario | Expected |
|---|---|---|
| 1 | Sunset walk 6 PM, sunset 20:00, window ends 8 PM | Outcome 2: pushed as late as window allows + `time_note` about sunset after day's end, `unverified: true` |
| 2 | Sunset walk 4 PM (ends 5 PM), sunset 20:00, window ends 9 PM, last stop | Outcome 3: `time` rewritten to end ~20:00 |
| 3 | Sunset stop already ends 19:50, sunset 20:00 | Outcome 1: untouched |
| 4 | Mid-day sunset stop boxed between two fixed stops | Outcome 4: flagged, `time` unchanged, order unchanged |
| 5 | Generic "beach walk" ends 21:00, sunset 20:00 (Tier B) | Flagged "runs past sunset", not moved |
| 6 | 9 AM beach walk, sunset 20:00 (Tier B, ends before sunset) | Untouched (no false positive) |
| 7 | `sun.sunset = null` (beyond forecast) | All stops untouched |
| 8 | `verified: true` sunset stop with `verify_source` | Never flagged/overwritten (verified wins) |
| 9 | Malformed stop `time` | That stop skipped, others processed, no throw |
| 10 | Idempotency: guard(guard(stops)) === guard(stops) | Equal |

Build verification (per CLAUDE.md): `npx expo export --platform web` must print `Exported: dist`.
`node --check` is useless here. `node --test lib/smart/sunsetGuard.test.mjs` for the unit pass.

---

## 9. Open questions (product decisions — recommendations in **bold**)

1. **Posture: correct-and-move vs flag-only.** Recommend **correct when provably safe (last stop /
   no overlap), flag otherwise** (outcomes above). The alternative — flag-only, never move — is safer
   but leaves the visibly-wrong 6 PM time on screen. *Decision needed; the algorithm above assumes
   correct-when-safe.*
2. Should a *corrected* stop (outcome 3) still carry a small "moved to catch sunset" note, or move
   silently? Recommend **silent** — the time is now right; a note adds noise.
3. GRACE window (default **30 min**) and the "moved > 60 min" note threshold — tunable constants;
   defaults proposed, easy to adjust after on-device eyeballing.
4. Tier-B keyword list — start conservative (list in §5), widen only if real itineraries show misses.

## 10. Definition of done

- [ ] `applySunsetGuard` pure, exported, fully defensive (never throws, sunset-null safe).
- [ ] Wired once in `lib/smart/index.js`; no twin edits; function count unchanged.
- [ ] All 10 `node:test` cases pass.
- [ ] Clean `npx expo export --platform web`.
- [ ] Reproduces the original bug fixed: the 6 PM/8 PM sunset-walk case now corrects or flags.
- [ ] On-device eyeball on one real evening-outdoor itinerary (per §9.1 posture).
