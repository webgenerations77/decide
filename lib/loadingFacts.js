// Live "did you know" facts shown on the Cheddar loading screen.
// All three pull from keyless public APIs and fail soft: any fetch that errors
// or returns nothing simply yields null and is dropped — never throws.

// Open-Meteo WMO weather_code → emoji + short label.
const WEATHER_CODES = {
  0:  { emoji: '☀️', label: 'Clear' },
  1:  { emoji: '🌤️', label: 'Mostly clear' },
  2:  { emoji: '⛅', label: 'Partly cloudy' },
  3:  { emoji: '☁️', label: 'Overcast' },
  45: { emoji: '🌫️', label: 'Fog' },
  48: { emoji: '🌫️', label: 'Rime fog' },
  51: { emoji: '🌦️', label: 'Light drizzle' },
  53: { emoji: '🌦️', label: 'Drizzle' },
  55: { emoji: '🌧️', label: 'Heavy drizzle' },
  56: { emoji: '🌧️', label: 'Freezing drizzle' },
  57: { emoji: '🌧️', label: 'Freezing drizzle' },
  61: { emoji: '🌦️', label: 'Light rain' },
  63: { emoji: '🌧️', label: 'Rain' },
  65: { emoji: '🌧️', label: 'Heavy rain' },
  66: { emoji: '🌧️', label: 'Freezing rain' },
  67: { emoji: '🌧️', label: 'Freezing rain' },
  71: { emoji: '🌨️', label: 'Light snow' },
  73: { emoji: '🌨️', label: 'Snow' },
  75: { emoji: '❄️', label: 'Heavy snow' },
  77: { emoji: '🌨️', label: 'Snow grains' },
  80: { emoji: '🌦️', label: 'Showers' },
  81: { emoji: '🌧️', label: 'Showers' },
  82: { emoji: '⛈️', label: 'Violent showers' },
  85: { emoji: '🌨️', label: 'Snow showers' },
  86: { emoji: '❄️', label: 'Snow showers' },
  95: { emoji: '⛈️', label: 'Thunderstorm' },
  96: { emoji: '⛈️', label: 'Thunderstorm' },
  99: { emoji: '⛈️', label: 'Hail storm' },
};

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchWeatherCard(coords) {
  if (!coords?.latitude || !coords?.longitude) return null;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}` +
    `&longitude=${coords.longitude}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&temperature_unit=fahrenheit&timezone=auto&forecast_days=3`;
  const data  = await fetchJson(url);
  const daily = data?.daily;
  if (!daily?.time?.length) return null;
  const lines = daily.time.map((iso, i) => {
    const d        = new Date(`${iso}T00:00:00`);
    const dayLabel = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
    const wc       = WEATHER_CODES[daily.weather_code?.[i]] ?? { emoji: '🌡️', label: '' };
    const hi       = Math.round(daily.temperature_2m_max?.[i]);
    const lo       = Math.round(daily.temperature_2m_min?.[i]);
    if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
    return `${wc.emoji}  ${dayLabel} · ${hi}° / ${lo}°${wc.label ? ` · ${wc.label}` : ''}`;
  }).filter(Boolean);
  if (!lines.length) return null;
  return { key: 'weather', emoji: '☀️', title: 'Next 3 days', lines };
}

export async function fetchBornCard() {
  const now  = new Date();
  const data = await fetchJson(`https://byabbe.se/on-this-day/${now.getMonth() + 1}/${now.getDate()}/births.json`);
  const list = data?.births;
  if (!list?.length) return null;
  // Prefer an entry that links to Wikipedia (more recognizable); else the first.
  const pick = list.find((b) => b.wikipedia?.length) ?? list[0];
  if (!pick?.description) return null;
  return { key: 'born', emoji: '🎂', title: 'Born today', lines: [`${pick.year} — ${pick.description}`] };
}

export async function fetchEventCard() {
  const now  = new Date();
  const data = await fetchJson(`https://byabbe.se/on-this-day/${now.getMonth() + 1}/${now.getDate()}/events.json`);
  const list = data?.events;
  if (!list?.length) return null;
  const pick = list.find((e) => e.wikipedia?.length) ?? list[0];
  if (!pick?.description) return null;
  return { key: 'event', emoji: '📅', title: 'On this day', lines: [`${pick.year} — ${pick.description}`] };
}

// Fetch all three in parallel; return only the cards that succeeded (in order).
export async function fetchLoadingFacts(coords) {
  const results = await Promise.all([
    fetchWeatherCard(coords),
    fetchBornCard(),
    fetchEventCard(),
  ]);
  return results.filter(Boolean);
}
