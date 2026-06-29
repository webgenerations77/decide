# Design — Session 1: Move Google Places calls server-side (CORS fix)

**Date:** 2026-06-29
**Batch:** `cheddar-bug-fixes-and-features.md` — Session 1 of 6
**Branch:** `session-1-cors-places-server-side`

## Problem

Manual location search and Quick Spin fail on the web build with CORS errors:

```
Access to fetch at 'https://corsproxy.io/?https%3A%2F%2Fplaces.googleapis.com/v1/places:searchText'
from origin 'https://decide-app-six.vercel.app' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check.
```

The client routes Google Places calls through `corsproxy.io` on web (`Platform.OS === 'web'`),
and corsproxy.io now rejects the preflight. On native the client calls Google directly using
`EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`, which — because of the `EXPO_PUBLIC_` prefix — is also
baked into the web client bundle, exposing the key.

## Goal

Move **all** Google Places calls server-side (web *and* native), eliminate corsproxy.io, and
take the API key off the client entirely. Decisions confirmed with the user:

- **Scope:** full server-side (route web + native through server routes; key off client).
- **Place Details:** include a third route (`details`) since `plan.js` also proxies through corsproxy.

## Current corsproxy.io / direct-Google call sites

| File | Call | Google API |
|---|---|---|
| `screens/SettingsScreen.js:64` (`searchLocation`) | manual location search | `places:searchText` |
| `screens/SpinScreen.js:34` (`googleFetchUrl`/`fetchNearbyPlaces`) | Quick Spin | `places:searchNearby` |
| `app/fallback.js:160` (`fetchAlternatives`) | Quick Spin alternatives | `places:searchNearby` |
| `app/(tabs)/plan.js:227` (stop detail modal) | place detail | legacy Place Details (`maps/api/place/details/json`) |
| `app/(tabs)/plan.js:698` (GPS label fallback) | reverse geocode | legacy `maps/api/geocode/json` |

`app/auth/login.js` uses `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` for Google **Sign-In** (OAuth) — out of scope, leave untouched.

## Architecture

### Server proxy routes (dual handler pattern)

Production runs the Vercel functions (`api/*.js`, `handler(req, res)`). The Expo Router API
routes (`app/api/*+api.js`, `Request`/`Response`) are inactive in the web build
(`app.json` → `web.output: "single"`) but serve native dev via `getApiBase()` → Expo dev
host. Both are created to honor the established dual pattern.

Each route is a **thin pass-through proxy**: it injects the server key, forwards the caller's
`X-Goog-FieldMask` header (or query for details) with a sane default, calls Google, and returns
Google's JSON and status verbatim. Client-side result mapping is unchanged.

| Vercel (prod) | Expo (native dev) | Proxies | Method |
|---|---|---|---|
| `api/places/search-text.js` | `app/api/places/search-text+api.js` | `places:searchText` | POST |
| `api/places/search-nearby.js` | `app/api/places/search-nearby+api.js` | `places:searchNearby` | POST |
| `api/places/details.js` | `app/api/places/details+api.js` | `maps/api/place/details/json` | GET (`place_id`, `fields`) |

Key resolution in every route: `process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`.
Missing key → `500 { error: 'api_key_missing' }`. Network error → `500 { error: 'network', message }`.

Vercel auto-detects nested `api/places/*.js` as functions; `vercel.json` rewrite
`/api/(.*) → /api/$1` keeps them from being swallowed by the SPA fallback. The
`functions` glob `api/*.js` (maxDuration 60) does not match the subdirectory, so the proxies
use the default duration — fine for a single Google call.

### Client service `services/placesService.js`

Mirrors `itineraryService.getApiBase()` (web → `''`; native → `http://<expo-host>:8081`).

```js
searchTextPlaces(body, fieldMask)      // POST /api/places/search-text
searchNearbyPlaces(body, fieldMask)    // POST /api/places/search-nearby
placeDetails(placeId, fields)          // GET  /api/places/details?place_id=&fields=
```

Returns parsed Google JSON. Each caller keeps its existing field mask + mapping.
`plan.js`'s reverse-geocode fallback is pointed at the **existing** `/api/geocode?lat=&lng=`
(returns `{ label, city, state }`) — no new route, no client key.

### Client edits (remove all client key usage)

- `screens/SettingsScreen.js` — `searchLocation` calls `searchTextPlaces`; drop `GOOGLE_KEY`, drop the corsproxy/`Platform.OS` branch. Keep `'api_key'` / `'not_found'` / `'network'` return contract.
- `screens/SpinScreen.js` — `fetchNearbyPlaces` calls `searchNearbyPlaces`; remove `GOOGLE_KEY`, `NEARBY_URL`, `googleFetchUrl`.
- `app/fallback.js` — `fetchAlternatives` calls `searchNearbyPlaces`; remove the `apiKey` read and corsproxy branch. Keep the `!lat || !lng` guard (drop the `!apiKey` part).
- `app/(tabs)/plan.js` — stop-detail effect calls `placeDetails(pid, fields)` and reads `data.result`; GPS fallback calls `/api/geocode?lat=&lng=` and reads `data.label`. Remove `GOOGLE_KEY` and both `!GOOGLE_KEY` guards (keep the demo/external/`!pid` guard).

### Env var rename (de-expose the key)

`EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` → `GOOGLE_PLACES_API_KEY` in `.env` and `.env.example`.
Server readers updated to the `GOOGLE_PLACES_API_KEY || EXPO_PUBLIC_...` fallback so prod keeps
working through the Vercel env migration:

- `api/itinerary.js:3`
- `api/itinerary-swap.js:1`
- `app/api/geocode+api.js:1`
- `app/api/itinerary+api.js:3`
- `app/api/itinerary-swap+api.js:3`
- (the 3 new routes)

`api/smart/*` does not read the Google key — no change.

Update `CLAUDE.md` env-var docs (line ~127) to reflect the server-only name.

## Error handling

- Proxy returns Google's status code and JSON body verbatim, so existing client error checks
  (`data.error?.status === 'PERMISSION_DENIED'`, `!data.places?.length`, `data.result`) keep working.
- Key missing server-side → `500 { error: 'api_key_missing' }`; clients already degrade to their error states.
- Fetch failure → caught, `500 { error: 'network' }`.

## Testing / verification

No automated test harness exists for these screens. Manual verification (per the doc's
"before closing"):

1. Web build (`npx expo export --platform web` or dev) — manual location search in Settings
   returns suggestions with **no CORS error** in console.
2. Web — Quick Spin returns a result with no CORS error.
3. Web — a generated itinerary stop's detail modal shows phone/website (Place Details proxy works).
4. Native dev — same three flows still work via the Expo dev-host routes.
5. Confirm `corsproxy.io` no longer appears anywhere: `grep -rn corsproxy.io app/ screens/`.
6. Confirm `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` no longer read in client files.

## Out of scope

- Sessions 2–6 of the batch.
- Google Sign-In (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`).
- Caching/rate-limiting the new proxies (the existing itinerary route caches Places separately).

## Manual deploy step (flag to user at session end)

1. Add `GOOGLE_PLACES_API_KEY` to the Vercel project env (same value as the current key).
2. Redeploy; verify the live build (deploy-gotchas: failed builds silently freeze prod).
3. Once confirmed, remove `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` from Vercel env to fully
   de-expose the key, and redeploy again.
