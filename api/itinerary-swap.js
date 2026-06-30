import { logUsage } from '../lib/usageLog.js';

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';

const PLACE_TYPES = {
  food: ['restaurant','cafe','bar','bakery','barbecue_restaurant','coffee_shop','diner','donut_shop','fast_food_restaurant','fine_dining_restaurant','french_restaurant','gastropub','hamburger_restaurant','ice_cream_shop','indian_restaurant','italian_restaurant','japanese_restaurant','mexican_restaurant','pizza_restaurant','seafood_restaurant','steak_house','sushi_restaurant','thai_restaurant','american_restaurant','chinese_restaurant','wine_bar'],
  activity: ['amusement_center','amusement_park','amphitheatre','aquarium','art_gallery','art_museum','bowling_alley','casino','comedy_club','concert_hall','cultural_center','dance_hall','event_venue','go_karting_venue','hiking_area','ice_skating_rink','karaoke','live_music_venue','movie_theater','museum','night_club','opera_house','performing_arts_theater','sports_complex','tourist_attraction','water_park','zoo'],
  shopping: ['shopping_mall','market','department_store','clothing_store','book_store','gift_shop'],
  outdoor: ['park','hiking_area','botanical_garden','national_park','zoo'],
};

async function fetchPlaces(lat, lng, types, radius = 30000) {
  const res = await fetch(`${NEARBY_URL}?key=${GOOGLE_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours,places.location,places.priceLevel,places.editorialSummary' },
    body: JSON.stringify({ locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } }, maxResultCount: 10, includedTypes: types }),
  });
  const data = await res.json();
  logUsage({ route: 'places-nearby', model: 'google-places', requests: 1 });
  return (data.places ?? []).map((p) => ({
    name: p.displayName?.text ?? '', place_id: p.id ?? '', address: p.formattedAddress ?? '',
    rating: p.rating ?? 0, user_ratings_total: p.userRatingCount ?? 0, price_level: p.priceLevel ?? null,
    is_open: p.currentOpeningHours?.openNow ?? false, summary: p.editorialSummary?.text ?? null,
    lat: p.location?.latitude ?? 0, lng: p.location?.longitude ?? 0,
  }));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { itinerary, stopIndex, latitude, longitude } = req.body;
    if (!itinerary || stopIndex == null || !latitude || !longitude) {
      return res.status(400).json({ error: 'itinerary, stopIndex, latitude, and longitude are required' });
    }

    const stop = itinerary[stopIndex];
    const types = PLACE_TYPES[stop.category] ?? PLACE_TYPES.activity;
    const places = await fetchPlaces(latitude, longitude, types);
    const usedNames = new Set(itinerary.map((s) => s.name));
    const available = places.filter((p) => !usedNames.has(p.name));

    if (available.length === 0) {
      return res.status(404).json({ error: `No alternative ${stop.category} places found nearby` });
    }

    const sorted = [...available].sort((a, b) => b.rating - a.rating);
    const pick = sorted[0];
    const newStop = {
      time: stop.time,
      duration_mins: stop.duration_mins,
      category: stop.category,
      name: pick.name,
      place_id: pick.place_id,
      address: pick.address,
      lat: pick.lat,
      lng: pick.lng,
      reason: pick.summary ?? `A well-rated ${stop.category} spot nearby.`,
      excitement_score: Math.min(Math.round((pick.rating || 4) * 18), 95),
    };

    const updated = [...itinerary];
    updated[stopIndex] = newStop;
    return res.json({ itinerary: updated });
  } catch (err) {
    console.error('[swap] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
