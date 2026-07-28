// Transport for a built itinerary — the single entry point both itinerary twins call.
//
// Sits on top of the leg distances annotateRoute already produced (lib/smart/routing.js);
// it never recomputes distance. Free arithmetic classifies every leg, then a small number of
// Routes calls resolve only the legs where walkability is genuinely uncertain.
//
// Never throws. Transport is an enhancement on top of a finished plan — if every call fails,
// the traveller should still get their day, just with estimated modes instead of measured ones.

import {
  classifyLeg, ambiguousLegIndexes, dayVerdict, isNotableLeg, legChipText, legHintText,
  transitViaText,
} from './modes.js';
import { resolveAmbiguousLegs, probeTransit, transitRoute, routesConfigured } from './routes.js';
import { getLocalTransport } from './local.js';

const hasCoords = (s) => Number.isFinite(Number(s?.lat)) && Number.isFinite(Number(s?.lng));

/**
 * Build the leg list from routed stops. Leg i is "how you get TO stop i".
 * The first leg starts at the traveller's origin, matching annotateRoute's convention.
 */
export function buildLegs(stops = [], originLat, originLng) {
  const list = Array.isArray(stops) ? stops : [];
  const legs = [];
  for (let i = 0; i < list.length; i++) {
    const stop = list[i];
    if (!hasCoords(stop)) { legs.push(null); continue; }
    const prev = i > 0 ? list[i - 1] : null;
    const from = prev && hasCoords(prev)
      ? { lat: Number(prev.lat), lng: Number(prev.lng) }
      : { lat: Number(originLat), lng: Number(originLng) };
    if (!Number.isFinite(from.lat) || !Number.isFinite(from.lng)) { legs.push(null); continue; }
    legs.push({
      from,
      to: { lat: Number(stop.lat), lng: Number(stop.lng) },
      // annotateRoute already measured this — do not recompute it.
      miles: Number.isFinite(Number(stop.leg_miles)) ? Number(stop.leg_miles) : null,
      toName: stop.name || null,
      fromName: stop.leg_from || null,
    });
  }
  return legs;
}

/**
 * @returns {
 *   verdict:  { mode, label, detail, transitNote, transitVia, unreachable, ... } | null,
 *   legs:     [{ index, mode, miles, mins, estimated, notable, chip, hint }],
 *   local:    [{ id, name, text, url }],
 *   measured: boolean   // did any leg get real road geometry?
 * }
 * or null when there is nothing meaningful to say.
 */
export async function buildTransport({ stops = [], originLat, originLng, dateISO = null, gettingAround = 'car' } = {}) {
  try {
    const legs = buildLegs(stops, originLat, originLng);
    const real = legs.filter(Boolean);
    if (real.length < 1) return null;

    // 1. Free pass over every leg.
    const classified = legs.map((leg) => (leg ? { ...classifyLeg(leg.miles), leg } : null));

    // 2. Pay only for the uncertain ones, and only if a key is configured.
    let measured = false;
    if (routesConfigured()) {
      const idx = ambiguousLegIndexes(legs.map((l) => (l ? { miles: l.miles } : null)));
      if (idx.length) {
        const resolved = await resolveAmbiguousLegs(legs, idx);
        for (const [i, r] of resolved) {
          if (classified[i]) { classified[i] = { ...classified[i], ...r }; measured = true; }
        }
      }
    }

    // 3. One transit probe for the whole day — never one per leg. Returns durations as well
    //    as availability so the verdict can weigh transit against driving rather than
    //    inferring it from how many miles the day covers.
    let probe = { status: 'unknown', transitMins: null, driveMins: null };
    if (routesConfigured() && real.length >= 2) {
      const first = real[0], last = real[real.length - 1];
      probe = await probeTransit(first.from, last.to, dateISO);
    }

    const verdictOpts = {
      transit: probe.status,
      transitMins: probe.transitMins,
      driveMins: probe.driveMins,
      gettingAround,
    };
    let verdict = dayVerdict(classified.filter(Boolean), verdictOpts);
    if (!verdict) return null;

    // 3b. Rescue legs the geometry called car-only but a train actually covers.
    //
    //     Legs are classified from road distance alone, so anything past the walk cutoff reads
    //     as a drive — which told a real Brooklyn traveller that a 3.1 mi subway ride was "too
    //     far to cover without a car". That warning is the most alarming thing this feature
    //     says, so it had better be true.
    //
    //     ⚠ COST — this is the ONE place per-leg transit is bought, and the gate is deliberately
    //     narrow. All four must hold: they chose TRANSIT specifically (a walking traveller must
    //     not have a warning cleared by a bus they never said they'd take), the day probe
    //     already found transit here, the warning would actually fire, and a key exists. So a
    //     driver pays nothing, a Delmarva walking day pays nothing, and a transit-less region
    //     pays nothing. Capped, and cached per point pair.
    //
    //     ⚠ FAILS CONSERVATIVE. No route, or no answer, leaves the leg a drive and the warning
    //     standing. A network blip can only ever leave the warning ON — it can never quietly
    //     switch it off, which is the failure mode that would actually strand someone.
    const MAX_RESCUE_LEGS = 3;
    if (
      verdict.reachWarning
      && gettingAround === 'transit'
      && probe.status === 'yes'
      && routesConfigured()
    ) {
      const stranded = classified
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => c && c.mode === 'drive' && c.leg?.from && c.leg?.to)
        .slice(0, MAX_RESCUE_LEGS);

      if (stranded.length) {
        const routed = await Promise.all(
          stranded.map(({ c }) => transitRoute(c.leg.from, c.leg.to)),
        );
        let rescued = 0;
        routed.forEach((r, n) => {
          if (r?.mins == null) return;
          const { i } = stranded[n];
          classified[i] = {
            ...classified[i],
            mode: 'transit',
            mins: r.mins,
            miles: r.miles ?? classified[i].miles,
            transitLines: r.lines?.length ? r.lines : null,
            estimated: false,
          };
          rescued += 1;
        });
        // Recompute rather than patch: dayVerdict owns the relationship between the legs, the
        // warning and the ride targets, and hand-editing one of those in isolation is how they
        // drift apart.
        if (rescued) verdict = dayVerdict(classified.filter(Boolean), verdictOpts) ?? verdict;
      }
    }

    // 4. ONE computeRoutes call, spent only where it changes the advice: a verdict of
    //    "Take transit" that cannot name a train is close to useless in a city, and the
    //    day-level matrix probe returns durations only. A drive day never reaches this line.
    //
    //    Spent on the day's LONGEST leg rather than the probe's origin → last-stop pair. Same
    //    single call either way, but the longest hop is the one most likely to need a train
    //    and — unlike the probe's pair — it is a stretch the traveller genuinely rides, so the
    //    sentence we print can be checked against reality.
    if (verdict.mode === 'transit' && routesConfigured()) {
      const longest = classified
        .filter((c) => c?.leg?.from && c?.leg?.to && Number.isFinite(Number(c.miles)))
        .sort((a, b) => Number(b.miles) - Number(a.miles))[0];
      if (longest) {
        // A leg rescued in 3b already carries its lines. Reusing them costs nothing and is
        // clearer than paying again and trusting the cache to absorb it — on the common case
        // (the stranded leg IS the longest leg) this step becomes free rather than merely cheap.
        const named = longest.transitLines?.length
          ? { lines: longest.transitLines }
          : await transitRoute(longest.leg.from, longest.leg.to);
        if (named?.lines?.length) {
          verdict.transitLines = named.lines;
          verdict.transitVia = transitViaText({
            fromName: longest.leg.fromName,
            toName: longest.leg.toName,
            lines: named.lines,
          });
        }
      }
    }

    const legsOut = classified
      .map((c, index) => {
        if (!c) return null;
        const notable = isNotableLeg(c, verdict);
        return {
          index,
          mode: c.mode,
          miles: c.miles ?? null,
          mins: c.mins ?? null,
          estimated: c.estimated !== false,
          from: c.leg?.fromName ?? null,
          to: c.leg?.toName ?? null,
          // Endpoints travel with the leg so the "other ways to do this" sheet can ask about
          // it on tap without the client having to re-derive which stops a leg connects.
          fromCoord: c.leg?.from ?? null,
          toCoord: c.leg?.to ?? null,
          // Set only on a leg rescued in 3b — we know which train covers it, so the UI can name
          // it without re-asking.
          transitLines: c.transitLines ?? null,
          notable,
          chip: notable ? legChipText(c) : null,
          // Two volumes, one tap target. `chip` is the loud pill and stays rare; `hint` is the
          // muted row every other leg gets, so "could I take the subway instead?" can be asked
          // on ANY stretch. Before this, a transit day suppressed all five walkable legs and
          // left the alternatives sheet — the only home of subway detail and rideshare —
          // reachable from 1 leg in 6. Exactly one of the two is ever set.
          hint: notable ? null : legHintText(c, verdict),
        };
      })
      .filter(Boolean);

    return {
      verdict,
      legs: legsOut,
      local: getLocalTransport(originLat, originLng, dateISO),
      measured,
    };
  } catch (err) {
    console.warn('[transport] failed:', err?.message);
    return null;
  }
}

export { legAlternatives } from './routes.js';
export { rideshareLink } from './local.js';
