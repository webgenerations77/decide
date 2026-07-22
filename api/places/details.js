const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

// Places API (New) v1 field mask covering everything the client detail view reads.
// The legacy Places Details API is not enabled for this project (and Google no longer
// lets new projects enable it), so we call v1 and translate the response back into the
// legacy `{ status, result }` shape the client already expects — no client change needed.
const V1_FIELD_MASK = 'id,displayName,location,formattedAddress,rating,userRatingCount,nationalPhoneNumber,websiteUri,regularOpeningHours,priceLevel,reviews';

const PRICE_ENUM_TO_NUM = {
  PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function toLegacyResult(p) {
  if (!p) return null;
  return {
    name: p.displayName?.text ?? null,
    formatted_address: p.formattedAddress ?? null,
    geometry: p.location ? { location: { lat: p.location.latitude, lng: p.location.longitude } } : undefined,
    rating: p.rating ?? null,
    user_ratings_total: p.userRatingCount ?? null,
    formatted_phone_number: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    price_level: p.priceLevel != null ? (PRICE_ENUM_TO_NUM[p.priceLevel] ?? null) : null,
    opening_hours: p.regularOpeningHours ? {
      open_now: p.regularOpeningHours.openNow,
      weekday_text: p.regularOpeningHours.weekdayDescriptions,
    } : undefined,
    reviews: (p.reviews || []).slice(0, 5).map((r) => ({
      author_name: r.authorAttribution?.displayName ?? null,
      author_url: r.authorAttribution?.uri ?? null,
      profile_photo_url: r.authorAttribution?.photoUri ?? null,
      rating: r.rating ?? null,
      text: r.text?.text ?? r.originalText?.text ?? '',
      relative_time_description: r.relativePublishTimeDescription ?? null,
    })),
  };
}

export default async function handler(req, res) {
  if (!GOOGLE_KEY) return res.status(500).json({ error: 'api_key_missing' });
  const placeId = req.query.place_id;
  if (!placeId) return res.status(400).json({ error: 'missing_place_id' });
  // sessionToken (optional): passed by the manual-location autocomplete flow so Google
  // closes and correctly bills the autocomplete session that produced this placeId.
  const sessionToken = req.query.sessionToken;
  try {
    const r = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?key=${GOOGLE_KEY}${sessionToken ? `&sessionToken=${encodeURIComponent(sessionToken)}` : ''}`,
      { headers: { 'X-Goog-FieldMask': V1_FIELD_MASK } },
    );
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ status: 'ERROR', error_message: data.error?.message ?? 'places_v1_error' });
    }
    return res.status(200).json({ status: 'OK', result: toLegacyResult(data) });
  } catch (e) {
    return res.status(500).json({ error: 'network', message: e.message });
  }
}
