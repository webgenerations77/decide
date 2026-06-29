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
