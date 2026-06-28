import { firecrawlSearch } from './firecrawl.js';

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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
  SEARCH_FALLBACK,
];

export function selectSources(interest) {
  const hits = SOURCES.filter((s) => s.key !== 'search' && matchesInterest(s, interest));
  return hits.length ? hits : [SEARCH_FALLBACK];
}
