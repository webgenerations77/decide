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
