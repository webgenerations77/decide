# Design Spec — Venue Start-Time Verification

**Date:** 2026-07-24
**Status:** Proposed
**Sibling feature:** Verified Times (`lib/smart/verifyTimes.js`, shipped 2026-07-22) and the Sunset
Guard (`lib/smart/sunsetGuard.js`, shipped 2026-07-24). This is the second half of the "bad timing"
report — the event/venue half. The sunset half is done.

---

## 1. Problem

Reported: **Ocean Downs harness racing scheduled at 5:00 PM for 60 minutes, when the first post
isn't until 6:40 PM.** The model invented a plausible round-number time because it had no real start
time to work from.

Root cause — a coverage gap in the existing Verified Times feature:

- `verifyEventTimes` (and its upstream `annotateEventTimes`) only run over **`finds`** — the
  Firecrawl/events-discovery results. They never touch **Google Places** venues.
- A venue like Ocean Downs comes into the pipeline as a **Google Place** (from Nearby Search), not a
  find. It has a *standing schedule* (harness racing every race night, first post 6:40 PM) that the
  Places API doesn't return. So synthesis gets the venue with **no start time**, and the "HONEST
  HEDGING" prompt rule can't fire because there's nothing to hedge against — the model just guesses.

There is also a **second, subtler bug** that would defeat a naive fix. `verifyTimes.js` only accepts a
time when the page *"explicitly confirms the time for **this specific date**"* (confidence `high`).
A racetrack/theater page states a **recurring weekly** schedule ("Saturdays, first post 6:40 PM"),
not a one-off dated confirmation. Under today's gate that reads as `low` confidence → **rejected** →
still no time. So venue verification needs a **venue-tuned acceptance rule**: a stated recurring
schedule for the plan's weekday IS ground truth for that date.

## 2. Goal

Confirm real start times for scheduled-event **venues** (racetracks, theaters, cinemas, stadiums,
arenas, concert halls, etc.) that arrive via Google Places, and feed the confirmed time into
synthesis so the day is *scheduled correctly from the start* — reusing the existing "VERIFIED start …"
rail rather than correcting after the fact. When a time can't be confirmed, fall through to the
existing honest hedge (unchanged).

## 3. Non-goals

- **Not** post-synthesis time correction. (Considered — see §7. We schedule right the first time to
  avoid the cascade/overlap problem the Sunset Guard has to manage.)
- **Not** sunset/outdoor timing — that's the shipped Sunset Guard.
- **Not** a new Places API field fetch for `types`/`website` on every nearby result (cost + the
  Nearby field mask is deliberately lean). Detection is name/summary-based; the schedule page is found
  by search, exactly as `verifyOne` already does for URL-less finds.
- **Not** applied to the local fallback itinerary (deterministic templates, no event venues).
- **No** new `api/*.js` file — all logic in `lib/` (Vercel is at 12/12 functions).

---

## 4. Data facts (verified against current code)

| Thing | Reality |
|---|---|
| Nearby Places field mask | `id, displayName, formattedAddress, rating, userRatingCount, currentOpeningHours, regularOpeningHours, location, priceLevel, editorialSummary` — **no `types`, no `websiteUri`** (`fetchPlaces`) |
| Mapped place object | `{ name, place_id, address, rating, user_ratings_total, price_level, is_open, summary, openingPeriods, lat, lng }` |
| `website` availability | Only via a **post-synthesis** per-stop Details fetch (`resolveDetails`) — not available at synthesis-planning time |
| Existing verify machinery | `verifyTimes.js` `verifyOne` already does: search-for-source-URL (when none) → Firecrawl scrape → Haiku extract → accept on `high` confidence. Reusable. |
| Existing bridge into synthesis | A `find` with `verifiedTime`/`verifiedSource`/`timeConfidence:'verified'` renders in the prompt as `— VERIFIED start HH:MM (use exactly, do not hedge)` and, if chosen, becomes a `verified:true` stop. This rail already exists and is battle-tested. |
| Verify phase budget | `runSmartEngine` already runs verification pre-synthesis inside a bounded `VERIFY_PHASE_TIMEOUT_MS` (8s), fail-open. |

---

## 5. Detection — which Places are "scheduled-event venues"

A place qualifies if its `name` or `summary` matches (case-insensitive, word-boundary):

```
racetrack | raceway | speedway | dragway | downs | motor speedway     (racing)
theater | theatre | playhouse | opera | cinema | movie | multiplex     (screen/stage)
amphitheater | amphitheatre | concert hall | music hall | auditorium    (performance)
arena | stadium | ballpark | fieldhouse | pavilion | fairgrounds        (sport/large-venue)
```

Deliberately narrow — these are venues whose *entire point* is a scheduled start time. Everyday
venues (restaurants, shops, parks, museums) are excluded; their timing is governed by opening hours,
which synthesis already handles. Cap the candidate set at **`MAX_VENUE_VERIFY = 2`** (most-promising
first: exact-name keyword over summary-only match), so this never becomes an unbounded scrape fan-out.

## 6. Verification & bridge

Reuse `verifyOne`'s search → scrape → extract shape, seeded from a **venue** instead of a find, with a
**venue-tuned extraction prompt** (the key difference from the event path):

1. **Source page:** venues never carry a URL at this stage → always run one Firecrawl search:
   `"{venue name} {dayOfWeek} {date} schedule first post showtime start time {location}"`. Take the
   top result. (Same fallback path `verifyOne` uses today.)
2. **Extract (venue-tuned):** ask Haiku for the start time, and **accept a recurring weekly schedule
   that matches the plan's weekday as `high` confidence.** Prompt explicitly:
   *"If the page gives a regular schedule for {dayOfWeek} (e.g. 'Saturdays, first post 6:40 PM'),
   that IS the confirmed time for this date — return it with confidence high. Use null only when no
   time for this weekday is stated or implied."* Still reject when the page says nothing about the
   weekday.
3. **Bridge (promote onto the verified-finds rail):** for each **confirmed** venue —
   - Remove it from the `places` pool (so it isn't double-represented), and
   - Push a synthetic `find`: `{ title: name, lat, lng, place_id, verifiedTime, verifiedSource,
     timeConfidence: 'verified', sourceLabel: 'Venue schedule', interest: '<venue category>',
     category: '<venue category>' }`.
   Synthesis then schedules it via the existing "VERIFIED start …" handling → correct time, no
   hedge, `verified:true` stop with a tappable ✓ source chip (StopCard already renders this).
   - **Unconfirmed** venues: left in `places` untouched → synthesis hedges via the existing HONEST
     HEDGING rule ("Racing starts ~6:40pm — confirm before you head out"). Strictly better than a
     confident wrong time.

**Placement & ordering** (`lib/smart/index.js`): run venue selection+verification in the **same
bounded phase** as the existing `verifyEventTimes`, *before* `pickAnchors` and `runSynthesis`, so a
promoted venue can also be picked as an **anchor** (the day builds around it — which is exactly right
for a 6:40 PM race). Sequence:

```
finds = [...scoutFinds, ...eventFinds]
await annotateEventTimes(finds, date)
await [bounded, in parallel]:
    verifyEventTimes(finds, ctx)                 // existing
    verifyVenueTimes(places, ctx) -> { promoted, places' }   // NEW: mutate finds/places
finds.push(...promoted); places = places'
anchors = pickAnchors([...scoutFinds, ...promoted], ctx)   // promoted venues eligible as anchors
stops = runSynthesis({ places, finds, anchors, ctx })
stops = applySunsetGuard(stops, ctx.sun, ctx)   // existing
```

## 7. Alternative considered — post-synthesis correction (rejected)

Mirror the Sunset Guard: let synthesis guess, then verify the venue stop and correct/flag it after.
Rejected as the primary because: (a) correcting an event time mid-day hits the **cascade/overlap
problem** (shifting Ocean Downs from 5:00 to 6:40 collides with whatever follows), forcing a flag in
exactly the cases we most want fixed; (b) it can't let the venue **anchor** the day; (c) it moves a
network scrape onto the critical path *after* the expensive Sonnet call, lengthening time-to-result.
Pre-synthesis promotion schedules it right the first time and reuses more existing machinery. (The
honest-hedge fall-through means we still degrade gracefully, so we don't need the post-pass safety net.)

## 8. Defensive contract (same as verifyTimes/sunsetGuard)

- Never throws; the whole venue phase is wrapped and fail-open. Any failure → `places`/`finds`
  untouched → existing hedge behavior.
- Bounded: ≤ `MAX_VENUE_VERIFY` scrapes, inside the existing 8s verify-phase race.
- Never fabricates: only a `high`-confidence, well-formed `HH:MM` promotes a venue; everything else
  leaves the venue exactly as it was.
- Never double-represents a venue (removed from `places` iff promoted to `finds`).
- No behavior change when `FIRECRAWL_API_KEY` / `ANTHROPIC_API_KEY` is unset (both already gate the
  underlying calls) — degrades to today's behavior.

---

## 9. Test plan (`lib/smart/verifyVenueTimes.test.mjs`, `node:test`, DI seams like verifyTimes)

| # | Scenario | Expected |
|---|---|---|
| 1 | `selectEventVenues`: racetrack + theater among restaurants/shops | picks the two venues, drops the rest, caps at MAX_VENUE_VERIFY |
| 2 | Venue name matches, summary doesn't | selected (name match) |
| 3 | Ordinary restaurant/park/museum | never selected |
| 4 | Verify returns recurring "Saturday first post 18:40" on a Saturday plan | promoted: `verifiedTime:'18:40'`, removed from places, added to finds as verified |
| 5 | Verify returns a weekday that doesn't match the plan date | not promoted; venue stays in places untouched |
| 6 | Search finds no source page | not promoted; venue untouched |
| 7 | Scrape/Haiku throws | not promoted; no throw; venue untouched |
| 8 | `FIRECRAWL_API_KEY` / model key unset (no `createMessage`/`search` dep) | no-op, returns inputs untouched |
| 9 | More than MAX_VENUE_VERIFY candidates | only MAX_VENUE_VERIFY verified; extras left in places (hedge) |
| 10 | Promoted venue is present in the finds passed to `pickAnchors` | eligible as an anchor (integration-level assert in index.test) |

Build verification per CLAUDE.md: `npx expo export --platform web` → `Exported: dist`.
Unit: `node --test lib/smart/verifyVenueTimes.test.mjs`. Confirm fn count still ≤ 12.

## 10. Open questions (recommendations in **bold**)

1. Should a promoted venue be forced through `pickAnchors`, or just *eligible*? Recommend **eligible**
   (add to the anchor candidate pool) — let the existing ranker decide, don't hard-pin.
2. `MAX_VENUE_VERIFY` = **2**? Event venues are rare in a nearby pull; 2 covers realistic days without
   ballooning scrape cost. Tunable.
3. Keyword list (§5) — start narrow (listed set); widen from real misses. Notably **"downs"** is in
   for Ocean Downs but is a mild false-positive risk (surname/geographic). Acceptable: worst case is
   one wasted, bounded, fail-open scrape.
4. Reuse `verifyOne` by parameterizing its extraction prompt, or fork a `verifyVenueOne`? Recommend
   **extract the shared search→scrape→extract core** and pass the extraction prompt + acceptance rule
   in, so the event and venue paths share one code path with two prompts (less drift than a fork).

## 11. Definition of done

- [ ] `lib/smart/verifyVenueTimes.js` — `selectEventVenues` + `verifyVenueTimes(places, ctx, deps)`
      returning `{ places, promotedFinds }`; fully defensive, fail-open, capped.
- [ ] Venue-tuned extraction accepts a matching recurring-weekday schedule as `high` confidence.
- [ ] Wired into `lib/smart/index.js` verify phase (before anchors/synthesis); promoted venues
      eligible as anchors; no double-representation.
- [ ] All `node:test` cases pass; `index.test.mjs` still green.
- [ ] Clean `npx expo export --platform web`; fn count ≤ 12.
- [ ] Reproduces the fix: an Ocean Downs-style venue schedules at its real first-post time (or hedges
      honestly when unconfirmable), never a silent 5:00 PM guess.
- [ ] On-device eyeball on one real itinerary containing a scheduled-event venue.
