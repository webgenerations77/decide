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
