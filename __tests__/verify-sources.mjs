// __tests__/verify-sources.mjs — run: node __tests__/verify-sources.mjs
// Ocean City, MD reference coords.
const LAT = 38.3365, LNG = -75.0849;
const get = async (label, url, opts) => {
  try {
    const r = await fetch(url, opts);
    const t = await r.text();
    console.log(`\n=== ${label} (${r.status}) ===\n${t.slice(0, 600)}`);
  } catch (e) { console.error(`\n=== ${label} FAILED: ${e.message}`); }
};
await get('Pinball Map', `https://pinballmap.com/api/v1/locations/closest_by_lat_lon.json?lat=${LAT}&lon=${LNG}&send_all_within_distance=1&max_distance=25`);
await get('Open Brewery DB', `https://api.openbrewerydb.org/v1/breweries?by_dist=${LAT},${LNG}&per_page=5`);
await get('Open-Meteo Marine', `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LNG}&daily=wave_height_max&forecast_days=3&timezone=auto`);
await get('Overpass (arcades)', 'https://overpass-api.de/api/interpreter', { method: 'POST', body: `[out:json][timeout:20];node["leisure"="amusement_arcade"](around:25000,${LAT},${LNG});out body 10;` });
