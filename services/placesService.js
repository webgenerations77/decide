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

// Build a keyless proxy URL for a Places (New) v1 photo resource name
// ("places/.../photos/..."). The proxy 302-redirects to the real image, so the
// returned URL can be used directly as an <Image> `uri`.
export function placePhotoUrl(name, maxWidth = 800) {
  return name ? `${getApiBase()}/api/places/photo?name=${encodeURIComponent(name)}&maxWidth=${maxWidth}` : null;
}
