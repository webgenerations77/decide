let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

// Key must exist before importing the route modules (they read it at module load).
process.env.GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'test-key';

// Mock Google. Capture the last call so we can assert on URL + init.
// `ok: true` matters — api/places/details.js branches on `r.ok`, so a mock without it sent
// every request down the error path and the success-path assertions were never really run.
let lastUrl, lastInit;
let nextBody = { ok: true, result: { website: 'x' }, places: [] };
global.fetch = async (url, init) => {
  lastUrl = String(url); lastInit = init;
  return { ok: true, status: 200, json: async () => nextBody };
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
// details: hits Places API (NEW) v1 and translates the response to the legacy shape.
//
// These assertions previously targeted the legacy /place/details/json endpoint with
// `place_id=` and `fields=` query params. That endpoint is not enabled for this project and
// Google no longer lets new projects enable it, so details.js was migrated to v1 — which
// takes the id in the PATH and the field list in an X-Goog-FieldMask HEADER. The test was
// never updated, so it failed against a perfectly correct implementation.
{
  nextBody = {
    id: 'abc',
    displayName: { text: 'Test Place' },
    formattedAddress: '1 Main St',
    location: { latitude: 38.3, longitude: -75.1 },
    nationalPhoneNumber: '555-0100',
    websiteUri: 'https://example.com',
    priceLevel: 'PRICE_LEVEL_MODERATE',
    regularOpeningHours: { openNow: true, weekdayDescriptions: ['Mon: 9–5'] },
  };
  const res = mockRes();
  await details({ method: 'GET', query: { place_id: 'abc' }, headers: {} }, res);

  assert('details hits Places v1 endpoint', lastUrl.includes('places.googleapis.com/v1/places/'));
  assert('details puts place_id in the path, not a query param', lastUrl.includes('/v1/places/abc'));
  assert('details injects key', lastUrl.includes('key='));
  assert('details sends the field mask as a header',
    typeof lastInit.headers['X-Goog-FieldMask'] === 'string' && lastInit.headers['X-Goog-FieldMask'].includes('displayName'));

  // The client still expects the legacy { status, result } envelope — the whole point of the
  // translation layer. If this breaks, PlaceDetailModal renders nothing.
  assert('details returns the legacy OK envelope', res._json?.status === 'OK');
  assert('details translates displayName → name', res._json?.result?.name === 'Test Place');
  assert('details translates websiteUri → website', res._json?.result?.website === 'https://example.com');
  assert('details translates the price enum to a number', res._json?.result?.price_level === 2);
  assert('details translates location → geometry', res._json?.result?.geometry?.location?.lat === 38.3);
}
// details: forwards the autocomplete session token so Google bills the session correctly
{
  const res = mockRes();
  await details({ method: 'GET', query: { place_id: 'abc', sessionToken: 'tok123' }, headers: {} }, res);
  assert('details forwards sessionToken when present', lastUrl.includes('sessionToken=tok123'));
}
// details: 400 without place_id
{
  const res = mockRes();
  await details({ method: 'GET', query: {}, headers: {} }, res);
  assert('details 400 without place_id', res._status === 400);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
