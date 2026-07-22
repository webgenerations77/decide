const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

// Places Autocomplete (New) proxy — holds the Google key server-side, same as
// search-text. Body: { input, sessionToken, locationBias }. locationBias is a soft
// preference (circle) only; Google never treats it as a hard restriction, so
// far-away places still resolve. Returns Google's `{ suggestions: [...] }` payload.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!GOOGLE_KEY) return res.status(500).json({ error: 'api_key_missing' });
  try {
    const { input, sessionToken, locationBias } = req.body ?? {};
    const body = { input };
    if (sessionToken) body.sessionToken = sessionToken;
    if (locationBias) body.locationBias = locationBias;
    const r = await fetch(`https://places.googleapis.com/v1/places:autocomplete?key=${GOOGLE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'network', message: e.message });
  }
}
