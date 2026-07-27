// How the traveller is getting around today — a CONSTRAINT on generation, not a display filter.
//
// This is the difference between a plan and a fantasy. A traveller without a car who is handed
// a 25-mile route did not get a plan they can execute; they got a list with a walking icon on
// it. So this value reaches the synthesis prompt and clamps the search radius BEFORE stops are
// chosen, rather than annotating a route that was already built for a car.
//
// Single source of truth for the option ids, shared by the picker (app/(tabs)/plan.js and
// screens/SettingsScreen.js), the synthesis prompt (lib/smart/synthesis.js), and the day
// verdict (lib/transport/modes.js) — so the three can never drift apart on what 'walk' means.

export const GETTING_AROUND_OPTIONS = [
  { id: 'car',     label: 'Driving',  emoji: '🚗' },
  { id: 'walk',    label: 'On foot',  emoji: '🚶' },
  { id: 'transit', label: 'No car',   emoji: '🚌' },
];

export const DEFAULT_GETTING_AROUND = 'car';

const VALID = new Set(GETTING_AROUND_OPTIONS.map((o) => o.id));

/** Anything unrecognised falls back to 'car' — the assumption every existing plan was built under. */
export function normalizeGettingAround(v) {
  return VALID.has(v) ? v : DEFAULT_GETTING_AROUND;
}

/**
 * The hard ceiling on how far a single leg can be and still be executable.
 *
 * 'transit' is deliberately more generous than 'walk': someone without a car can still cover a
 * few miles by bus or a single rideshare hop, whereas a walking day genuinely has to stay
 * inside one neighbourhood. null means no constraint.
 */
export function maxLegMiles(gettingAround) {
  switch (normalizeGettingAround(gettingAround)) {
    case 'walk':    return 1.2;
    case 'transit': return 5;
    default:        return null;
  }
}

/** Search radius clamp, applied before Places is queried. Returns the miles to actually use. */
export function clampSearchMiles(gettingAround, requestedMiles) {
  const req = Number(requestedMiles);
  const asked = Number.isFinite(req) ? req : 25;
  switch (normalizeGettingAround(gettingAround)) {
    // A walking day spent searching a 25-mile radius mostly finds places you cannot reach.
    case 'walk':    return Math.min(asked, 3);
    case 'transit': return Math.min(asked, 10);
    default:        return asked;
  }
}

/** The line injected into the synthesis prompt. Empty for 'car' — no constraint to state. */
export function synthesisConstraint(gettingAround) {
  switch (normalizeGettingAround(gettingAround)) {
    case 'walk':
      return 'GETTING AROUND — HARD CONSTRAINT: this traveller is ON FOOT and has no car. Every '
        + 'consecutive pair of stops must be within about a mile of each other — a comfortable '
        + 'walk, not a hike. Keep the entire day inside one walkable district or neighbourhood. '
        + 'A more exciting stop that cannot be reached on foot is worthless here: it does not '
        + 'make the day better, it makes the day impossible. If that means fewer or less '
        + 'remarkable stops, choose fewer and closer every time.';
    case 'transit':
      return 'GETTING AROUND — HARD CONSTRAINT: this traveller has NO CAR. They can walk, and they '
        + 'can take a bus or a single rideshare hop, but they cannot drive between stops. Keep '
        + 'consecutive stops within a few miles and strongly prefer places near a main road or '
        + 'town centre where transit and pickups actually exist. Never route them somewhere with '
        + 'no realistic way back. A remote stop that requires a car is not an option, however good it is.';
    default:
      return '';
  }
}
