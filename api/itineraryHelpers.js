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

// Pick the forecast for a specific date from a wttr.in j1 payload. Prefers the
// midday hourly entry of the matching day; flags dates past the forecast window.
export function pickForecastForDate(j1, dateISO) {
  if (!j1) return null;
  const days = Array.isArray(j1.weather) ? j1.weather : [];
  const match = days.find((d) => d.date === dateISO);
  if (match) {
    const hours = match.hourly || [];
    const noon = hours.find((h) => h.time === '1200') || hours[Math.floor(hours.length / 2)] || hours[0] || {};
    return {
      condition: noon.weatherDesc?.[0]?.value ?? 'Clear',
      temp_f: noon.tempF, feels_like_f: noon.FeelsLikeF,
      wind_speed_mph: noon.windspeedMiles ?? null, wind_dir: noon.winddir16Point ?? null,
      beyondForecast: false,
    };
  }
  // Date not in the forecast window. If it's the last covered day or earlier we'd
  // have matched; otherwise it's beyond. Use current_condition only as a today fallback.
  const lastDate = days.length ? days[days.length - 1].date : null;
  const beyond = lastDate ? dateISO > lastDate : true;
  if (beyond) return { condition: null, temp_f: null, feels_like_f: null, wind_speed_mph: null, wind_dir: null, beyondForecast: true };
  const c = j1.current_condition?.[0];
  if (!c) return null;
  return {
    condition: c.weatherDesc?.[0]?.value ?? 'Clear',
    temp_f: c.temp_F, feels_like_f: c.FeelsLikeF,
    wind_speed_mph: c.windspeedMiles ?? null, wind_dir: c.winddir16Point ?? null,
    beyondForecast: false,
  };
}
