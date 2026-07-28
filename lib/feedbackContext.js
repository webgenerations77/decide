// What the traveller has already told us, folded into the shape the synthesis prompt wants.
//
// Pure on purpose. This logic used to live inline in app/(tabs)/plan.js, where it was untestable
// and where a whole missing input source went unnoticed: per-stop rejections captured by
// StopCard's swap flow were written to `@decide/feedback_*` and never read by anything. Pulling
// the merge out here means the sources are enumerated in one visible place, and a source that
// stops contributing fails a test rather than failing silently.
//
// ⚠ dislikedPlaces becomes a HARD AVOID instruction in the prompt (lib/smart/synthesis.js), so
// a name that lands here will not be offered again. Only include something the traveller
// actually rejected — never infer a dislike from absence.

const CAPS = { disliked: 20, liked: 10, reasons: 12 };

const nameOf = (e) => (e?.placeName || e?.name || '').trim();

/**
 * @param decisions      @decide/decisions   — spins and single picks, each {name, feedback, feedbackReason}
 * @param itineraries    @decide/itineraries — whole days, each {feedback, feedbackReason}
 * @param placeFeedback  per-stop reactions  — each {placeName, feedback, reason}
 */
export function buildFeedbackContext({ decisions = [], itineraries = [], placeFeedback = [] } = {}) {
  const d = Array.isArray(decisions) ? decisions : [];
  const it = Array.isArray(itineraries) ? itineraries : [];
  const pf = Array.isArray(placeFeedback) ? placeFeedback : [];

  const down = (e) => e?.feedback === 'down';
  const up = (e) => e?.feedback === 'up';

  // Deduped: the same place rejected twice is not twice as rejected, and a repeated name burns
  // prompt budget that a different avoid could have used.
  const dislikedPlaces = [...new Set([
    ...d.filter(down).map(nameOf),
    ...pf.filter(down).map(nameOf),
  ].filter(Boolean))];

  const likedPlaces = [...new Set([
    ...d.filter(up).map(nameOf),
    ...pf.filter(up).map(nameOf),
  ].filter(Boolean))];

  // The traveller's own words, from all three sources. These are the most useful signal we have
  // — "too loud", "too far from parking" generalises in a way a place name never can.
  const dislikedReasons = [...new Set([
    ...d.filter(down).map((e) => e?.feedbackReason),
    ...it.filter(down).map((e) => e?.feedbackReason),
    ...pf.filter(down).map((e) => e?.reason),
  ].map((r) => (typeof r === 'string' ? r.trim() : '')).filter(Boolean))];

  return {
    dislikedPlaces: dislikedPlaces.slice(0, CAPS.disliked),
    likedPlaces: likedPlaces.slice(0, CAPS.liked),
    dislikedReasons: dislikedReasons.slice(0, CAPS.reasons),
  };
}
