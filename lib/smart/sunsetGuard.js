// Sunset Guard — deterministic post-synthesis timing correction.
//
// The synthesis model is handed the real local sunset time (ctx.sun.sunset) and a prompt rule to
// anchor outdoor/sunset stops to it, but does not reliably obey (observed: a "sunset walk" at 6pm
// while its own copy says sunset is 8pm). This pass validates the model's output in code:
//   • Tier A — explicit sunset/sundown/golden-hour stops → CORRECT the time when it's provably safe
//     to move (no neighbor overlap), otherwise FLAG with an honest time_note.
//   • Tier B — generic outdoor stops (beach/park/walk) that run past dark → FLAG only, never moved.
//   • sunrise-tagged stops scheduled before actual sunrise → FLAG only.
// Fully defensive (mirrors verifyTimes.js): never throws, sunset-null safe, never reorders/removes a
// stop, never touches a verified stop. Pure + idempotent — guard(guard(x)) === guard(x).
//
// Spec: docs/superpowers/specs/2026-07-24-sunset-guard-design.md

const GRACE = 30; // minutes of slack before a stop is considered mistimed vs the anchor

const SUNSET_RE = /\b(sunset|sundown|golden hour|dusk|twilight)\b/i;
const SUNRISE_RE = /\b(sunrise|daybreak)\b/i;
const OUTDOOR_RE = /\b(beach|boardwalk|pier|park|scenic|overlook|waterfront|trail|hike|hiking|walk)\b/i;

// "HH:MM" 24-hour (Open-Meteo sunrise/sunset) → minutes since midnight, or null.
function hhmmToMin(s) {
  if (typeof s !== 'string') return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// "h:mm AM/PM" 12-hour (stop.time, ctx.startTime/endTime) → minutes since midnight, or null.
function clockToMin(t) {
  if (typeof t !== 'string') return null;
  const [time, period] = t.trim().split(/\s+/);
  if (!time) return null;
  const [hh, mm = '0'] = time.split(':');
  let h = parseInt(hh, 10);
  const m = parseInt(mm, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const p = (period || '').toUpperCase();
  if (p === 'PM' && h !== 12) h += 12;
  else if (p === 'AM' && h === 12) h = 0;
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function minToClock(total) {
  const h = Math.floor(total / 60) % 24;
  const m = ((total % 60) + 60) % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

// Tier of a stop by keyword on name/category/reason. sunset wins over outdoor so a
// "sunset beach walk" is corrected (Tier A), not merely flagged (Tier B).
export function classify(stop) {
  if (!stop) return null;
  const hay = `${stop.name || ''} ${stop.category || ''} ${stop.reason || ''}`;
  if (SUNSET_RE.test(hay)) return 'sunset';
  if (SUNRISE_RE.test(hay)) return 'sunrise';
  if (OUTDOOR_RE.test(hay)) return 'outdoor';
  return null;
}

function isVerified(stop) {
  return stop.verified === true && typeof stop.verify_source === 'string' && stop.verify_source.trim();
}

function flag(stop, note) {
  return { ...stop, time_note: note, unverified: true };
}

// Decide the fate of one anchored stop. Returns a (possibly new) stop object; never mutates input.
// prevEnd / nextStart are computed from the ORIGINAL (pre-guard) neighbors for determinism.
function evaluateStop(stop, { prevEnd, nextStart, windowEnd, sunsetMin, sunriseMin }) {
  const kind = classify(stop);
  if (!kind) return stop;
  if (isVerified(stop)) return stop; // verified wins — never overwrite its timing

  const stopStart = clockToMin(stop.time);
  if (stopStart == null) return stop; // unparseable time → leave untouched
  const dur = Number(stop.duration_mins) || 60;
  const stopEnd = stopStart + dur;

  if (kind === 'sunrise') {
    if (sunriseMin == null) return stop;
    if (stopStart >= sunriseMin - GRACE) return stop; // starts at/after sunrise — fine
    return flag(stop, `Sunrise isn't until ${minToClock(sunriseMin)} — this stop is timed in the dark before then.`);
  }

  if (kind === 'outdoor') {
    // Tier B: only care if it runs well past sunset (into the dark). Flag, never move.
    if (stopEnd <= sunsetMin + GRACE) return stop;
    return flag(stop, `Heads up — this runs past sunset (~${minToClock(sunsetMin)}); plan to wrap up before dark.`);
  }

  // kind === 'sunset' (Tier A) — should FINISH at sunset.
  if (Math.abs(stopEnd - sunsetMin) <= GRACE) return stop; // outcome 1: already correct

  const targetStart = sunsetMin - dur;

  // Outcome 2: sunset falls at/after the day's end — finishing at sunset is impossible.
  // Push as late as the window + neighbors allow, and flag.
  if (sunsetMin >= windowEnd - GRACE) {
    const candidate = clamp(targetStart, prevEnd, windowEnd - dur);
    const moved = candidate >= prevEnd && candidate !== stopStart;
    const s = moved ? { ...stop, time: minToClock(candidate) } : { ...stop };
    return flag(s, `Sunset isn't until ${minToClock(sunsetMin)} — after your planned day ends. Consider extending if you want to catch it.`);
  }

  // Outcome 3: correctable & safe (no neighbor overlap) — silently re-time to end at sunset.
  if (targetStart >= prevEnd && targetStart + dur <= nextStart) {
    return { ...stop, time: minToClock(targetStart) };
  }

  // Outcome 4: correcting would overlap a neighbor — don't move, just flag.
  return flag(stop, `Heads up — real sunset is ${minToClock(sunsetMin)}; this stop is timed earlier.`);
}

// Apply the guard to a synthesized stop array. Returns a new array (or the input untouched on any
// problem). `sun` is ctx.sun = { sunrise, sunset } as local "HH:MM" strings (either may be null
// beyond the 7-day forecast). `ctx` supplies the window via startTime/endTime ("h:mm AM/PM").
export function applySunsetGuard(stops, sun, ctx = {}) {
  try {
    if (!Array.isArray(stops) || stops.length === 0) return stops;
    const sunsetMin = hhmmToMin(sun?.sunset);
    if (sunsetMin == null) return stops; // no usable sunset → nothing to guard against
    const sunriseMin = hhmmToMin(sun?.sunrise);

    const windowStart = clockToMin(ctx?.startTime) ?? clockToMin('11:00 AM');
    const windowEnd = clockToMin(ctx?.endTime) ?? clockToMin('8:00 PM');

    // Neighbor bounds from the original ordering (guard never reorders).
    const starts = stops.map((s) => clockToMin(s.time));
    const durs = stops.map((s) => Number(s.duration_mins) || 60);

    return stops.map((stop, i) => {
      const prevStart = starts[i - 1];
      const prevEnd = prevStart == null ? windowStart : prevStart + durs[i - 1];
      const nextStart = i + 1 < stops.length && starts[i + 1] != null ? starts[i + 1] : windowEnd;
      return evaluateStop(stop, {
        prevEnd: Math.max(prevEnd, windowStart),
        nextStart,
        windowEnd,
        sunsetMin,
        sunriseMin,
      });
    });
  } catch (e) {
    console.warn('[sunsetGuard] failed:', e.message);
    return stops;
  }
}
