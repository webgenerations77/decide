# Transport — open questions and unvalidated thresholds

Written so this survives the session it came from. Everything here is a decision that was
*reasoned* rather than *measured*, plus the gaps that are known and deliberate.

## Thresholds nobody has validated against a real plan

| Value | Where | Why it was chosen | How it could be wrong |
|---|---|---|---|
| `WALK_CERTAIN_MILES = 0.3` | `lib/transport/modes.js` | Below this, walkable almost regardless of geometry | Too generous in a place with no sidewalks |
| `AMBIGUOUS_MAX_MILES = 3.0` | `lib/transport/modes.js` | Above this nobody needs an API to know it's a drive | Fine, but it sets the API spend — see below |
| 20-minute walk cutoff | `resolveAmbiguousLegs` in `routes.js` | A 20-min walk is a walk; past that it's a drive | **The nearest miss so far.** A live probe of two Ocean City boardwalk points returned **17 minutes** — three minutes under the line. This boundary decides walk-vs-drive and is the single most likely thing to be wrong. |
| `TRANSIT_TOLERANCE = 1.75` | `lib/transport/modes.js` | Transit may be up to 75% slower than driving and still win, because a routing API's drive estimate hides parking | Untested outside one Manhattan probe (transit 30 min vs drive 26 min — comfortably inside) |
| Delmarva bounding boxes | `constants/localKnowledge.js`, `lib/transport/local.js` | Hand-drawn around towns | A stop just outside a box silently loses its local advice |

## Known gaps, deliberately not built

- **Bike/scooter share.** Per-operator GBFS feeds, no single source. Its own project.
- **Transit detail on the day verdict.** `legAlternatives` names lines ("via R Line → 1 Line")
  because it uses `computeRoutes`. The day-level probe uses `computeRouteMatrix`, which returns
  summary numbers only — so the verdict can say "Take transit" but not which train. Upgrading
  it means a second `computeRoutes` call per itinerary; deliberately not paid yet.
- **Fares.** Available from the Routes API but not requested anywhere.
- **Curated local options outside Delmarva.** `local.js` returns `[]` elsewhere, which renders
  as nothing. That is correct, not a bug: curated knowledge earns its place where Google's
  transit data is thin, and Google covers dense metros well.

## Cost, and what would change it

Roughly 2–4 billable elements per itinerary:
- ambiguous legs: N (typically 1–2)
- transit probe: 2 (TRANSIT + DRIVE, in parallel, cached per region+day)

**In a dense city this rises** — more legs land in the 0.3–3 mi band, so maybe 4–6 elements.
Still far inside the 10,000/month Essentials free tier.

The two rules that keep it there, neither of which should be "simplified" later:
1. Only the ambiguous band gets a call. A 22-mile leg needs no API to be a drive.
2. Every request is one origin × one destination. Route Matrix bills per **element**, so
   batching N pairs to read the diagonal bills N² for N answers.

## Things that are load-bearing and easy to break

- `dayVerdict` must **never** return `'drive'` when `gettingAround` is `walk` or `transit`.
  When the route still contains an unreachable leg it sets `reachWarning` instead.
- `getLocalKnowledge` requires lat/lng. Without the geographic gate, regional advice leaks
  worldwide — this shipped once, with Delmarva mosquito warnings appearing on outdoor stops
  anywhere on the planet.
- `StopCard` is the only writer of `@decide/feedback_*`, which `plan.js` reads to build the
  synthesis prompt's HARD AVOID list. If the swap flow's reason capture is ever removed, the
  app silently stops learning what a traveller rejects.
- Both itinerary twins (`api/itinerary.js` and `app/api/itinerary+api.js`) must stay in sync.

## What to do first

Run a real plan in Delmarva and a real plan in a city, and check:
1. Does the 20-minute walk cutoff put legs on the right side of the line?
2. Does the reshaped stop card hold up with a photo, a long name, and an allergy alert
   competing for the single caveat slot?
3. Does the day verdict say something sensible in a metro?
