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

## Validated against a real plan — 2026-07-28, Brooklyn, "No car", 6 stops

The first real metro itinerary. The reasoning held; what failed was everything the traveller
could actually **see**. Verdict came back `transit` / "Take transit", 10.5 mi, 5 walkable legs
plus one 3.1 mi drive leg (Birdy's → DUMBO), `local: []` (correct — `local.js` is Delmarva-boxed).

Three visibility gaps, all now fixed:

1. `reachWarning` said "plan a ride for it" and offered no way to do it — the one moment the
   app is certain a car is needed, it gave nothing. `dayVerdict` now also returns `unreachable`
   (the drive legs' destinations, in `rideshareLink`'s shape) and `TransportSummary` renders a
   ride button per stretch. No ETA, no fare — both APIs are retired.
2. "Take transit" named no line, which in New York is close to useless. Now paid: see below.
3. `isNotableLeg` gated the leg-alternatives sheet, so 1 leg in 6 was tappable. Split into two
   volumes — see "Chip suppression" below.

### Still open from this plan

- **The warning may be a false alarm in a metro.** That same Brooklyn day produced
  `verdict.mode === 'transit'` AND "too far to cover without a car" about a 3.1 mi leg that is,
  in Brooklyn, a subway ride. Legs are classified walk/bike/drive from road geometry only —
  transit is never consulted **per leg**, so any leg past the walk cutoff reads as car-only.
  Deliberately not fixed here: the honest fix is a per-leg transit check, which is exactly the
  per-leg spend the ambiguous-band design exists to avoid, and making reachability depend on a
  network call means a blip can silently switch the warning off. The rideshare link was added
  *without* touching the warning's logic. **This is now the most likely wrong thing in the
  feature** — ahead of the 20-minute walk cutoff.
- **The 20-minute walk cutoff still untested in a grid city.** Brooklyn's ambiguous legs did not
  land near the boundary.

## Known gaps, deliberately not built

- **Bike/scooter share.** Per-operator GBFS feeds, no single source. Its own project.
- ~~**Transit detail on the day verdict.**~~ **Now paid** (2026-07-28). One extra `computeRoutes`
  call, spent ONLY when the verdict is `transit` — a drive day, which is most days outside a
  metro, pays nothing. It runs on the day's **longest leg**, not the probe's origin → last-stop
  pair: same single call, but the longest hop is a stretch the traveller genuinely rides, so the
  printed sentence is checkable. Copy names both endpoints ("Birdy's → DUMBO runs via the R
  Line") precisely so it cannot be misread as the whole day's route — which it is not.
- **Fares.** Available from the Routes API but not requested anywhere.
- **Curated local options outside Delmarva.** `local.js` returns `[]` elsewhere, which renders
  as nothing. That is correct, not a bug: curated knowledge earns its place where Google's
  transit data is thin, and Google covers dense metros well.

## Cost, and what would change it

Roughly 2–4 billable elements per itinerary:
- ambiguous legs: N (typically 1–2)
- transit probe: 2 (TRANSIT + DRIVE, in parallel, cached per region+day)
- line naming: 1, and **only on a day whose verdict is `transit`** — cached per point pair, so a
  re-generate over the same stretch is free. Outside a metro this is never spent.

**In a dense city this rises** — more legs land in the 0.3–3 mi band, so maybe 4–6 elements.
Still far inside the 10,000/month Essentials free tier.

The two rules that keep it there, neither of which should be "simplified" later:
1. Only the ambiguous band gets a call. A 22-mile leg needs no API to be a drive.
2. Every request is one origin × one destination. Route Matrix bills per **element**, so
   batching N pairs to read the diagonal bills N² for N answers.

## Chip suppression — two volumes, one tap target

`isNotableLeg` answers "is this leg **news**?" It never answered "can the traveller tap it", but
it was wired to both, and the leg-alternatives sheet is the ONLY place subway detail and
rideshare exist. On a transit day every walkable leg agrees with the verdict, so the Brooklyn
plan rendered **1 tappable leg out of 6** and "could I take the subway instead?" was
unanswerable on the other five.

Now: `isNotableLeg` keeps its original narrow meaning and still drives the loud cobalt chip
(`legChipText`, imperative — "Walk it · 0.4 mi"). Every other leg gets `legHintText` — muted
type, no pill, no fill, no border, stating rather than commanding ("0.4 mi on foot · 8 min").
Exactly one of `chip`/`hint` is ever set on a leg. Both open the same sheet.

The hint earns its space: the reshaped stop card moved distance out to the detail modal, so the
timeline gutter was empty. If it ever starts reading as a badge wall, the lever is the hint's
**styling**, not its presence — going back to suppression takes the sheet away again.

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

The city half is done (Brooklyn, above). What is left:
1. Does the 20-minute walk cutoff put legs on the right side of the line? Still unmeasured.
2. Does the reshaped stop card hold up with a photo, a long name, and an allergy alert
   competing for the single caveat slot?
3. ~~Does the day verdict say something sensible in a metro?~~ Yes — the reasoning was right;
   the traveller just could not see any of it. Fixed 2026-07-28.
4. **New:** run a Delmarva plan and count the leg hints. A driving day now shows a quiet row on
   every leg where it previously showed none. That is the change most likely to feel like
   clutter, and Delmarva is where it will show up first.
