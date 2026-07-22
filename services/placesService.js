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

// Places Autocomplete (New) — per-keystroke prediction with session tokens + soft
// location bias. Returns Google's `{ suggestions: [{ placePrediction }] }` shape.
// locationBias is a preference only (never a hard restriction), so far-away places
// still resolve. Billing note: pair every autocomplete session with a Place Details
// call carrying the SAME sessionToken (getPlaceLocation) to close the session.
export function autocompletePlaces({ input, sessionToken, locationBias }) {
  return postPlaces('autocomplete', { input, sessionToken, locationBias });
}

// Generate a session token client-side (RFC4122-ish v4). No dependency — Google
// accepts any opaque string for the autocomplete/details session pairing.
export function newSessionToken() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function placeDetails(placeId, fields) {
  const qs = `place_id=${encodeURIComponent(placeId)}${fields ? `&fields=${encodeURIComponent(fields)}` : ''}`;
  const res = await fetch(`${getApiBase()}/api/places/details?${qs}`);
  return res.json();
}

// Resolve an autocomplete placeId to coordinates + formatted address, passing the
// SAME sessionToken so Google closes (and correctly bills) the autocomplete session.
// Reuses the shared /api/places/details proxy (which now also returns geometry +
// formatted_address in its legacy `{ status, result }` shape).
export async function getPlaceLocation(placeId, sessionToken) {
  const qs = `place_id=${encodeURIComponent(placeId)}${sessionToken ? `&sessionToken=${encodeURIComponent(sessionToken)}` : ''}`;
  const res = await fetch(`${getApiBase()}/api/places/details?${qs}`);
  return res.json();
}

// Build a keyless proxy URL for a Places (New) v1 photo resource name
// ("places/.../photos/..."). The proxy 302-redirects to the real image, so the
// returned URL can be used directly as an <Image> `uri`.
export function placePhotoUrl(name, maxWidth = 800) {
  return name ? `${getApiBase()}/api/places/photo?name=${encodeURIComponent(name)}&maxWidth=${maxWidth}` : null;
}
