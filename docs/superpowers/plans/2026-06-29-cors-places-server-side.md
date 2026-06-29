# Server-Side Places Routes (CORS Fix) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate corsproxy.io by routing all Google Places calls through server-side proxy routes, and take the API key off the client bundle.

**Architecture:** Thin pass-through proxy routes in the existing dual-handler pattern (Vercel `api/*.js` = prod; Expo `app/api/*+api.js` = native dev). A new `services/placesService.js` calls them via the established `getApiBase()` pattern. Clients keep their own field masks and result mapping; only the transport changes. The env var is renamed off the `EXPO_PUBLIC_` prefix to de-expose it, with a server-side fallback so prod survives the Vercel env migration.

**Tech Stack:** Expo SDK 56, expo-router API routes, Vercel serverless functions (Node `handler(req,res)`), React Native, plain `.mjs` node test scripts.

## Global Constraints

- Expo SDK 56 — reference https://docs.expo.dev/versions/v56.0.0/ before writing Expo code.
- All npm installs use `--legacy-peer-deps` (no new deps in this plan).
- Client-side env vars require `EXPO_PUBLIC_` prefix; server-only vars must NOT have it.
- No hardcoded hex — colors from `constants/theme.js` (no UI color changes here).
- AI assistant is "Cheddar" in user-facing text (no user-facing copy added here).
- Cobalt-led, no orange CTAs (no new CTAs here).
- Vercel: missing env var silently freezes prod — server key reads MUST keep an `EXPO_PUBLIC_` fallback.
- Run node tests from `decide-app/` with: `GOOGLE_PLACES_API_KEY=test-key node __tests__/<file>.mjs`.

---

### Task 1: Server proxy routes + node test

**Files:**
- Create: `api/places/search-text.js` (Vercel)
- Create: `api/places/search-nearby.js` (Vercel)
- Create: `api/places/details.js` (Vercel)
- Create: `app/api/places/search-text+api.js` (Expo)
- Create: `app/api/places/search-nearby+api.js` (Expo)
- Create: `app/api/places/details+api.js` (Expo)
- Test: `__tests__/places-proxy.mjs`

**Interfaces:**
- Consumes: `global.fetch`, `process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`.
- Produces (HTTP routes for later tasks):
  - `POST /api/places/search-text` — body = Google `places:searchText` body; header `X-Goog-FieldMask` forwarded. Returns Google JSON + status.
  - `POST /api/places/search-nearby` — body = Google `places:searchNearby` body; header `X-Goog-FieldMask` forwarded. Returns Google JSON + status.
  - `GET /api/places/details?place_id=<id>&fields=<csv>` — returns legacy Place Details JSON (`{ result, status }`) + status.
  - All: `500 { error: 'api_key_missing' }` if no key; `500 { error: 'network', message }` on fetch failure; `405 { error: 'method_not_allowed' }` (search routes, non-POST); `400 { error: 'missing_place_id' }` (details, no id).

- [ ] **Step 1: Write the failing test** — `__tests__/places-proxy.mjs`

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd decide-app && node __tests__/places-proxy.mjs`
Expected: FAIL — `Cannot find module '../api/places/search-text.js'` (routes not created yet).

- [ ] **Step 3: Create the three Vercel routes**

`api/places/search-text.js`:
```js
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const DEFAULT_FIELD_MASK = 'places.id,places.displayName,places.location,places.addressComponents,places.formattedAddress';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!GOOGLE_KEY) return res.status(500).json({ error: 'api_key_missing' });
  try {
    const fieldMask = req.headers['x-goog-fieldmask'] || DEFAULT_FIELD_MASK;
    const r = await fetch(`https://places.googleapis.com/v1/places:searchText?key=${GOOGLE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': fieldMask },
      body: JSON.stringify(req.body ?? {}),
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'network', message: e.message });
  }
}
```

`api/places/search-nearby.js`:
```js
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const DEFAULT_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours,places.editorialSummary,places.location';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!GOOGLE_KEY) return res.status(500).json({ error: 'api_key_missing' });
  try {
    const fieldMask = req.headers['x-goog-fieldmask'] || DEFAULT_FIELD_MASK;
    const r = await fetch(`https://places.googleapis.com/v1/places:searchNearby?key=${GOOGLE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': fieldMask },
      body: JSON.stringify(req.body ?? {}),
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'network', message: e.message });
  }
}
```

`api/places/details.js`:
```js
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const DEFAULT_FIELDS = 'name,rating,user_ratings_total,formatted_phone_number,website,opening_hours,price_level';

export default async function handler(req, res) {
  if (!GOOGLE_KEY) return res.status(500).json({ error: 'api_key_missing' });
  const placeId = req.query.place_id;
  const fields  = req.query.fields || DEFAULT_FIELDS;
  if (!placeId) return res.status(400).json({ error: 'missing_place_id' });
  try {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${encodeURIComponent(fields)}&key=${GOOGLE_KEY}`
    );
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'network', message: e.message });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd decide-app && node __tests__/places-proxy.mjs`
Expected: PASS — `11 passed, 0 failed`.

- [ ] **Step 5: Create the three Expo routes** (mirror the Vercel logic with `Request`/`Response`)

`app/api/places/search-text+api.js`:
```js
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const DEFAULT_FIELD_MASK = 'places.id,places.displayName,places.location,places.addressComponents,places.formattedAddress';

export async function POST(request) {
  if (!GOOGLE_KEY) return Response.json({ error: 'api_key_missing' }, { status: 500 });
  try {
    const fieldMask = request.headers.get('x-goog-fieldmask') || DEFAULT_FIELD_MASK;
    const body = await request.json();
    const r = await fetch(`https://places.googleapis.com/v1/places:searchText?key=${GOOGLE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': fieldMask },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    return Response.json(data, { status: r.status });
  } catch (e) {
    return Response.json({ error: 'network', message: e.message }, { status: 500 });
  }
}
```

`app/api/places/search-nearby+api.js`:
```js
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const DEFAULT_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours,places.editorialSummary,places.location';

export async function POST(request) {
  if (!GOOGLE_KEY) return Response.json({ error: 'api_key_missing' }, { status: 500 });
  try {
    const fieldMask = request.headers.get('x-goog-fieldmask') || DEFAULT_FIELD_MASK;
    const body = await request.json();
    const r = await fetch(`https://places.googleapis.com/v1/places:searchNearby?key=${GOOGLE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': fieldMask },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    return Response.json(data, { status: r.status });
  } catch (e) {
    return Response.json({ error: 'network', message: e.message }, { status: 500 });
  }
}
```

`app/api/places/details+api.js`:
```js
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const DEFAULT_FIELDS = 'name,rating,user_ratings_total,formatted_phone_number,website,opening_hours,price_level';

export async function GET(request) {
  if (!GOOGLE_KEY) return Response.json({ error: 'api_key_missing' }, { status: 500 });
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('place_id');
  const fields  = searchParams.get('fields') || DEFAULT_FIELDS;
  if (!placeId) return Response.json({ error: 'missing_place_id' }, { status: 400 });
  try {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${encodeURIComponent(fields)}&key=${GOOGLE_KEY}`
    );
    const data = await r.json();
    return Response.json(data, { status: r.status });
  } catch (e) {
    return Response.json({ error: 'network', message: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add api/places __tests__/places-proxy.mjs "app/api/places"
git commit -m "feat: add server-side Google Places proxy routes (search-text, search-nearby, details)"
```

---

### Task 2: Client API-base util + placesService

**Files:**
- Create: `services/apiBase.js`
- Create: `services/placesService.js`

**Interfaces:**
- Consumes: `react-native` `Platform`, `expo-constants` `Constants` (already in package.json).
- Produces (for later tasks):
  - `getApiBase(): string` — `''` on web; `http://<expo-host>:8081` on native.
  - `searchTextPlaces(body: object, fieldMask?: string): Promise<object>` — POST `/api/places/search-text`, returns parsed JSON.
  - `searchNearbyPlaces(body: object, fieldMask?: string): Promise<object>` — POST `/api/places/search-nearby`, returns parsed JSON.
  - `placeDetails(placeId: string, fields?: string): Promise<object>` — GET `/api/places/details`, returns parsed JSON.

> No node test: these import `react-native`/`expo-constants`, which don't load under bare node. Verified by the consuming tasks (3–5) at runtime and by the export check in Step 3.

- [ ] **Step 1: Create `services/apiBase.js`**

```js
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Web build talks to same-origin Vercel functions; native dev talks to the Expo dev host.
export function getApiBase() {
  if (Platform.OS === 'web') return '';
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:8081`;
  }
  return 'http://localhost:8081';
}
```

- [ ] **Step 2: Create `services/placesService.js`**

```js
import { getApiBase } from './apiBase';

async function postPlaces(path, body, fieldMask) {
  const res = await fetch(`${getApiBase()}/api/places/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(fieldMask ? { 'X-Goog-FieldMask': fieldMask } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function searchTextPlaces(body, fieldMask) {
  return postPlaces('search-text', body, fieldMask);
}

export function searchNearbyPlaces(body, fieldMask) {
  return postPlaces('search-nearby', body, fieldMask);
}

export async function placeDetails(placeId, fields) {
  const qs = `place_id=${encodeURIComponent(placeId)}${fields ? `&fields=${encodeURIComponent(fields)}` : ''}`;
  const res = await fetch(`${getApiBase()}/api/places/details?${qs}`);
  return res.json();
}
```

- [ ] **Step 3: Verify exports exist**

Run: `cd decide-app && grep -E "export (function|async function)" services/placesService.js services/apiBase.js`
Expected: shows `getApiBase`, `searchTextPlaces`, `searchNearbyPlaces`, `placeDetails`.

- [ ] **Step 4: Commit**

```bash
git add services/apiBase.js services/placesService.js
git commit -m "feat: add placesService + shared getApiBase for server Places routes"
```

---

### Task 3: Wire Quick Spin (SpinScreen + fallback.js) to searchNearbyPlaces

**Files:**
- Modify: `screens/SpinScreen.js` (remove lines 17–18 `GOOGLE_KEY`/`NEARBY_URL`, remove `googleFetchUrl` at 33–38, rewrite `fetchNearbyPlaces`)
- Modify: `app/fallback.js` (remove `apiKey` read + corsproxy branch in `fetchAlternatives`, ~lines 153–180)

**Interfaces:**
- Consumes: `searchNearbyPlaces(body, fieldMask)` from Task 2.

- [ ] **Step 1: Update `screens/SpinScreen.js`**

Add the import near the other service imports (after line 11):
```js
import { searchNearbyPlaces } from '../services/placesService';
```
Delete lines 17–18:
```js
const GOOGLE_KEY  = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const NEARBY_URL  = 'https://places.googleapis.com/v1/places:searchNearby';
```
Delete the `googleFetchUrl` function (lines 33–38). Replace `fetchNearbyPlaces` (lines 40–67) with:
```js
async function fetchNearbyPlaces(lat, lng, types) {
  const data = await searchNearbyPlaces(
    {
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 20000 } },
      maxResultCount: 20,
      includedTypes: types,
    },
    'places.id,places.displayName,places.formattedAddress,places.rating,places.editorialSummary,places.location',
  );
  return (data.places ?? []).map((p) => ({
    name:     p.displayName?.text ?? '',
    place_id: p.id ?? '',
    address:  p.formattedAddress ?? '',
    rating:   p.rating ?? 0,
    summary:  p.editorialSummary?.text ?? null,
    lat:      p.location?.latitude ?? lat,
    lng:      p.location?.longitude ?? lng,
  }));
}
```

- [ ] **Step 2: Check whether `Platform` is still used in SpinScreen.js**

Run: `cd decide-app && grep -n "Platform" screens/SpinScreen.js`
If the only remaining hit is the import line, remove `Platform,` from the `react-native` import (line 4). If `Platform.` appears elsewhere, leave the import.

- [ ] **Step 3: Update `app/fallback.js`**

Add the import near the top with the other imports:
```js
import { searchNearbyPlaces } from '../services/placesService';
```
In `fetchAlternatives`, replace the block at lines 153–181 (the `apiKey` read through the `fetch(...)` call) with:
```js
      if (!lat || !lng) {
        setError('Location data missing — go back and try again.');
        return;
      }

      const types = CATEGORY_TYPES[category];
      const data = await searchNearbyPlaces(
        {
          locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } },
          maxResultCount: 20,
          includedTypes:  types,
        },
        'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours,places.location',
      );
```
Leave everything from `if (!data.places?.length)` onward unchanged.

- [ ] **Step 4: Check whether `Platform` is still used in fallback.js**

Run: `cd decide-app && grep -n "Platform" app/fallback.js`
If only the import remains, remove `Platform` from the `react-native` import; otherwise leave it.

- [ ] **Step 5: Verify no corsproxy / client key left in these files**

Run: `cd decide-app && grep -nE "corsproxy|EXPO_PUBLIC_GOOGLE_PLACES_API_KEY" screens/SpinScreen.js app/fallback.js`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add screens/SpinScreen.js app/fallback.js
git commit -m "fix: route Quick Spin nearby search through server proxy (no corsproxy/client key)"
```

---

### Task 4: Wire manual location search (SettingsScreen) to searchTextPlaces

**Files:**
- Modify: `screens/SettingsScreen.js` (remove line 19 `GOOGLE_KEY`, rewrite `searchLocation` lines 61–93)

**Interfaces:**
- Consumes: `searchTextPlaces(body, fieldMask)` from Task 2.

- [ ] **Step 1: Update `screens/SettingsScreen.js`**

Add the import near the other service imports:
```js
import { searchTextPlaces } from '../services/placesService';
```
Delete line 19:
```js
const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
```
Replace `searchLocation` (lines 61–93) with:
```js
async function searchLocation(text) {
  if (!text || text.length < 3) return null;
  try {
    const data = await searchTextPlaces(
      { textQuery: text, languageCode: 'en', pageSize: 5 },
      'places.id,places.displayName,places.location,places.addressComponents,places.formattedAddress',
    );
    if (data.error === 'api_key_missing' || data.error?.status === 'PERMISSION_DENIED') return { error: 'api_key' };
    if (!data.places?.length) return { error: 'not_found' };
    const results = data.places.map((p) => {
      const parts = p.addressComponents ?? [];
      const get   = (t) => parts.find((c) => c.types?.includes(t));
      const city  = p.displayName?.text ?? get('locality')?.longText ?? get('sublocality')?.longText;
      const state = get('administrative_area_level_1')?.shortText;
      const short = city && state ? `${city}, ${state}`
                  : p.formattedAddress?.split(',').slice(0, 2).join(',').trim();
      return { label: p.formattedAddress ?? short, short, latitude: p.location?.latitude, longitude: p.location?.longitude };
    }).filter((r) => r.latitude && r.longitude);
    return results.length ? results : { error: 'not_found' };
  } catch {
    return { error: 'network' };
  }
}
```

- [ ] **Step 2: Check whether `Platform` is still used in SettingsScreen.js**

Run: `cd decide-app && grep -n "Platform" screens/SettingsScreen.js`
If only the import remains, remove `Platform` from the `react-native` import; otherwise leave it.

- [ ] **Step 3: Verify no corsproxy / client key left in this file**

Run: `cd decide-app && grep -nE "corsproxy|EXPO_PUBLIC_GOOGLE_PLACES_API_KEY" screens/SettingsScreen.js`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add screens/SettingsScreen.js
git commit -m "fix: route manual location search through server proxy (no corsproxy/client key)"
```

---

### Task 5: Wire plan.js (Place Details + reverse-geocode fallback)

**Files:**
- Modify: `app/(tabs)/plan.js` (remove line 25 `GOOGLE_KEY`; stop-detail effect ~216–233; GPS reverse-geocode fallback ~695–711)

**Interfaces:**
- Consumes: `placeDetails(placeId, fields)` from Task 2; `getApiBase()` from Task 2; existing `/api/geocode?lat=&lng=` route (returns `{ label, city, state }`).

- [ ] **Step 1: Update imports in `app/(tabs)/plan.js`**

Add near the top with other imports:
```js
import { placeDetails } from '../../services/placesService';
import { getApiBase } from '../../services/apiBase';
```
Delete line 25:
```js
const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
```

- [ ] **Step 2: Update the stop-detail effect (lines ~216–233)**

Change the guard at line 219 from `if (isDemo || isExternal || !GOOGLE_KEY || !pid)` to:
```js
    if (isDemo || isExternal || !pid) {
```
Replace lines 226–232 (the `base`/`url`/`fetch` block) with:
```js
    const fields = 'name,rating,user_ratings_total,formatted_phone_number,website,opening_hours,price_level';
    placeDetails(pid, fields)
      .then((data) => { setPlaceDetails(data.result ?? null); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
```

- [ ] **Step 3: Update the GPS reverse-geocode fallback (lines ~695–711)**

Replace the `if (!label && GOOGLE_KEY) { ... }` block with:
```js
        if (!label) {
          try {
            const res  = await fetch(`${getApiBase()}/api/geocode?lat=${latitude}&lng=${longitude}`);
            const data = await res.json();
            if (data.label) label = data.label;
          } catch (e) {
            console.warn('[location] geocode fetch failed:', e?.message ?? e);
          }
        }
```

- [ ] **Step 4: Check whether `Platform` is still used in plan.js**

Run: `cd decide-app && grep -n "Platform" "app/(tabs)/plan.js"`
If only the import remains, remove `Platform` from the `react-native` import; otherwise leave it.

- [ ] **Step 5: Verify no corsproxy / client key / direct googleapis call left in this file**

Run: `cd decide-app && grep -nE "corsproxy|EXPO_PUBLIC_GOOGLE_PLACES_API_KEY|maps.googleapis.com" "app/(tabs)/plan.js"`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/plan.js"
git commit -m "fix: route plan.js place details + reverse geocode through server (no corsproxy/client key)"
```

---

### Task 6: Rename env var off EXPO_PUBLIC_ and de-expose the key

**Files:**
- Modify: `.env` (rename key, keep value)
- Modify: `.env.example:30`
- Modify: `api/itinerary.js:3`
- Modify: `api/itinerary-swap.js:1`
- Modify: `app/api/geocode+api.js:1`
- Modify: `app/api/itinerary+api.js:3`
- Modify: `app/api/itinerary-swap+api.js:3`
- Modify: `CLAUDE.md` (env-var docs, ~line 127)

**Interfaces:**
- Produces: server key now read as `process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` everywhere; `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` no longer present as a primary var in `.env`/`.env.example`.

- [ ] **Step 1: Rename the var in `.env` and `.env.example`**

In `.env`, change the line `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=<value>` to `GOOGLE_PLACES_API_KEY=<value>` (preserve the existing value).
In `.env.example` line 30, change `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=` to `GOOGLE_PLACES_API_KEY=`.

- [ ] **Step 2: Update the five server key readers**

In each of these files, change the `GOOGLE_KEY`/`apiKey` assignment to the fallback form:
```js
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
```
- `api/itinerary.js:3` (`const GOOGLE_KEY    = ...`)
- `api/itinerary-swap.js:1` (`const GOOGLE_KEY = ...`)
- `app/api/geocode+api.js:1` (`const GOOGLE_KEY = ...`)
- `app/api/itinerary+api.js:3` (`const GOOGLE_KEY    = ...`)
- `app/api/itinerary-swap+api.js:3` (`const GOOGLE_KEY = ...`)

- [ ] **Step 3: Update `CLAUDE.md` env docs**

Change line ~127 from:
```
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY= (Places Nearby, Autocomplete, Details, Geocoding)
```
to:
```
GOOGLE_PLACES_API_KEY=             (server-only; Places Nearby, Autocomplete, Details, Geocoding — proxied via /api/places/* and /api/geocode)
```

- [ ] **Step 4: Verify no client file reads the key, and all Places traffic is server-side**

Run: `cd decide-app && grep -rnE "corsproxy" app/ screens/`
Expected: no output.
Run: `cd decide-app && grep -rn "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY" app/ screens/ services/ | grep -v "app/api/"`
Expected: no output (only `app/api/*` server routes retain it as the `||` fallback).

- [ ] **Step 5: Re-run the proxy test (regression)**

Run: `cd decide-app && node __tests__/places-proxy.mjs`
Expected: PASS — `11 passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add .env.example api/itinerary.js api/itinerary-swap.js "app/api/geocode+api.js" "app/api/itinerary+api.js" "app/api/itinerary-swap+api.js" CLAUDE.md
git commit -m "refactor: make Google Places key server-only (GOOGLE_PLACES_API_KEY) with EXPO_PUBLIC fallback"
```
> `.env` is gitignored — do not `git add` it; the value change is local-only.

---

## Final verification (run after all tasks)

- [ ] `cd decide-app && node __tests__/places-proxy.mjs` → `11 passed, 0 failed`.
- [ ] `cd decide-app && grep -rnE "corsproxy" app/ screens/` → no output.
- [ ] `cd decide-app && grep -rn "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY" app/ screens/ services/ | grep -v "app/api/"` → no output.
- [ ] Manual (web dev `npx expo start --web`): manual location search in Settings returns suggestions, **no CORS error** in console.
- [ ] Manual (web): Quick Spin returns a result, no CORS error.
- [ ] Manual (web): a generated itinerary stop's detail modal shows phone/website (details proxy).
- [ ] Manual (native dev): the same three flows still work via Expo dev-host routes.

## Manual deploy step (NOT a code task — flag to the user)

1. Add `GOOGLE_PLACES_API_KEY` to the Vercel project env (same value as the old key).
2. Redeploy; verify the live build works (deploy-gotchas: failed builds silently freeze prod).
3. Once confirmed, remove `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` from Vercel env to fully de-expose the key; redeploy and verify again.
