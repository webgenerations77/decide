let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

// Key must exist before importing the route modules (they read it at module load).
process.env.GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'test-key';

// Mock Google. Capture the last call so we can assert on URL + init.
let lastUrl, lastInit;
global.fetch = async (url, init) => {
  lastUrl = String(url); lastInit = init;
  return { status: 200, json: async () => ({ ok: true, result: { website: 'x' }, places: [] }) };
};

const { default: searchText }   = await import('../api/places/search-text.js');
const { default: searchNearby } = await import('../api/places/search-nearby.js');
const { default: details }      = await import('../api/places/details.js');

const mockRes = () => ({ _status: 200, _json: null,
  status(s) { this._status = s; return this; },
  json(j)   { this._json = j; return this; } });

// search-text: POST forwards body + field mask, injects key, returns google json
{
  const res = mockRes();
  await searchText({ method: 'POST', headers: { 'x-goog-fieldmask': 'places.id' }, body: { textQuery: 'pizza' } }, res);
  assert('search-text hits searchText endpoint', lastUrl.includes('places:searchText'));
  assert('search-text injects key', lastUrl.includes('key='));
  assert('search-text forwards field mask', lastInit.headers['X-Goog-FieldMask'] === 'places.id');
  assert('search-text forwards body', JSON.parse(lastInit.body).textQuery === 'pizza');
  assert('search-text returns google json', res._json?.ok === true);
}
// search-text: 405 on non-POST
{
  const res = mockRes();
  await searchText({ method: 'GET', headers: {}, body: null }, res);
  assert('search-text 405 on GET', res._status === 405);
}
// search-nearby: POST hits searchNearby endpoint
{
  const res = mockRes();
  await searchNearby({ method: 'POST', headers: {}, body: { maxResultCount: 5 } }, res);
  assert('search-nearby hits searchNearby endpoint', lastUrl.includes('places:searchNearby'));
}
// details: GET forwards place_id + fields, hits legacy endpoint
{
  const res = mockRes();
  await details({ method: 'GET', query: { place_id: 'abc', fields: 'name,website' }, headers: {} }, res);
  assert('details hits place/details endpoint', lastUrl.includes('/place/details/json'));
  assert('details forwards place_id', lastUrl.includes('place_id=abc'));
  assert('details forwards fields', decodeURIComponent(lastUrl).includes('fields=name,website'));
}
// details: 400 without place_id
{
  const res = mockRes();
  await details({ method: 'GET', query: {}, headers: {} }, res);
  assert('details 400 without place_id', res._status === 400);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
