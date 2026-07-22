import { logUsage } from '../../lib/usageLog.js';
import { runSmartEngine } from '../../lib/smart/index.js';
import { computeCostSummary, pickForecastFromOpenMeteo, attachPriceLevels, fillFoodPriceLevels, shouldResolveContact, withHours, parseLocationLabel } from '../../lib/itineraryHelpers.js';
import { getUSHoliday } from '../../lib/smart/holidays.js';
import { getUidFromAuth } from '../../lib/admin/auth.js';
import { runWithUser } from '../../lib/usageContext.js';
import { getClarifyingQuestion } from '../../lib/clarify.js';

const GOOGLE_KEY    = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const NPS_KEY       = process.env.EXPO_PUBLIC_NPS_API_KEY;
const RIDB_KEY      = process.env.EXPO_PUBLIC_RIDB_API_KEY;
const OPENROUTE_KEY = process.env.EXPO_PUBLIC_OPENROUTE_API_KEY;
const NEARBY_URL    = 'https://places.googleapis.com/v1/places:searchNearby';

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

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R    = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateDriveTime(distanceMiles) {
  return Math.max(3, Math.round(distanceMiles / 0.5));
}

async function fetchPlaces(lat, lng, types, radius = 30000) {
  const res = await fetch(`${NEARBY_URL}?key=${GOOGLE_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,' +
        'places.rating,places.userRatingCount,places.currentOpeningHours,' +
        'places.regularOpeningHours,' +
        'places.location,places.priceLevel,places.editorialSummary',
    },
    // NOTE: intentionally NOT sending `priceLevels`. In Places (New) v1 Nearby Search it acts
    // as a hard exclusion filter that would drop unpriced/free venues (parks, beaches, many
    // restaurants) and remove the pool synthesis needs for a "splurge". Budget is enforced
    // softly in the synthesis prompt instead (see lib/smart/synthesis.js).
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
    openingPeriods:     p.regularOpeningHours?.periods ?? p.currentOpeningHours?.periods ?? null,
    lat:                p.location?.latitude ?? 0,
    lng:                p.location?.longitude ?? 0,
  }));
}

function getWeatherEmoji(condition) {
  if (!condition) return '🌤';
  const c = condition.toLowerCase();
  if (c.includes('thunder'))                               return '⛈';
  if (c.includes('snow') || c.includes('blizzard') || c.includes('ice')) return '❄️';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return '🌧';
  if (c.includes('fog') || c.includes('mist') || c.includes('haze'))       return '🌫';
  if (c.includes('wind') || c.includes('breezy') || c.includes('gale'))    return '🌬';
  if (c.includes('overcast'))                              return '☁️';
  if (c.includes('partly') || c.includes('mostly'))       return '🌤';
  if (c.includes('cloudy'))                               return '☁️';
  if (c.includes('sunny') || c.includes('clear'))         return '☀️';
  return '🌤';
}

async function fetchWeather(lat, lng, dateISO) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
      + `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,wind_speed_10m_max,wind_direction_10m_dominant,sunrise,sunset`
      + `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=7`;
    const res  = await fetch(url);
    const data = await res.json();
    const f = pickForecastFromOpenMeteo(data, dateISO);
    if (!f) return null;
    if (f.beyondForecast) return { beyondForecast: true, condition: null, emoji: '🗓', temp_f: null, feels_like_f: null, wind_speed_mph: null, wind_dir: null, sunrise: null, sunset: null };
    return { condition: f.condition, emoji: getWeatherEmoji(f.condition), temp_f: f.temp_f, feels_like_f: f.feels_like_f, wind_speed_mph: f.wind_speed_mph, wind_dir: f.wind_dir, sunrise: f.sunrise, sunset: f.sunset, beyondForecast: false };
  } catch {
    return null;
  }
}

async function reverseGeocode(lat, lng) {
  if (!GOOGLE_KEY) return { city: null, state: null };
  try {
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`);
    const data = await res.json();
    if (data.results?.length > 0) {
      const parts = data.results[0].address_components;
      const get   = (t) => parts.find((c) => c.types.includes(t));
      return {
        city:  get('locality')?.long_name ?? get('sublocality')?.long_name ?? null,
        state: get('administrative_area_level_1')?.short_name ?? null,
      };
    }
  } catch {}
  return { city: null, state: null };
}

async function fetchNPSParks(city, state) {
  if (!NPS_KEY || !city) return [];
  try {
    const params = new URLSearchParams({ q: city, limit: '5', api_key: NPS_KEY });
    if (state) params.set('stateCode', state);
    const res  = await fetch(`https://developer.nps.gov/api/v1/parks?${params}`);
    const data = await res.json();
    return (data.data ?? []).map((p) => ({
      name:               p.fullName,
      place_id:           `nps_${p.id}`,
      address:            p.addresses?.[0]
        ? `${p.addresses[0].city}, ${p.addresses[0].stateCode}`
        : city + (state ? `, ${state}` : ''),
      rating:             4.5,
      user_ratings_total: 1000,
      price_level:        'PRICE_LEVEL_INEXPENSIVE',
      is_open:            true,
      summary:            p.description?.slice(0, 150) ?? null,
      lat:                parseFloat(p.latitude)  || 0,
      lng:                parseFloat(p.longitude) || 0,
    }));
  } catch {
    return [];
  }
}

async function fetchRIDB(lat, lng) {
  if (!RIDB_KEY) return [];
  try {
    const url  = `https://ridb.recreation.gov/api/v1/facilities?latitude=${lat}&longitude=${lng}&radius=25&limit=5&apikey=${RIDB_KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    return (data.RECDATA ?? []).map((f) => ({
      name:               f.FacilityName,
      place_id:           `ridb_${f.FacilityID}`,
      address:            (f.FacilityAdaAccess ?? '').trim(),
      rating:             4.2,
      user_ratings_total: 200,
      price_level:        'PRICE_LEVEL_INEXPENSIVE',
      is_open:            true,
      summary:            f.FacilityDescription
        ? f.FacilityDescription.replace(/<[^>]*>/g, '').slice(0, 150)
        : null,
      lat: parseFloat(f.FacilityLatitude)  || lat,
      lng: parseFloat(f.FacilityLongitude) || lng,
    }));
  } catch {
    return [];
  }
}

async function enrichWithDrivingTimes(itinerary) {
  if (!OPENROUTE_KEY || itinerary.length < 2) return itinerary;
  const pairs = [];
  for (let i = 0; i < itinerary.length - 1; i++) {
    const a = itinerary[i], b = itinerary[i + 1];
    if (a.lat && a.lng && b.lat && b.lng) {
      pairs.push({ i, coords: [[a.lng, a.lat], [b.lng, b.lat]] });
    }
  }
  if (pairs.length === 0) return itinerary;
  const results = await Promise.allSettled(
    pairs.map(async ({ i, coords }) => {
      const res  = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: OPENROUTE_KEY },
        body: JSON.stringify({ coordinates: coords }),
      });
      const data = await res.json();
      return { i, drive_mins: Math.round((data.routes?.[0]?.summary?.duration ?? 0) / 60) };
    })
  );
  const updated = [...itinerary];
  results.forEach((r) => {
    if (r.status === 'fulfilled') {
      updated[r.value.i] = { ...updated[r.value.i], drive_to_next_mins: r.value.drive_mins };
    }
  });
  return updated;
}

async function fetchStopDetails(placeId) {
  if (!GOOGLE_KEY || !placeId || /^(demo_|nps_|ridb_|fallback_|find_|stop_)/.test(placeId)) return null;
  try {
    // Places API (New) v1 — legacy Places Details is not enabled for this project.
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?key=${GOOGLE_KEY}`, {
      headers: { 'X-Goog-FieldMask': 'websiteUri,nationalPhoneNumber,photos' },
    });
    const data = await res.json();
    if (!res.ok) return null;
    return { website: data.websiteUri ?? null, phone: data.nationalPhoneNumber ?? null, photo: data.photos?.[0]?.name ?? null };
  } catch { return null; }
}

// Resolve a real Google place_id for a live-research stop from its name + location,
// so its contact links can be fetched. Returns null on any miss/failure.
async function resolvePlaceId(name, lat, lng) {
  if (!GOOGLE_KEY || !name) return null;
  try {
    // Places API (New) v1 searchText — legacy findplacefromtext is not enabled.
    const res = await fetch(`https://places.googleapis.com/v1/places:searchText?key=${GOOGLE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': 'places.id' },
      body: JSON.stringify({
        textQuery: name,
        maxResultCount: 1,
        ...(lat != null && lng != null
          ? { locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 5000 } } }
          : {}),
      }),
    });
    const data = await res.json();
    logUsage({ route: 'places-searchtext', model: 'google-places', requests: 1 });
    return data.places?.[0]?.id ?? null;
  } catch { return null; }
}

async function enrichWithContactLinks(itinerary) {
  const out = await Promise.all(itinerary.map(async (stop) => {
    // Always attempt a details fetch for a real Google place_id so we can grab the
    // photo — even when the stop already carries website/phone from live research.
    // (Synthetic ids — demo_/nps_/ridb_/fallback_/find_/stop_ — return null cheaply.)
    let d = await fetchStopDetails(stop.place_id);
    if (!d && shouldResolveContact(stop)) {
      const realId = await resolvePlaceId(stop.name, stop.lat, stop.lng);
      if (realId) d = await fetchStopDetails(realId); // realId is a real Google id → passes the guard
    }
    if (!d) return stop;
    // Photo always merges; website/phone only fill gaps so research-sourced links win.
    return {
      ...stop,
      photo:   stop.photo   ?? d.photo,
      website: stop.website ?? d.website,
      phone:   stop.phone   ?? d.phone,
    };
  }));
  return out;
}

function extractJSON(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
}

function timeToMinutes(t) {
  const [time, period] = t.split(' ');
  const [h, m = '0']   = time.split(':');
  let hour = parseInt(h, 10);
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour * 60 + parseInt(m, 10);
}

function minutesToTime(total) {
  const h    = Math.floor(total / 60) % 24;
  const m    = total % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function buildFallbackItinerary({ food, activity, shopping, outdoor, startTime, endTime, pace, lat, lng }) {
  const startMins = timeToMinutes(startTime);
  const endMins   = timeToMinutes(endTime);
  const targetCount = pace === 'relaxed' ? 4 : pace === 'packed' ? 7 : 5;
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  const SEQUENCES = {
    4: ['outdoor',  'food', 'activity', 'food'],
    5: ['activity', 'food', 'outdoor',  'shopping', 'food'],
    6: ['outdoor',  'food', 'activity', 'outdoor',  'shopping', 'food'],
    7: ['activity', 'outdoor', 'food',  'activity', 'shopping', 'outdoor', 'food'],
  };
  const template = SEQUENCES[clamp(targetCount, 4, 7)];

  const pools = {
    food:     [...food].sort((a, b) => b.rating - a.rating),
    activity: [...activity].sort((a, b) => b.rating - a.rating),
    outdoor:  [...outdoor].sort((a, b) => b.rating - a.rating),
    shopping: [...shopping].sort((a, b) => b.rating - a.rating),
  };
  const cursors = { food: 0, activity: 0, outdoor: 0, shopping: 0 };
  const used    = new Set();
  const stops   = [];
  let   current = startMins;

  for (const cat of template) {
    if (current >= endMins - 45) break;
    const pool = pools[cat] ?? [];
    let place  = null;
    while (cursors[cat] < pool.length) {
      const candidate = pool[cursors[cat]++];
      if (!used.has(candidate.place_id)) { place = candidate; used.add(candidate.place_id); break; }
    }
    const duration = cat === 'food' ? 60 : 75;
    const label    = cat.charAt(0).toUpperCase() + cat.slice(1);
    stops.push({
      time:            minutesToTime(current),
      duration_mins:   duration,
      category:        cat,
      name:            place?.name     ?? `Nearby ${label}`,
      place_id:        place?.place_id ?? `fallback_${cat}_${stops.length}`,
      address:         place?.address  ?? '',
      lat:             place?.lat      ?? lat,
      lng:             place?.lng      ?? lng,
      reason:          place?.summary  ?? `A well-rated local ${cat} spot nearby.`,
      excitement_score: place ? Math.min(Math.round((place.rating || 4) * 18), 95) : 72,
    });
    current += duration + 20;
  }
  return stops;
}

export async function GET() {
  return Response.json({ status: 'ok', message: 'Itinerary API is running' });
}

export async function POST(request) {
  const uid = await getUidFromAuth(request.headers.get('authorization'));
  return runWithUser(uid, async () => {
    // Cheddar's single follow-up clarifying question (folded in from /api/clarify to stay under
    // Vercel's 12-function cap). Fails open to { skip: true }; never blocks generation.
    if (new URL(request.url).searchParams.get('mode') === 'clarify') {
      const { tripNote = '' } = await request.json().catch(() => ({}));
      return Response.json(await getClarifyingQuestion(tripNote));
    }
    try {
      const {
        latitude, longitude, date, preferences = {},
        startTime = '11:00 AM', endTime = '8:00 PM',
        feedback = {},
        maxDistanceMiles = 25,
        tripNote = '',
        locationLabel = '',
        locationShort = '',
      } = await request.json();

      if (!latitude || !longitude) {
        return Response.json({ error: 'latitude and longitude are required' }, { status: 400 });
      }

      const { pace = 'moderate', budget = '$$', group_type = 'couple', cuisines = [], sensitivities = [], activityStyles = [], dietary = [], neurodivergent = false } = preferences;
      const searchRadiusMeters = Math.round(Math.min(maxDistanceMiles, 50) * 1609.34);
      const { dislikedPlaces = [], likedPlaces = [], dislikedReasons = [] } = feedback;

      const dateObj      = date ? new Date(date) : new Date();
      const dayOfWeek    = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
      const formattedDate = dateObj.toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      });
      const travelDateISO = dateObj.toISOString().slice(0, 10);

      // Prefer a client-supplied human label for locality; reverse-geocode is the fallback.
      const hasLabel = !!(locationLabel && String(locationLabel).trim());
      const [food, activity, shopping, outdoor, weather, geoInfo] = await Promise.all([
        fetchPlaces(latitude, longitude, PLACE_TYPES.food,     searchRadiusMeters),
        fetchPlaces(latitude, longitude, PLACE_TYPES.activity, searchRadiusMeters),
        fetchPlaces(latitude, longitude, PLACE_TYPES.shopping, searchRadiusMeters),
        fetchPlaces(latitude, longitude, PLACE_TYPES.outdoor,  searchRadiusMeters),
        fetchWeather(latitude, longitude, travelDateISO),
        hasLabel ? Promise.resolve(null) : reverseGeocode(latitude, longitude),
      ]);

      const { city, state } = hasLabel ? parseLocationLabel(locationLabel, locationShort) : geoInfo;

      const cityStr = hasLabel ? locationLabel : (city ? `${city}${state ? `, ${state}` : ''}` : 'the local area');

      const [npsParks, ridbFacilities] = await Promise.all([
        fetchNPSParks(city, state),
        fetchRIDB(latitude, longitude),
      ]);

      const allOutdoor = [...outdoor, ...npsParks, ...ridbFacilities];

      // Annotate each place with a compact "hours" string for the plan weekday (0=Sun..6=Sat).
      const planWeekday = dateObj.getDay();
      const annotate = (arr) => (arr || []).map((pl) => withHours(pl, planWeekday));

      const ctx = {
        location: cityStr,
        travelDates: { start: travelDateISO, end: travelDateISO },
        coords: { latitude, longitude },
        maxMiles: Math.min(maxDistanceMiles, 50),
        weather,
        sun: weather ? { sunrise: weather.sunrise ?? null, sunset: weather.sunset ?? null } : null,
        prefs: { pace, budget, group_type, cuisines, activityStyles, dietary, neurodivergent },
        feedback: { likedPlaces, dislikedPlaces, dislikedReasons },
        tripNote,
        startTime, endTime,
        dayOfWeek,
        formattedDate,
        holiday: getUSHoliday(travelDateISO),
      };
      const smart = await runSmartEngine({ ctx, places: { food: annotate(food), activity: annotate(activity), shopping: annotate(shopping), outdoor: annotate(allOutdoor) } });

      let itinerary, isFallback = false;
      if (smart.itinerary && smart.itinerary.length) {
        itinerary = smart.itinerary;
      } else {
        itinerary = buildFallbackItinerary({
          food, activity, shopping, outdoor: allOutdoor,
          startTime, endTime, pace, lat: latitude, lng: longitude,
        });
        isFallback = true;
      }

      const withDistance = itinerary.map((stop) => {
        if (!stop.lat || !stop.lng) return stop;
        const distMiles = haversineDistance(latitude, longitude, stop.lat, stop.lng);
        const driveMins = estimateDriveTime(distMiles);
        const planMonth = dateObj.getMonth();
        const trafficNote = (weather?.wind_speed_mph > 20 || (planMonth >= 5 && planMonth <= 8))
          ? ' (traffic may vary)' : '';
        return {
          ...stop,
          distance: `${distMiles.toFixed(1)} mi · ~${driveMins} min drive${trafficNote}`,
          distance_miles: parseFloat(distMiles.toFixed(1)),
          drive_mins: driveMins,
        };
      });
      const withLinks = await enrichWithContactLinks(withDistance);
      const enriched = await enrichWithDrivingTimes(withLinks);
      const allPlaces = [...food, ...activity, ...shopping, ...allOutdoor];
      const priced = fillFoodPriceLevels(attachPriceLevels(enriched, allPlaces), budget);
      const costSummary = computeCostSummary(priced);

      return Response.json({
        itinerary: priced,
        weather,
        meta: {
          date:         formattedDate,
          day_of_week:  dayOfWeek,
          time_window:  `${startTime} – ${endTime}`,
          preferences:  { pace, budget, group_type },
          city:         cityStr,
          cost_summary: costSummary?.label ?? null,
        },
        discovery: {
          hadLiveData: smart.hadLiveData,
          findCount: smart.finds.length,
          anchorCount: smart.anchors.length,
          anchors: smart.anchors.map((a) => ({ title: a.find?.title, interest: a.find?.interest, why: a.rationale, url: a.find?.url || null })),
          localHappenings: smart.localHappenings ?? null,
        },
        generated_at: new Date().toISOString(),
        isFallback,
      });
    } catch (err) {
      console.error('[itinerary] error:', err);
      return Response.json({ error: err.message }, { status: 500 });
    }
  });
}
