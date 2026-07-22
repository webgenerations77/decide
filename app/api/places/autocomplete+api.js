const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

// Dev twin of api/places/autocomplete.js — keep both in sync.
// Places Autocomplete (New): body { input, sessionToken, locationBias }.
export async function POST(request) {
  if (!GOOGLE_KEY) return Response.json({ error: 'api_key_missing' }, { status: 500 });
  try {
    const { input, sessionToken, locationBias } = await request.json();
    const body = { input };
    if (sessionToken) body.sessionToken = sessionToken;
    if (locationBias) body.locationBias = locationBias;
    const r = await fetch(`https://places.googleapis.com/v1/places:autocomplete?key=${GOOGLE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    return Response.json(data, { status: r.status });
  } catch (e) {
    return Response.json({ error: 'network', message: e.message }, { status: 500 });
  }
}
