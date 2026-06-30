const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

// Places API (New) v1 field mask covering everything the client detail view reads.
// The legacy Places Details API is not enabled for this project, so we call v1 and
// translate the response into the legacy `{ status, result }` shape the client expects.
const V1_FIELD_MASK = 'id,displayName,rating,userRatingCount,nationalPhoneNumber,websiteUri,regularOpeningHours,priceLevel';

const PRICE_ENUM_TO_NUM = {
  PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function toLegacyResult(p) {
  if (!p) return null;
  return {
    name: p.displayName?.text ?? null,
    rating: p.rating ?? null,
    user_ratings_total: p.userRatingCount ?? null,
    formatted_phone_number: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    price_level: p.priceLevel != null ? (PRICE_ENUM_TO_NUM[p.priceLevel] ?? null) : null,
    opening_hours: p.regularOpeningHours ? {
      open_now: p.regularOpeningHours.openNow,
      weekday_text: p.regularOpeningHours.weekdayDescriptions,
    } : undefined,
  };
}

export async function GET(request) {
  if (!GOOGLE_KEY) return Response.json({ error: 'api_key_missing' }, { status: 500 });
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('place_id');
  if (!placeId) return Response.json({ error: 'missing_place_id' }, { status: 400 });
  try {
    const r = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?key=${GOOGLE_KEY}`,
      { headers: { 'X-Goog-FieldMask': V1_FIELD_MASK } },
    );
    const data = await r.json();
    if (!r.ok) {
      return Response.json({ status: 'ERROR', error_message: data.error?.message ?? 'places_v1_error' }, { status: r.status });
    }
    return Response.json({ status: 'OK', result: toLegacyResult(data) }, { status: 200 });
  } catch (e) {
    return Response.json({ error: 'network', message: e.message }, { status: 500 });
  }
}
