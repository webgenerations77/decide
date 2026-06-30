// Shared pure helpers for both itinerary handlers (no RN, no SDK imports).

// Per-person price-level → rough USD [low, high] for a food/drink stop.
const PRICE_LEVEL_USD = { 1: [8, 15], 2: [15, 30], 3: [30, 60], 4: [60, 120] };

// Google Places v1 returns priceLevel as an enum string; normalize to the 1–4
// integer the rest of the app uses. Passes integers through unchanged.
const PRICE_ENUM_TO_NUM = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};
export function priceEnumToNum(level) {
  if (level == null) return null;
  if (typeof level === 'number') return level;
  return PRICE_ENUM_TO_NUM[level] ?? null;
}

// Attach a numeric price_level to each stop that lacks one, by matching the
// stop's place_id back to the Google place it came from. Pure; returns a new array.
export function attachPriceLevels(stops, places) {
  const byId = new Map();
  for (const p of places || []) {
    if (p && p.place_id) byId.set(p.place_id, priceEnumToNum(p.price_level));
  }
  return (stops || []).map((s) => {
    if (s.price_level != null) return { ...s, price_level: priceEnumToNum(s.price_level) };
    const pl = byId.get(s.place_id);
    return pl != null ? { ...s, price_level: pl } : s;
  });
}

const BUDGET_TO_LEVEL = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 };

// Map a trip budget string to a 1–4 price level. Defaults to 2 ($$) for unknown input.
export function budgetToPriceLevel(budget) {
  return BUDGET_TO_LEVEL[budget] ?? 2;
}

// Food stops with no Google price_level get an inferred tier from the trip budget,
// so the restaurant price pill never silently disappears. Only fills when missing;
// never overwrites a real value; only touches category 'food'. Pure; returns a new array.
export function fillFoodPriceLevels(stops, budget) {
  const inferred = budgetToPriceLevel(budget);
  return (stops || []).map((s) =>
    s && s.category === 'food' && s.price_level == null
      ? { ...s, price_level: inferred }
      : s
  );
}

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
    const pl = priceEnumToNum(s.price_level);
    if (!range && pl && PRICE_LEVEL_USD[pl]) range = PRICE_LEVEL_USD[pl];
    if (!range) continue;
    low += range[0]; high += range[1]; priced++;
  }
  if (!priced) return null;
  const fmt = (n) => `$${Math.round(n)}`;
  const label = low === high ? `~${fmt(low)} for the day` : `~${fmt(low)}–${fmt(high)} for the day`;
  return { low, high, label };
}

// WMO weather code → human condition string whose words match getWeatherEmoji's
// substring checks (thunder/snow/rain/drizzle/shower/fog/overcast/partly/cloudy/clear).
const WMO_CONDITION = {
  0:'Clear', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
  45:'Fog', 48:'Fog',
  51:'Light drizzle', 53:'Drizzle', 55:'Heavy drizzle',
  56:'Freezing drizzle', 57:'Freezing drizzle',
  61:'Light rain', 63:'Rain', 65:'Heavy rain',
  66:'Freezing rain', 67:'Freezing rain',
  71:'Light snow', 73:'Snow', 75:'Heavy snow', 77:'Snow',
  80:'Rain showers', 81:'Rain showers', 82:'Heavy rain showers',
  85:'Snow showers', 86:'Snow showers',
  95:'Thunderstorm', 96:'Thunderstorm', 99:'Thunderstorm',
};
export function wmoToCondition(code) { return WMO_CONDITION[code] ?? 'Partly cloudy'; }

// Degrees → 16-point compass (matches the wind_dir style the app used).
export function degToCompass(deg) {
  if (deg == null) return null;
  const pts = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return pts[Math.round(deg / 22.5) % 16];
}

// True when a stop has a synthetic live-research place_id (find_/stop_) but enough
// real info (name + coords) to look the venue up in Google for contact links.
export function shouldResolveContact(stop) {
  if (!stop || stop.website || stop.phone) return false;
  if (!stop.name || stop.lat == null || stop.lng == null) return false;
  return /^(find_|stop_)/.test(stop.place_id || '');
}

// Pick the forecast for dateISO from an Open-Meteo daily payload. 7-day window.
export function pickForecastFromOpenMeteo(om, dateISO) {
  const d = om?.daily;
  const times = Array.isArray(d?.time) ? d.time : [];
  if (!times.length) return null;
  const i = times.indexOf(dateISO);
  if (i === -1) {
    const beyond = dateISO > times[times.length - 1];
    return { condition:null, temp_f:null, feels_like_f:null, wind_speed_mph:null, wind_dir:null, beyondForecast: beyond };
  }
  const r = (a) => (a?.[i] == null ? null : Math.round(a[i]));
  return {
    condition: wmoToCondition(d.weather_code?.[i]),
    temp_f: r(d.temperature_2m_max),
    feels_like_f: r(d.apparent_temperature_max),
    wind_speed_mph: r(d.wind_speed_10m_max),
    wind_dir: degToCompass(d.wind_direction_10m_dominant?.[i]),
    beyondForecast: false,
  };
}
