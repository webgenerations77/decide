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
