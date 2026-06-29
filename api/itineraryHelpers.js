// Shared pure helpers for both itinerary handlers (no RN, no SDK imports).

// Per-person price-level → rough USD [low, high] for a food/drink stop.
const PRICE_LEVEL_USD = { 1: [8, 15], 2: [15, 30], 3: [30, 60], 4: [60, 120] };

function admissionUSD(text) {
  if (!text || /free/i.test(text)) return [0, 0];
  const nums = String(text).match(/\d+(\.\d+)?/g);
  if (!nums) return null; // "Prices vary — check website" → unknown, skip
  const vals = nums.map(Number);
  return [Math.min(...vals), Math.max(...vals)];
}

// Sum a [low, high] day-cost range across stops. Returns null when nothing is priced.
export function computeCostSummary(stops) {
  let low = 0, high = 0, priced = 0;
  for (const s of stops || []) {
    let range = null;
    if (s.admission_cost != null) range = admissionUSD(s.admission_cost);
    if (!range && s.price_level && PRICE_LEVEL_USD[s.price_level]) range = PRICE_LEVEL_USD[s.price_level];
    if (!range) continue;
    low += range[0]; high += range[1]; priced++;
  }
  if (!priced) return null;
  const fmt = (n) => `$${Math.round(n)}`;
  const label = low === high ? `~${fmt(low)} for the day` : `~${fmt(low)}–${fmt(high)} for the day`;
  return { low, high, label };
}
