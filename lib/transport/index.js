// Transport for a built itinerary — the single entry point both itinerary twins call.
//
// Sits on top of the leg distances annotateRoute already produced (lib/smart/routing.js);
// it never recomputes distance. Free arithmetic classifies every leg, then a small number of
// Routes calls resolve only the legs where walkability is genuinely uncertain.
//
// Never throws. Transport is an enhancement on top of a finished plan — if every call fails,
// the traveller should still get their day, just with estimated modes instead of measured ones.

import { classifyLeg, ambiguousLegIndexes, dayVerdict, isNotableLeg, legChipText } from './modes.js';
import { resolveAmbiguousLegs, probeTransit, routesConfigured } from './routes.js';
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
 *   verdict:  { mode, label, detail, transitNote, ... } | null,
 *   legs:     [{ index, mode, miles, mins, estimated, notable, chip }],
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

    // 3. One transit coverage probe for the whole day — never one per leg.
    let transit = 'unknown';
    if (routesConfigured() && real.length >= 2) {
      const first = real[0], last = real[real.length - 1];
      transit = await probeTransit(first.from, last.to, dateISO);
    }

    const verdict = dayVerdict(classified.filter(Boolean), { transit, gettingAround });
    if (!verdict) return null;

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
          notable,
          chip: notable ? legChipText(c) : null,
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
