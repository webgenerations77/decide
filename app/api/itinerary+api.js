import Anthropic from '@anthropic-ai/sdk';

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
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
  return (data.places ?? []).map((p) => ({
    name: p.displayName?.text ?? '',
    place_id: p.id ?? '',
    address: p.formattedAddress ?? '',
    rating: p.rating ?? 0,
    user_ratings_total: p.userRatingCount ?? 0,
    price_level: p.priceLevel ?? null,
    is_open: p.currentOpeningHours?.openNow ?? false,
    summary: p.editorialSummary?.text ?? null,
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
  }));
}

async function fetchWeather(lat, lng) {
  try {
    const res = await fetch(`https://wttr.in/${lat},${lng}?format=j1`);
    const data = await res.json();
    const c = data.current_condition?.[0];
    if (!c) return null;
    return {
      condition: c.weatherDesc?.[0]?.value ?? 'Clear',
      temp_f: c.temp_F,
      feels_like_f: c.FeelsLikeF,
    };
  } catch {
    return null;
  }
}

function extractJSON(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
}

export async function GET() {
  return Response.json({ status: 'ok', message: 'Itinerary API is running' });
}

export async function POST(request) {
  try {
    const { latitude, longitude, date, preferences = {} } = await request.json();

    if (!latitude || !longitude) {
      return Response.json({ error: 'latitude and longitude are required' }, { status: 400 });
    }

    const { pace = 'moderate', budget = '$$', group_type = 'couple' } = preferences;

    const [food, activity, shopping, outdoor, weather] = await Promise.all([
      fetchPlaces(latitude, longitude, PLACE_TYPES.food),
      fetchPlaces(latitude, longitude, PLACE_TYPES.activity),
      fetchPlaces(latitude, longitude, PLACE_TYPES.shopping),
      fetchPlaces(latitude, longitude, PLACE_TYPES.outdoor),
      fetchWeather(latitude, longitude),
    ]);

    const dateObj = date ? new Date(date) : new Date();
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

    const weatherStr = weather
      ? `${weather.condition}, ${weather.temp_f}°F (feels like ${weather.feels_like_f}°F)`
      : 'Weather data unavailable';

    const systemPrompt =
      'You are a day planner. You receive nearby places data, weather, and user preferences. ' +
      'You return ONLY a valid JSON array of itinerary stops. No prose, no markdown, no explanation.';

    const userPrompt = `Date: ${formattedDate} (${dayOfWeek})
Weather: ${weatherStr}
User preferences: pace (${pace}), budget (${budget}), group type (${group_type})

Available places by category:
${JSON.stringify({ food, activity, shopping, outdoor }, null, 2)}

Constraints:
- Itinerary runs 11:00 AM to 8:00 PM (9 hours total)
- Include lunch around 12:00 PM–1:00 PM from the food category
- Include dinner around 6:30 PM–8:00 PM from the food category
- Mix activity types between meals: outdoor, cultural, shopping, entertainment
- Account for ~15–20 min travel time between stops
- relaxed pace: 4–5 stops. moderate: 5–6 stops. packed: 7–8 stops.
- Match price_level to budget: $ = PRICE_LEVEL_INEXPENSIVE, $$ = PRICE_LEVEL_MODERATE, $$$ = PRICE_LEVEL_EXPENSIVE
- Prefer places where is_open is true or likely open on ${dayOfWeek}
- Only use places from the data above — use their exact place_id and name
- Do not repeat the same place

Return a JSON array only. Each element must have exactly these fields:
{
  "time": "11:00 AM",
  "duration_mins": 90,
  "category": "activity",
  "name": "Place Name",
  "place_id": "ChIJ...",
  "address": "123 Main St",
  "reason": "One sentence explaining why this fits the day",
  "excitement_score": 85
}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content[0]?.text ?? '[]';
    const cleaned = extractJSON(raw);

    let itinerary;
    try {
      itinerary = JSON.parse(cleaned);
      if (!Array.isArray(itinerary)) throw new Error('Response is not an array');
    } catch {
      return Response.json({ error: 'Failed to parse itinerary from Claude', raw }, { status: 500 });
    }

    return Response.json({
      itinerary,
      weather,
      meta: {
        date: formattedDate,
        day_of_week: dayOfWeek,
        preferences: { pace, budget, group_type },
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[itinerary] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
