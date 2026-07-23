# Verified Times — Design & Implementation Plan (PROPOSAL — awaiting approval)

**Date:** 2026-07-22
**Status:** Proposal. Not started. Written autonomously after verifying the smarter-suggestions batch in prod; for the user's review before any implementation.
**Depends on:** `2026-07-22-smarter-suggestions-design.md` (shipped) — this completes the trust arc it started.

---

## The one-line pitch

Tonight we made unverifiable times **honest** ("first post ~6:30–7pm — confirm at oceandowns.com"). The next leap is to make them **verified**: proactively check the venue's actual schedule so Decide can state the real time with a receipt — *"First post 6:40pm tonight — verified via oceandowns.com"* — and reserve the hedge only for what genuinely can't be confirmed.

That is the difference between a friend who says "I think racing starts around 6:30, double-check" and a friend who says "I called — first post is 6:40, be there by 6:15 for parking." The second one is the product people tell their friends about.

## Why this next (over the alternatives)

I considered three candidates for the next feature:

1. **Verified Times (recommended).** Direct continuation of tonight's work; turns an honest stopgap into a signature capability; reuses infrastructure we already have (Firecrawl, Haiku, the smart pipeline, `eventTimes.js`); bounded scope. It attacks the exact complaint that started this — "suggestions have bad timing" — at the root, permanently.
2. **Shareable plans (growth).** Let a user hand a finished day to their partner/group via a link. Genuinely valuable for a couples/families user base and good for beta growth — but premature. A shared plan with a wrong time is *more* embarrassing, not less. Solidify trust first, amplify second. Strong fast-follow candidate.
3. **Reservation / ticket deep-links (action).** Turn a stop into a booking (OpenTable, venue ticket URL). Complementary and smaller; pairs naturally with Verified Times (once we've scraped the schedule page we often have the ticket link too). Fold in as a stretch of this work rather than its own feature.

Recommendation: **build Verified Times; graft ticket/booking links onto it as a stretch; keep Shareable Plans as the next headline after.**

## What "time-sensitive" means here

Verification is expensive (a scrape + an LLM call), so it only runs on stops that (a) are **anchors / live finds or event-category** (`sports`, `music`, `theater`, `festival`, `tour`, `event`) AND (b) are currently `unverified` or came in at `low` time-confidence from `eventTimes.js`. A restaurant with Google hours is already verified; a beach walk has no schedule. We never verify those.

## Design

### Data flow (extends the existing `lib/smart/` pipeline)

```
scout → discovery → events → eventTimes (extract) → [NEW] verifyTimes (confirm) → anchors → synthesis
```

- **`lib/smart/verifyTimes.js` (new).** Takes the finds already annotated by `eventTimes.js` plus the plan date. For each find that is time-sensitive AND unverified/low-confidence (capped at the top **N=3** anchors), in parallel with a strict per-item timeout:
  1. Pick a source URL — the find's own `url` if it looks like a schedule/venue page, else one targeted Firecrawl search: `"{venue} {weekday} {date} schedule start time"`.
  2. Firecrawl-scrape that page to markdown (short timeout, small size cap).
  3. Haiku extraction over the scraped text: return `{ startTime, confidence, sourceUrl }` for the **specific plan date** (not a generic weekly time).
  4. On a high-confidence hit, annotate the find: `verifiedTime`, `verifiedSource`, `timeConfidence: 'verified'`. On miss/timeout/error, leave it untouched (fails open to tonight's hedge).
- **`lib/smart/synthesis.js`.** When a stop has a `verifiedTime`, schedule to it and emit `verified: true` + `verify_source` (URL) + drop `unverified`/`time_note`. Prompt rule: "A verified time is ground truth — use it exactly and state it plainly; do not hedge a verified time."
- **`api/itinerary.js` + dev twin.** Pass `verified` / `verify_source` through to the client (same passthrough pattern as `time_note`/`splurge`).

### UI (`components/itinerary/StopCard.js`)

- **`✓ Verified` chip** (cobalt/success-tinted, distinct from the muted `≈ confirm` hedge), tappable → opens `verify_source`. Small "as of today" affordance.
- The existing `≈ confirm` hedge stays exactly as-is for the fail-open case. The two are mutually exclusive per stop.

### Guardrails (this is where it lives or dies)

- **Latency:** only 1–3 stops ever verified; all in parallel; hard per-item timeout (~6s); the whole verify phase capped (~8s) and fully skippable — if it doesn't finish, synthesis proceeds with the hedge. No user-visible slowdown beyond a few seconds worst-case, and never a hang.
- **Cost:** N≤3 scrapes + N≤3 Haiku calls per itinerary, only when time-sensitive anchors exist. Log usage under a `verifytimes` route.
- **Correctness:** only upgrade to "verified" on **high** confidence, and **always** attach the source so the user (and we) can sanity-check. A wrong "verified" is worse than an honest hedge, so the bar is high and the receipt is mandatory.
- **Fail open:** every failure path degrades to the already-shipped honest hedge. This feature can only make timing *better or equal*, never worse.

## Non-goals

- Real-time re-checking / push updates ("racing cancelled"). Out of scope.
- Verifying restaurant hours beyond what Google already gives (already handled).
- Ticket purchase flows (deep-link only, and only as a stretch).

## Model choices

- Extraction/verification on **Haiku** (cheap, structured), consistent with `eventTimes.js` and the cost guidance in CLAUDE.md.
- No change to Sonnet synthesis beyond the new prompt rule + fields.

## Testing / verification

- Unit-test the pure parts of `verifyTimes.js` (source-URL selection, the time-for-date extraction shape) with a mocked `createMessage`/scrape seam, mirroring how `eventTimes.js` is testable.
- Build gate: `npx expo export --platform web` (client) + `node --check` on server/lib files.
- **Live gate (the real one):** re-run tonight's two production probes (Ocean Downs harness racing; a live-music venue). Success = the harness-racing stop comes back `verified: true` with a real first-post time and an `oceandowns.com` source, instead of the hedge — while a genuinely unlisted event still hedges. (Probes and expected shapes are recorded in `.claude/sessions/smarter-suggestions-2026-07-22.md`.)
- ⚠ **Vercel function cap is at 12/12** — this feature adds NO new `api/` endpoint (all logic is in `lib/smart/` + existing handler passthrough). Confirm `find api -name '*.js' | wc -l` stays 12.

---

## Implementation plan (phased, each phase independently committable)

**Phase 1 — Verification module (pure, testable).**
`lib/smart/verifyTimes.js`: `verifyEventTimes(finds, ctx, deps)` with injectable `search`/`scrape`/`createMessage` seams. Source-URL selection, targeted-search fallback, Haiku extraction for the plan date, high-confidence gating, defensive fail-open. Unit tests for URL selection + extraction parsing. No wiring yet.

**Phase 2 — Pipeline wiring.**
Insert `verifyEventTimes` in `lib/smart/index.js` after `annotateEventTimes`, before `pickAnchors`, with the N≤3 cap and the overall timeout guard (Promise.race against a skip). Mutates the shared find objects so anchors + synthesis both see `verifiedTime`/`verifiedSource`.

**Phase 3 — Synthesis + handler passthrough.**
`synthesis.js`: consume `verifiedTime` (schedule to it; emit `verified` + `verify_source`; suppress hedge on verified stops) + the "verified time is ground truth" rule. `api/itinerary.js` + `app/api/itinerary+api.js`: pass the two new fields through. Keep `time_note`/`unverified` fail-open path intact.

**Phase 4 — UI.**
`StopCard.js`: `✓ Verified` chip → opens `verify_source`; mutually exclusive with the `≈ confirm` hedge. Theme-aware, cobalt/success-led.

**Phase 5 — (Stretch) ticket/booking link.**
When the verify scrape also surfaces a tickets/booking URL, attach `booking_url`; StopCard shows a small "Tickets" link. Skip if it complicates Phase 1–4.

**Phase 6 — Verify & ship.**
Build gates + the two live production probes above. Merge to `main`, push, confirm the Vercel deploy goes green (functions still 12) — same finish-branch flow as tonight.

## Rough effort

Medium. Phases 1–4 are the feature; 5 is optional; the pipeline/infra it needs already exists, so this is an extension, not greenfield. Estimate ~1 focused build session, subagent-driven like tonight.
