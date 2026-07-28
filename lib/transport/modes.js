// How the traveller actually gets between stops.
//
// This module is pure arithmetic over the leg distances `annotateRoute` already computed
// (lib/smart/routing.js). No network, no keys — so it is unit-testable and it still produces
// an answer when every API is down.
//
// The product claim is "Decide commits to a plan". A mode PICKER — four options side by side
// with times and prices — is the comparison grid this product exists to replace. So the job
// here is to make ONE call for the day and state it, with per-leg detail only where a leg
// genuinely differs from that call.

// ─── Thresholds ───────────────────────────────────────────────────────────────
// Straight-line miles. Deliberately conservative at the bottom: haversine underestimates
// real walking distance wherever water, highways or one-way street grids intervene, which
// is exactly the Delmarva failure case (a 0.5 mi straight line across an inlet is a bridge
// detour, not a ten-minute stroll). Anything in the AMBIGUOUS band gets real road geometry
// from the Routes API before we claim it's walkable — see lib/transport/routes.js.
export const WALK_CERTAIN_MILES = 0.3;   // below this, it's walkable almost regardless of geometry
export const AMBIGUOUS_MAX_MILES = 3.0;  // above this, nobody needs an API to know it's a drive
export const BIKE_MAX_MILES = 3.0;

// Average speeds for the free-math estimate. Only used when we have no road geometry.
const WALK_MPH = 3.0;
const BIKE_MPH = 9.0;

// Explicit null/'' rejection matters here: Number(null) and Number('') are both 0, so a bare
// Number.isFinite check would classify a leg with NO measured distance as a 0-mile walk. That
// is the one wrong answer we cannot ship — it tells someone to walk a distance we never knew.
// Unknown must fall through to "drive", the safe assumption.
const isNum = (v) => v !== null && v !== '' && Number.isFinite(Number(v));

/**
 * First-pass classification from distance alone. Costs nothing.
 *
 * `ambiguous: true` means "this is the band where the answer actually depends on the road
 * network" — the caller resolves those (and only those) against a real routing API.
 */
export function classifyLeg(legMiles) {
  if (!isNum(legMiles)) return { mode: 'drive', ambiguous: false, estimated: true, miles: null };
  const miles = Number(legMiles);

  if (miles < WALK_CERTAIN_MILES) {
    return {
      mode: 'walk',
      ambiguous: false,
      estimated: true,
      miles,
      mins: Math.max(1, Math.round((miles / WALK_MPH) * 60)),
    };
  }
  if (miles <= AMBIGUOUS_MAX_MILES) {
    // Provisional answer so the UI has something to render if the API call fails.
    return {
      mode: miles <= 1 ? 'walk' : 'bike',
      ambiguous: true,
      estimated: true,
      miles,
      mins: Math.max(1, Math.round((miles / (miles <= 1 ? WALK_MPH : BIKE_MPH)) * 60)),
    };
  }
  return { mode: 'drive', ambiguous: false, estimated: true, miles };
}

/** The legs worth spending an API call on. Index-tagged so results can be merged back. */
export function ambiguousLegIndexes(legs = []) {
  return legs
    .map((leg, i) => ({ i, c: classifyLeg(leg?.miles) }))
    .filter(({ c }) => c.ambiguous)
    .map(({ i }) => i);
}

// ─── Day verdict ──────────────────────────────────────────────────────────────

const MODE_LABEL = {
  walk:    'Walk it',
  bike:    'Bike it',
  transit: 'Take transit',
  drive:   'Drive it',
};

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Where a leg is trying to get to, in the shape `rideshareLink` needs.
 *
 * The day verdict counts unreachable legs so it can word the warning, but a count cannot be
 * acted on — "plan a ride for it" with no way to plan one is the gap this closes. Reads the
 * endpoints `buildLegs` already attached; returns null when a leg has no usable destination,
 * because a rideshare link without coordinates is a button that goes nowhere.
 *
 * Callers may pass bare `{ mode, miles }` objects (the unit tests do), so nothing here may
 * assume `.leg` exists.
 */
function rideTarget(l) {
  const to = l?.leg?.to;
  const lat = Number(to?.lat), lng = Number(to?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { name: l.leg?.toName ?? null, lat, lng };
}

/**
 * The committed call for the whole day, plus the copy that states it.
 *
 * Rules that keep this honest:
 * - Transit is only ever offered when a coverage probe actually returned a route. Absence is
 *   stated ONCE here, never repeated on five separate legs.
 * - Copy never claims live availability or pricing for anything we can't verify.
 *
 * @param classified per-leg results (post-resolution where available)
 * @param coverage   { transit: 'yes'|'no'|'unknown' } from the day probe
 */
/**
 * How much slower than driving transit may be and still be the better call.
 *
 * Above 1.0 because driving's door-to-door time hides parking — circling for a space and
 * walking back from it doesn't show up in a routing API's drive estimate, and in dense cities
 * it is most of the cost. This number is reasoned, not measured; it is the next thing to
 * check against a real city plan.
 */
export const TRANSIT_TOLERANCE = 1.75;

/**
 * Is transit actually the better call, or just present?
 *
 * This replaced a flat "total day under 15 miles" ceiling, which got cities exactly backwards:
 * a 22-mile Brooklyn → Manhattan → Queens day blew past it and got told to DRIVE, which is
 * bad advice in New York, while a 6-mile suburban day squeaked under it and got recommended
 * transit that barely runs. Distance was never the question — whether transit competes with
 * driving is.
 *
 * Falls back to the old mileage heuristic only when we could not measure either duration,
 * because a rough answer beats refusing to answer.
 */
export function transitIsCompetitive(transitMins, driveMins, totalMiles) {
  if (isNum(transitMins) && isNum(driveMins) && Number(driveMins) > 0) {
    return Number(transitMins) <= Number(driveMins) * TRANSIT_TOLERANCE;
  }
  return isNum(totalMiles) ? Number(totalMiles) < 15 : false;
}

export function dayVerdict(classified = [], {
  transit = 'unknown', gettingAround = 'car', transitMins = null, driveMins = null,
} = {}) {
  const legs = classified.filter(Boolean);
  if (!legs.length) return null;

  const totalMiles = legs.reduce((sum, l) => sum + (isNum(l.miles) ? Number(l.miles) : 0), 0);
  const totalMins  = legs.reduce((sum, l) => sum + (isNum(l.mins) ? Number(l.mins) : 0), 0);

  const driveLegs = legs.filter((l) => l.mode === 'drive');
  const footLegs  = legs.filter((l) => l.mode === 'walk' || l.mode === 'bike');
  const carless   = gettingAround === 'walk' || gettingAround === 'transit';

  // A day is walkable only if EVERY leg is — one 14-mile hop makes the whole day a driving day,
  // and telling someone to walk a day containing that leg is how a plan fails on the road.
  let mode;
  if (gettingAround === 'walk') {
    // They are on foot. "Drive it" is not an available answer whatever the distances say.
    mode = 'walk';
  } else if (gettingAround === 'transit') {
    // Transit when it exists; otherwise walking is what they actually have.
    mode = transit === 'yes' ? 'transit' : 'walk';
  } else if (!driveLegs.length && footLegs.length) {
    mode = legs.every((l) => l.mode === 'walk') ? 'walk' : 'bike';
  } else if (transit === 'yes' && driveLegs.length && transitIsCompetitive(transitMins, driveMins, totalMiles)) {
    mode = 'transit';
  } else {
    mode = 'drive';
  }

  // Honesty check. If they said "no car" and the plan still contains a leg that genuinely
  // needs one, that is a real failure of the plan and the traveller must hear it from us
  // BEFORE they set out — not discover it standing at stop three with no way to stop four.
  //
  // "Genuinely" is doing work here. Legs are classified from road geometry alone, so anything
  // past the walk cutoff reads as car-only even where a train covers it — which is how a real
  // Brooklyn day got told a 3.1 mi subway ride was too far without a car. buildTransport now
  // re-checks exactly these legs against transit before this runs, and a covered leg comes back
  // with `mode: 'transit'`, so it is no longer a drive leg and no longer counted here. Nothing
  // in this function needs to know that happened; it just stops seeing the leg.
  const overLimit = carless ? driveLegs.length : 0;

  // When the plan contains legs the chosen mode genuinely cannot cover, ANY whole-day time
  // figure is a fiction — "about 30 min on foot" for a day containing a 14-mile leg is exactly
  // the confidently-wrong claim this feature exists to prevent. State distance only and let
  // reachWarning carry the rest, rather than pairing a correct warning with a nonsense summary.
  const detail = overLimit > 0
    ? `${round1(totalMiles)} mi across the day`
    : mode === 'drive' || mode === 'transit'
      ? `${round1(totalMiles)} mi total${totalMins ? ` · about ${totalMins} min moving` : ''}`
      : `${round1(totalMiles)} mi across the day${totalMins ? ` · about ${totalMins} min on foot` : ''}`;

  return {
    mode,
    label: MODE_LABEL[mode],
    detail,
    totalMiles: round1(totalMiles),
    totalMins,
    transit,
    gettingAround,
    // Surfaced prominently in the UI, not buried: a carless traveller holding a plan with an
    // unreachable leg needs to know before they leave. Stated as a fact about the plan, with
    // the fix (swap the stop) implied, rather than as an apology.
    reachWarning: overLimit > 0
      ? `${overLimit === 1 ? 'One stretch of this day is' : `${overLimit} stretches of this day are`} too far to cover without a car. Swap ${overLimit === 1 ? 'that stop' : 'those stops'} or plan a ride for ${overLimit === 1 ? 'it' : 'them'}.`
      : null,
    // The destinations behind that warning, so the UI can offer the ride it just told them to
    // plan. Empty whenever the warning is absent — a driver is never shown one of these.
    unreachable: overLimit > 0 ? driveLegs.map(rideTarget).filter(Boolean) : [],
    // Said once, at day level. Never per leg.
    // Copy branches on whether they HAVE a car: "this is a car day" is useless advice to
    // someone who already told us they don't have one.
    transitNote: carless
      ? (transit === 'no'      ? 'No usable transit here, so this day is built to be walkable.'
        : transit === 'unknown' ? 'Could not check transit for this area — the day is built to be walkable regardless.'
        : null)
      : (transit === 'no'      ? 'No transit worth planning around here — this is a car day.'
        : transit === 'yes' && mode !== 'transit' ? 'Some transit runs here, but it does not line up with this route.'
        : transit === 'unknown' ? 'Could not check transit for this area — assume you will need a car.'
        : null),
    walkableCount: footLegs.length,
  };
}

/**
 * Does this leg deserve a LOUD chip on the timeline?
 *
 * Only when it says something the day verdict doesn't. Repeating "drive 12 min" under every
 * stop of a driving day turns the plan into a table, which is the dashboard anti-reference.
 *
 * ⚠ This answers "is this news?", NOT "can the traveller tap it". Those were the same question
 * once, and it cost the traveller the alternatives sheet: on a transit day every walkable leg
 * agrees with the verdict, so a real Brooklyn day rendered 1 tappable leg out of 6 — and the
 * sheet is the ONLY place subway detail and rideshare exist. Tappability is now carried by
 * `legHintText` at a lower volume; this function keeps its original, narrower meaning.
 */
export function isNotableLeg(leg, verdict) {
  if (!leg || !verdict) return false;
  if (leg.mode === verdict.mode) return false;
  // On a driving day, a stretch you can cover on foot is genuinely useful news.
  if (verdict.mode === 'drive' && (leg.mode === 'walk' || leg.mode === 'bike')) return true;
  // On a walking day, the one leg that needs wheels is the thing that breaks the pattern.
  if (verdict.mode !== 'drive' && leg.mode === 'drive') return true;
  return false;
}

const CHIP_VERB = {
  walk:    'Walk it',
  bike:    'Bike it',
  transit: 'Take transit',
  drive:   'Drive it',
};

/** Short chip copy. Kept to a few words — it sits in a 28px timeline column. */
export function legChipText(leg) {
  if (!leg) return null;
  const miles = isNum(leg.miles) ? `${round1(Number(leg.miles))} mi` : null;
  const verb = CHIP_VERB[leg.mode] ?? 'Drive it';
  if (!miles) return verb;
  return leg.mins ? `${verb} · ${miles}, ${leg.mins} min` : `${verb} · ${miles}`;
}

/**
 * "Take transit" naming the actual train.
 *
 * ⚠ SCOPE, and why the copy is worded this way: this describes ONE leg — the day's longest —
 * not the whole day's route. It is deliberately not phrased as "the day runs via the R",
 * because that would be a claim about a journey nobody takes: the day-level probe measures
 * origin → last stop, which is not the order the traveller actually rides. Naming the two
 * endpoints keeps the sentence checkable against the thing it actually measured.
 *
 * Returns null when no line came back — a transit route that is all walking transfers has
 * nothing to name, and "runs via the" with an empty tail is worse than silence.
 */
export function transitViaText({ fromName = null, toName = null, lines = [] } = {}) {
  const named = (Array.isArray(lines) ? lines : []).filter((l) => typeof l === 'string' && l.trim());
  if (!named.length) return null;
  // FEWER_TRANSFERS keeps this short in practice; the cap stops a pathological route from
  // turning a one-line summary into a paragraph.
  const shown = named.slice(0, 3);
  const via = `the ${shown.join(', then the ')}`;
  const where = fromName && toName ? `${fromName} → ${toName}` : 'The longest stretch';
  return `${where} runs via ${via}`;
}

// Stated, not commanded. The loud chip owns the imperative ("Walk it") because it is arguing
// with the day verdict; a leg that simply agrees with it has nothing to argue and should read
// as connective tissue between two stops.
const HINT_MANNER = { walk: 'on foot', bike: 'by bike', transit: 'by transit', drive: 'by car' };

/**
 * Quiet copy for a leg that agrees with the day's verdict.
 *
 * This exists so EVERY leg can be tapped — "could I take the subway instead?" is a fair
 * question on any stretch, and before this it could only be asked on the one leg that
 * happened to break the pattern. It earns the space it takes: the reshaped stop card moved
 * distance out to the detail modal, so the timeline gutter is otherwise empty between stops.
 *
 * Returns null for an unknown mode rather than inventing a manner of travel — no row is
 * better than a wrong one, and the leg simply stays untapped.
 */
export function legHintText(leg) {
  if (!leg) return null;
  const manner = HINT_MANNER[leg?.mode];
  if (!manner) return null;
  const miles = isNum(leg.miles) ? `${round1(Number(leg.miles))} mi` : null;
  if (!miles) return manner.charAt(0).toUpperCase() + manner.slice(1);
  return leg.mins ? `${miles} ${manner} · ${leg.mins} min` : `${miles} ${manner}`;
}
