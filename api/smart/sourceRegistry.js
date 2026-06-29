import { firecrawlSearch } from './firecrawl.js';
import { runLiveMusic, wantsLiveMusic } from './liveMusic.js';

// Interest tag → OSM tag the Overpass backbone queries. Add new rows here.
export const INTEREST_OSM_TAGS = {
  'arcades': 'leisure=amusement_arcade',
  'mini golf': 'leisure=miniature_golf',
  'disc golf': 'leisure=disc_golf_course',
  'climbing': 'sport=climbing',
  'skate parks': 'leisure=skatepark',
  'record stores': 'shop=music',
  'book stores': 'shop=books',
  'board game cafes': 'amenity=cafe',
  'lighthouses': 'man_made=lighthouse',
  'viewpoints': 'tourism=viewpoint',
};

const norm = (s) => (s || '').toLowerCase().trim();

const ALCOHOL_STYLE_RE = /bar|brewer|beer|wine|cocktail|drink|pub|distiller/i;

// True only when the user explicitly asked for drinking venues — via an activity
// style or a mention in their trip note. Used to gate the brewery data source so
// breweries are not injected as default filler.
export function wantsAlcohol(prefs = {}, tripNote = '') {
  const styles = (prefs.activityStyles || []).join(' ');
  return ALCOHOL_STYLE_RE.test(styles) || ALCOHOL_STYLE_RE.test(tripNote || '');
}

export function matchesInterest(source, interest) {
  const n = norm(interest);
  return (source.match || []).some((tag) => n.includes(norm(tag)) || norm(tag).includes(n));
}

async function runOverpass(ctx, interest) {
  const tag = INTEREST_OSM_TAGS[norm(interest)];
  if (!tag) return [];
  const [k, v] = tag.split('=');
  const { latitude, longitude } = ctx.coords;
  const radius = Math.round((ctx.maxMiles || 25) * 1609);
  const q = `[out:json][timeout:20];node["${k}"="${v}"](around:${radius},${latitude},${longitude});out body 12;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Decide/1.0 (itinerary app)' },
    body: 'data=' + encodeURIComponent(q),
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const data = await res.json();
  return (data.elements || []).filter((e) => e.tags?.name).map((e) => ({
    title: e.tags.name, category: 'activity', interest, lat: e.lat, lng: e.lon,
    address: [e.tags['addr:street'], e.tags['addr:city']].filter(Boolean).join(', '),
    url: e.tags.website || '', snippet: '', sourceLabel: 'OpenStreetMap',
  }));
}

async function runPinball(ctx, interest) {
  const { latitude, longitude } = ctx.coords;
  const res = await fetch(`https://pinballmap.com/api/v1/locations/closest_by_lat_lon.json?lat=${latitude}&lon=${longitude}&send_all_within_distance=1&max_distance=${ctx.maxMiles || 25}`);
  if (!res.ok) throw new Error(`pinball ${res.status}`);
  const data = await res.json();
  return (data.locations || []).slice(0, 10).map((l) => ({
    title: l.name, category: 'activity', interest, lat: parseFloat(l.lat), lng: parseFloat(l.lon),
    address: l.street ? `${l.street}, ${l.city}` : l.city, url: l.website || '',
    snippet: l.num_machines ? `${l.num_machines} machines` : '', sourceLabel: 'Pinball Map',
  }));
}

async function runBrewery(ctx, interest) {
  if (!wantsAlcohol(ctx.prefs, ctx.tripNote)) return [];
  const { latitude, longitude } = ctx.coords;
  const res = await fetch(`https://api.openbrewerydb.org/v1/breweries?by_dist=${latitude},${longitude}&per_page=8`);
  if (!res.ok) throw new Error(`brewery ${res.status}`);
  const data = await res.json();
  return (data || []).filter((b) => b.latitude && b.longitude).map((b) => ({
    title: b.name, category: 'food', interest, lat: parseFloat(b.latitude), lng: parseFloat(b.longitude),
    address: [b.street, b.city].filter(Boolean).join(', '), url: b.website_url || '',
    snippet: b.brewery_type ? `${b.brewery_type} brewery` : '', sourceLabel: 'Open Brewery DB',
  }));
}

async function runSurf(ctx, interest) {
  const { latitude, longitude } = ctx.coords;
  const res = await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&daily=wave_height_max&forecast_days=3&timezone=auto`);
  if (!res.ok) throw new Error(`surf ${res.status}`);
  const d = (await res.json()).daily || {};
  return (d.time || []).map((day, i) => ({
    title: `Surf forecast — ${day}`, category: 'outdoor', interest, lat: latitude, lng: longitude,
    address: '', when: day, url: '', snippet: d.wave_height_max?.[i] != null ? `Max wave height ~${d.wave_height_max[i]}m` : 'Wave data unavailable', sourceLabel: 'Open-Meteo',
  }));
}

async function runTides(ctx, interest) {
  const { latitude, longitude } = ctx.coords;
  const begin = (ctx.travelDates?.start || '').replace(/-/g, '');
  const res = await fetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&datum=MLLW&interval=hilo&units=english&time_zone=lst_ldt&format=json&application=decide&begin_date=${begin}&range=24&lat=${latitude}&lon=${longitude}`);
  if (!res.ok) throw new Error(`tides ${res.status}`);
  const preds = (await res.json()).predictions || [];
  return preds.map((p) => ({
    title: `${p.type === 'H' ? 'High' : 'Low'} tide`, category: 'outdoor', interest, lat: latitude, lng: longitude,
    address: '', when: p.t, url: '', snippet: `${p.v} ft`, sourceLabel: 'NOAA Tides',
  }));
}

async function runGoldenHour(ctx, interest) {
  const { latitude, longitude } = ctx.coords;
  const date = ctx.travelDates?.start || '';
  const res = await fetch(`https://api.sunrise-sunset.org/json?lat=${latitude}&lng=${longitude}&date=${date}&formatted=0`);
  if (!res.ok) throw new Error(`goldenhour ${res.status}`);
  const r = (await res.json()).results || {};
  if (!r.sunset) return [];
  return [{
    title: 'Golden hour', category: 'outdoor', interest, lat: latitude, lng: longitude, address: '',
    when: r.sunset, url: '', snippet: `Sunset ${new Date(r.sunset).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
    sourceLabel: 'sunrise-sunset.org',
  }];
}

async function runSearch(ctx, interest) {
  const results = await firecrawlSearch(ctx.query || `${interest} near ${ctx.location}`, 5);
  return results.map((r) => ({
    title: r.title, category: 'activity', interest, lat: null, lng: null, address: '',
    url: r.url, snippet: r.description, sourceLabel: 'Web',
  }));
}

const SEARCH_FALLBACK = { key: 'search', match: [], run: runSearch };

export const SOURCES = [
  { key: 'pinball',  match: ['pinball'], run: runPinball },
  { key: 'overpass', match: Object.keys(INTEREST_OSM_TAGS), run: runOverpass },
  { key: 'brewery',    match: ['brewery', 'breweries', 'craft beer', 'beer'], run: runBrewery },
  { key: 'surf',       match: ['surf', 'surfing', 'waves'], run: runSurf },
  { key: 'tides',      match: ['tides', 'tide', 'beach walk', 'tide pools'], run: runTides },
  { key: 'goldenhour', match: ['sunset', 'sunrise', 'golden hour', 'stargazing'], run: runGoldenHour },
  { key: 'livemusic', match: ['live music', 'concert', 'show', 'band', 'gig', 'dj'],
    run: async (ctx, interest) => (wantsLiveMusic(ctx.prefs, ctx.tripNote) ? runLiveMusic(ctx, interest) : []) },
  SEARCH_FALLBACK,
];

export function selectSources(interest) {
  const hits = SOURCES.filter((s) => s.key !== 'search' && matchesInterest(s, interest));
  return hits.length ? hits : [SEARCH_FALLBACK];
}
