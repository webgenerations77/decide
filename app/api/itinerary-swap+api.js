import Anthropic from '@anthropic-ai/sdk';
import { logUsage } from '../../lib/usageLog.js';
import { getUidFromAuth } from '../../lib/admin/auth.js';
import { runWithUser } from '../../lib/usageContext.js';

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';

const PLACE_TYPES = {
  food: [
    'restaurant', 'cafe', 'bar', 'bakery', 'barbecue_restaurant',
    'coffee_shop', 'diner', 'donut_shop', 'fast_food_restaurant',
    'fine_dining_restaurant', 'french_restaurant', 'gastropub',
    'hamburger_restaurant', 'ice_cream_shop', 'indian_restaurant',
    'italian_restaurant', 'japanese_restaurant', 'mexican_restaurant',
    'pizza_restaurant', 'seafood_restaurant', 'steak_house',
    'sushi_restaurant', 'thai_restaurant', 'american_restaurant',
    'chinese_restaurant', 'wine_bar',
  ],
  activity: [
    'amusement_center', 'amusement_park', 'amphitheatre', 'aquarium',
    'art_gallery', 'art_museum', 'bowling_alley', 'casino', 'comedy_club',
    'concert_hall', 'cultural_center', 'dance_hall', 'event_venue',
    'go_karting_venue', 'hiking_area', 'ice_skating_rink', 'karaoke',
    'live_music_venue', 'movie_theater', 'museum', 'night_club',
    'opera_house', 'performing_arts_theater', 'sports_complex',
    'tourist_attraction', 'water_park', 'zoo',
  ],
  shopping: [
    'shopping_mall', 'market', 'department_store', 'clothing_store',
    'book_store', 'gift_shop',
  ],
  outdoor: [
    'park', 'hiking_area', 'botanical_garden', 'national_park', 'zoo',
  ],
};

async function fetchPlaces(lat, lng, types, radius = 30000) {
  const res = await fetch(`${NEARBY_URL}?key=${GOOGLE_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,' +
        'places.rating,places.userRatingCount,places.currentOpeningHours,' +
        'places.location,places.priceLevel,places.editorialSummary',
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius },
      },
      maxResultCount: 10,
      includedTypes: types,
    }),
  });
  const data = await res.json();
  logUsage({ route: 'places-nearby', model: 'google-places', requests: 1 });
  return (data.places ?? []).map((p) => ({
    name:               p.displayName?.text ?? '',
    place_id:           p.id ?? '',
    address:            p.formattedAddress ?? '',
    rating:             p.rating ?? 0,
    user_ratings_total: p.userRatingCount ?? 0,
    price_level:        p.priceLevel ?? null,
    is_open:            p.currentOpeningHours?.openNow ?? false,
    summary:            p.editorialSummary?.text ?? null,
    lat:                p.location?.latitude ?? 0,
    lng:                p.location?.longitude ?? 0,
  }));
}

function extractJSON(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
}

export async function POST(request) {
  const uid = await getUidFromAuth(request.headers.get('authorization'));
  return runWithUser(uid, async () => {
    try {
      const { itinerary, stopIndex, latitude, longitude } = await request.json();

      if (!itinerary || stopIndex == null || !latitude || !longitude) {
        return Response.json({ error: 'itinerary, stopIndex, latitude, and longitude are required' }, { status: 400 });
      }

      const stop  = itinerary[stopIndex];
      const types = PLACE_TYPES[stop.category] ?? PLACE_TYPES.activity;
      const places = await fetchPlaces(latitude, longitude, types);

      const usedNames = new Set(itinerary.map((s) => s.name));
      const available = places.filter((p) => !usedNames.has(p.name));

      if (available.length === 0) {
        return Response.json({ error: `No alternative ${stop.category} places found nearby` }, { status: 404 });
      }

      let newStop;
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const message = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system: 'You are Cheddar, a travel planning assistant. Return ONLY a valid JSON object for a single itinerary stop. No prose, no markdown, no explanation.',
          messages: [{
            role: 'user',
            content: `Replace this itinerary stop with a different option.

Stop being replaced:
${JSON.stringify(stop, null, 2)}

Available replacement places (${stop.category}):
${JSON.stringify(available, null, 2)}

Rules:
- Keep "time" exactly as: "${stop.time}"
- Keep "duration_mins" exactly as: ${stop.duration_mins}
- Keep "category" exactly as: "${stop.category}"
- Pick a DIFFERENT place from the available list
- Write a fresh "reason" for the new pick
- Return a single JSON object with fields: time, duration_mins, category, name, place_id, address, lat, lng, reason, excitement_score, admission_cost, parking (a short caveat string for free/low-cost outdoor or public attractions where paid parking is likely — e.g. "Metered/paid lots nearby"; otherwise null)`,
          }],
        });
        logUsage({
          route: 'itinerary-swap',
          model: 'claude-haiku-4-5-20251001',
          inputTokens: message.usage?.input_tokens ?? 0,
          outputTokens: message.usage?.output_tokens ?? 0,
        });

        const raw    = message.content[0]?.text ?? '{}';
        const parsed = JSON.parse(extractJSON(raw));
        const candidate = Array.isArray(parsed) ? parsed[0] : parsed;
        if (!candidate?.name) throw new Error('Invalid stop returned');
        newStop = candidate;
      } catch (e) {
        console.warn('[swap] Claude unavailable, picking locally:', e.message);
        const pick = available[0];
        newStop = {
          time:            stop.time,
          duration_mins:   stop.duration_mins,
          category:        stop.category,
          name:            pick.name,
          place_id:        pick.place_id,
          address:         pick.address,
          lat:             pick.lat,
          lng:             pick.lng,
          reason:          pick.summary ?? `A solid alternative ${stop.category} choice nearby.`,
          excitement_score: Math.min(Math.round((pick.rating || 4) * 18), 95),
          admission_cost:  null,
          parking:         null,
        };
      }

      const updated = [...itinerary];
      updated[stopIndex] = newStop;
      return Response.json({ itinerary: updated });
    } catch (err) {
      console.error('[swap] error:', err);
      return Response.json({ error: err.message }, { status: 500 });
    }
  });
}
