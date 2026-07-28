# Backlog

Things worth doing that nobody is doing yet. Written down because "queued follow-up" scattered
through `CLAUDE.md` comments is not a place anyone can look.

Ordered roughly by value-to-effort, not by when it was raised. Anything with real design risk
carries the risk here rather than leaving it to be discovered mid-build.

---

## Trip reviews, and getting people to write them

**The ask:** a gamification layer that encourages travellers to come back and record what they
actually thought of a plan — and, if possible, push those reviews out to Google.

**Why it is worth more than it looks.** Per-stop feedback now genuinely reaches the synthesis
prompt's HARD AVOID list (`services/placeFeedback.js` → `lib/feedbackContext.js` → `plan.js`).
Until 2026-07-28 it did not: StopCard wrote it and nothing read it. So review capture is not a
vanity feature — it is the app's only channel for learning what a traveller rejects, and right
now it still only fires when someone swaps a stop *during* planning. A traveller who finished the
day and hated stop four tells us nothing. Closing that loop improves the actual recommendations,
which is the product.

### ⚠ The Google half needs reshaping before it is built

Auto-posting reviews to Google is **not achievable as stated**, and it is better to know that now
than three days in:

- Google's Places API is **read-only for reviews**. There is no endpoint to create one.
- The Business Profile API lets a business *reply* to reviews. It cannot author them.
- Google requires reviews to be posted by the person, from their own account. A third party
  posting on someone's behalf breaches the content policy regardless of how it is implemented.

**The shape that does work:** deep-link the traveller into Google's own review composer for that
exact stop. We already store `place_id` on every stop, and the composer takes it directly:

```
https://search.google.com/local/writereview?placeid=<place_id>
```

One tap from a finished itinerary opens Google's dialog for the right place. They write it, they
post it, it is genuinely theirs. Decide gets credit for the nudge and never touches their words.
Opens in a NEW TAB — see `components/HouseAd.js` for why that matters.

### ⚠ Do not gate the prompt on sentiment

Prompting only the happy travellers to post publicly is **review gating**, and it violates
Google's policy outright. Whatever the gamification rewards, it has to reward *reviewing*, not
*reviewing positively* — the reward must fire identically for a one-star and a five-star.
Internal feedback (the HARD AVOID list) can and should still capture negative signal; that is a
private preference store, not a public review.

### Open design questions

- What is actually rewarded? Streaks, a count, unlocked features? The free tier is 5 decisions
  and 3 spins per day — a reward that grants decisions is the obvious lever and needs no new
  billing surface.
- When does the prompt fire? A day that has finished is the honest moment; that needs the
  itinerary date to be in the past, which history already stores.
- Does any of it survive a reinstall? History syncs through Firestore; a streak counter living
  only in AsyncStorage would not.

---

## Retire the countdown's guess

`ESTIMATED_SECONDS` in `components/LoadingAnimation.js` is 45 because someone eyeballed it.
`durationMs` instrumentation now ships on both itinerary twins, so admin → **Itinerary
generation** has the real distribution. Read **p80**, not p50 — a clock that expires early on one
run in two is worse than one that finishes early — and paste it in. Five-minute change; it
retires the last piece of folklore on that screen.

## Validate the 20-minute walk cutoff

Now the likeliest wrong thing in the transport feature, having inherited the title from the
reach-warning false alarm. See `transport-open-questions.md`. A live Ocean City probe once came
back at 17 minutes — three minutes under the line that decides walk-vs-drive.

## Check leg-chip density on a driving day

Every leg now carries a quiet row where a driving day previously showed none. Delmarva is where
it will feel like clutter first. If it does, the lever is the hint's **styling**, not its
presence — suppressing it takes the leg-alternatives sheet away again, which is the bug that
started the whole rework.

## Merge or retire `trellis/3jVDmx-transit-suggestions`

A complete, tested feature sitting unmerged: location-aware transit options on the plan screen
(`lib/transport/availability.js` + ~160 lines of `plan.js`, with its own test suite). Merges into
`main` cleanly. It is either worth shipping or worth deleting; leaving it is the only bad option.

## Cross-device history delete needs tombstones

"Clear History" is device-local. The union merge has no deletion tracking, so a clear is
resurrected by another device's stale cache. Pre-existing; documented in `CLAUDE.md`.

## Usage attribution gaps

The standalone place-detail / search / geocode endpoints do not wrap `runWithUser`, so their rows
log as anonymous in the admin dashboard. Pre-existing; documented in `CLAUDE.md`.
