import { runSmartEngine } from './smart/index.js';

const GOOGLE_KEY    = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const NPS_KEY       = process.env.EXPO_PUBLIC_NPS_API_KEY;
const RIDB_KEY      = process.env.EXPO_PUBLIC_RIDB_API_KEY;
const OPENROUTE_KEY = process.env.EXPO_PUBLIC_OPENROUTE_API_KEY;
const NEARBY_URL    = 'https://places.googleapis.com/v1/places:searchNearby';
const CACHE_TTL     = 3600000;

const PLACE_TYPES = {
  food: ['restaurant','cafe','bar','bakery','barbecue_restaurant','coffee_shop','diner','donut_shop','fast_food_restaurant','fine_dining_restaurant','french_restaurant','gastropub','hamburger_restaurant','ice_cream_shop','indian_restaurant','italian_restaurant','japanese_restaurant','mexican_restaurant','pizza_restaurant','seafood_restaurant','steak_house','sushi_restaurant','thai_restaurant','american_restaurant','chinese_restaurant','wine_bar'],
  activity: ['amusement_center','amusement_park','amphitheatre','aquarium','art_gallery','art_museum','bowling_alley','casino','comedy_club','concert_hall','cultural_center','dance_hall','event_venue','go_karting_venue','hiking_area','ice_skating_rink','karaoke','live_music_venue','movie_theater','museum','night_club','opera_house','performing_arts_theater','sports_complex','tourist_attraction','water_park','zoo'],
  shopping: ['shopping_mall','market','department_store','clothing_store','book_store','gift_shop'],
  outdoor: ['park','hiking_area','botanical_garden','national_park','zoo'],
};
const NON_FOOD_TYPES = [...PLACE_TYPES.activity, ...PLACE_TYPES.shopping, ...PLACE_TYPES.outdoor];
const FOOD_SET = new Set(PLACE_TYPES.food);
const ACTIVITY_SET = new Set(PLACE_TYPES.activity);
const SHOPPING_SET = new Set(PLACE_TYPES.shopping);
const OUTDOOR_SET = new Set(PLACE_TYPES.outdoor);

const placesCache = new Map();
const weatherCache = new Map();
const geocodeCache = new Map();

function cacheKey(lat, lng) { return `${Math.round(lat*100)/100},${Math.round(lng*100)/100}`; }

function cacheGet(cache, key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(cache, key, data) { cache.set(key, { data, ts: Date.now() }); }

function classifyPlace(p) {
  const pt = p.primaryType || '';
  if (FOOD_SET.has(pt)) return 'food';
  if (OUTDOOR_SET.has(pt)) return 'outdoor';
  if (SHOPPING_SET.has(pt)) return 'shopping';
  if (ACTIVITY_SET.has(pt)) return 'activity';
  return 'activity';
}

async function fetchPlacesRaw(lat, lng, types, maxResults = 10) {
  const res = await fetch(`${NEARBY_URL}?key=${GOOGLE_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours,places.location,places.priceLevel,places.editorialSummary,places.primaryType' },
    body: JSON.stringify({ locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 30000 } }, maxResultCount: maxResults, includedTypes: types }),
  });
  const data = await res.json();
  return (data.places ?? []).map((p) => ({
    name: p.displayName?.text ?? '', place_id: p.id ?? '', address: p.formattedAddress ?? '',
    rating: p.rating ?? 0, user_ratings_total: p.userRatingCount ?? 0, price_level: p.priceLevel ?? null,
    is_open: p.currentOpeningHours?.openNow ?? false, summary: p.editorialSummary?.text ?? null,
    lat: p.location?.latitude ?? 0, lng: p.location?.longitude ?? 0,
    primaryType: p.primaryType ?? '',
  }));
}

async function fetchAllPlaces(lat, lng) {
  const key = cacheKey(lat, lng);
  const cached = cacheGet(placesCache, key);
  if (cached) return cached;

  const [foodRaw, nonFoodRaw] = await Promise.all([
    fetchPlacesRaw(lat, lng, PLACE_TYPES.food, 10),
    fetchPlacesRaw(lat, lng, NON_FOOD_TYPES, 20),
  ]);

  const food = foodRaw;
  const activity = [], shopping = [], outdoor = [];
  for (const p of nonFoodRaw) {
    const cat = classifyPlace(p);
    if (cat === 'outdoor') outdoor.push(p);
    else if (cat === 'shopping') shopping.push(p);
    else activity.push(p);
  }

  const result = { food, activity, shopping, outdoor };
  cacheSet(placesCache, key, result);
  return result;
}

function getWeatherEmoji(c) {
  if (!c) return '🌤';
  const l = c.toLowerCase();
  if (l.includes('thunder')) return '⛈'; if (l.includes('snow')||l.includes('blizzard')||l.includes('ice')) return '❄️';
  if (l.includes('rain')||l.includes('drizzle')||l.includes('shower')) return '🌧';
  if (l.includes('fog')||l.includes('mist')||l.includes('haze')) return '🌫';
  if (l.includes('overcast')) return '☁️'; if (l.includes('partly')||l.includes('mostly')) return '🌤';
  if (l.includes('cloudy')) return '☁️'; if (l.includes('sunny')||l.includes('clear')) return '☀️';
  return '🌤';
}

async function fetchWeather(lat, lng) {
  const key = cacheKey(lat, lng);
  const cached = cacheGet(weatherCache, key);
  if (cached) return cached;
  try {
    const res = await fetch(`https://wttr.in/${lat},${lng}?format=j1`);
    const data = await res.json();
    const c = data.current_condition?.[0]; if (!c) return null;
    const condition = c.weatherDesc?.[0]?.value ?? 'Clear';
    const result = { condition, emoji: getWeatherEmoji(condition), temp_f: c.temp_F, feels_like_f: c.FeelsLikeF, wind_speed_mph: c.windspeedMiles ?? null, wind_dir: c.winddir16Point ?? null };
    cacheSet(weatherCache, key, result);
    return result;
  } catch { return null; }
}

async function reverseGeocode(lat, lng) {
  if (!GOOGLE_KEY) return { city: null, state: null };
  const key = cacheKey(lat, lng);
  const cached = cacheGet(geocodeCache, key);
  if (cached) return cached;
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`);
    const data = await res.json();
    if (data.results?.length > 0) {
      const parts = data.results[0].address_components;
      const get = (t) => parts.find((c) => c.types.includes(t));
      const result = { city: get('locality')?.long_name ?? get('sublocality')?.long_name ?? null, state: get('administrative_area_level_1')?.short_name ?? null };
      cacheSet(geocodeCache, key, result);
      return result;
    }
  } catch {}
  return { city: null, state: null };
}

async function fetchNPSParks(city, state) {
  if (!NPS_KEY || !city) return [];
  try {
    const params = new URLSearchParams({ q: city, limit: '5', api_key: NPS_KEY });
    if (state) params.set('stateCode', state);
    const res = await fetch(`https://developer.nps.gov/api/v1/parks?${params}`);
    const data = await res.json();
    return (data.data ?? []).map((p) => ({ name: p.fullName, place_id: `nps_${p.id}`, address: p.addresses?.[0] ? `${p.addresses[0].city}, ${p.addresses[0].stateCode}` : city+(state?`, ${state}`:''), rating: 4.5, user_ratings_total: 1000, price_level: 'PRICE_LEVEL_INEXPENSIVE', is_open: true, summary: p.description?.slice(0,150)??null, lat: parseFloat(p.latitude)||0, lng: parseFloat(p.longitude)||0 }));
  } catch { return []; }
}

async function fetchRIDB(lat, lng) {
  if (!RIDB_KEY) return [];
  try {
    const res = await fetch(`https://ridb.recreation.gov/api/v1/facilities?latitude=${lat}&longitude=${lng}&radius=25&limit=5&apikey=${RIDB_KEY}`);
    const data = await res.json();
    return (data.RECDATA ?? []).map((f) => ({ name: f.FacilityName, place_id: `ridb_${f.FacilityID}`, address: (f.FacilityAdaAccess??'').trim(), rating: 4.2, user_ratings_total: 200, price_level: 'PRICE_LEVEL_INEXPENSIVE', is_open: true, summary: f.FacilityDescription ? f.FacilityDescription.replace(/<[^>]*>/g,'').slice(0,150) : null, lat: parseFloat(f.FacilityLatitude)||lat, lng: parseFloat(f.FacilityLongitude)||lng }));
  } catch { return []; }
}

async function enrichWithDrivingTimes(itinerary) {
  if (!OPENROUTE_KEY || itinerary.length < 2) return itinerary;
  const pairs = [];
  for (let i = 0; i < itinerary.length - 1; i++) { const a = itinerary[i], b = itinerary[i+1]; if (a.lat && a.lng && b.lat && b.lng) pairs.push({ i, coords: [[a.lng,a.lat],[b.lng,b.lat]] }); }
  if (!pairs.length) return itinerary;
  const results = await Promise.allSettled(pairs.map(async ({i,coords}) => { const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', { method:'POST', headers:{'Content-Type':'application/json',Authorization:OPENROUTE_KEY}, body:JSON.stringify({coordinates:coords}) }); const data = await res.json(); return {i, drive_mins: Math.round((data.routes?.[0]?.summary?.duration??0)/60)}; }));
  const updated = [...itinerary];
  results.forEach((r) => { if (r.status==='fulfilled') updated[r.value.i] = {...updated[r.value.i], drive_to_next_mins: r.value.drive_mins}; });
  return updated;
}

function extractJSON(text) { const m = text.match(/```(?:json)?\s*([\s\S]*?)```/); return m ? m[1].trim() : text.trim(); }
function timeToMinutes(t) { const [time,period]=t.split(' '); const [h,m='0']=time.split(':'); let hour=parseInt(h,10); if(period==='PM'&&hour!==12)hour+=12; if(period==='AM'&&hour===12)hour=0; return hour*60+parseInt(m,10); }
function minutesToTime(total) { const h=Math.floor(total/60)%24,m=total%60,ampm=h>=12?'PM':'AM',h12=h===0?12:h>12?h-12:h; return `${h12}:${String(m).padStart(2,'0')} ${ampm}`; }

function buildFallbackItinerary({food,activity,shopping,outdoor,startTime,endTime,pace,lat,lng}) {
  const startMins=timeToMinutes(startTime), endMins=timeToMinutes(endTime);
  const targetCount=pace==='relaxed'?4:pace==='packed'?7:5;
  const clamp=(v,lo,hi)=>Math.min(Math.max(v,lo),hi);
  const SEQUENCES={4:['outdoor','food','activity','food'],5:['activity','food','outdoor','shopping','food'],6:['outdoor','food','activity','outdoor','shopping','food'],7:['activity','outdoor','food','activity','shopping','outdoor','food']};
  const template=SEQUENCES[clamp(targetCount,4,7)];
  const pools={food:[...food].sort((a,b)=>b.rating-a.rating),activity:[...activity].sort((a,b)=>b.rating-a.rating),outdoor:[...outdoor].sort((a,b)=>b.rating-a.rating),shopping:[...shopping].sort((a,b)=>b.rating-a.rating)};
  const cursors={food:0,activity:0,outdoor:0,shopping:0}, used=new Set(), stops=[];
  let current=startMins;
  for(const cat of template){if(current>=endMins-45)break;const pool=pools[cat]??[];let place=null;while(cursors[cat]<pool.length){const c=pool[cursors[cat]++];if(!used.has(c.place_id)){place=c;used.add(c.place_id);break;}}const duration=cat==='food'?60:75;const label=cat.charAt(0).toUpperCase()+cat.slice(1);stops.push({time:minutesToTime(current),duration_mins:duration,category:cat,name:place?.name??`Nearby ${label}`,place_id:place?.place_id??`fallback_${cat}_${stops.length}`,address:place?.address??'',lat:place?.lat??lat,lng:place?.lng??lng,reason:place?.summary??`A well-rated local ${cat} spot nearby.`,excitement_score:place?Math.min(Math.round((place.rating||4)*18),95):72});current+=duration+20;}
  return stops;
}

export default async function handler(req, res) {
  if (req.method === 'GET') return res.json({ status: 'ok', message: 'Itinerary API is running' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { latitude, longitude, date, preferences = {}, startTime = '11:00 AM', endTime = '8:00 PM', feedback = {}, tripNote = '' } = req.body;
    if (!latitude || !longitude) return res.status(400).json({ error: 'latitude and longitude are required' });

    const { pace='moderate', budget='$$', group_type='couple', cuisines=[], activityStyles=[], dietary=[] } = preferences;
    const { dislikedPlaces=[], likedPlaces=[], dislikedReasons=[] } = feedback;

    const [places, weather, geoInfo] = await Promise.all([
      fetchAllPlaces(latitude, longitude),
      fetchWeather(latitude, longitude),
      reverseGeocode(latitude, longitude),
    ]);
    const { food, activity, shopping, outdoor } = places;
    const { city, state } = geoInfo;

    const dateObj=date?new Date(date):new Date();
    const dayOfWeek=dateObj.toLocaleDateString('en-US',{weekday:'long'});
    const formattedDate=dateObj.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
    const windStr=weather?.wind_speed_mph?` · Wind ${weather.wind_speed_mph}mph${weather.wind_dir?` ${weather.wind_dir}`:''}`:'';
    const weatherStr=weather?`${weather.emoji} ${weather.condition}, ${weather.temp_f}°F (feels like ${weather.feels_like_f}°F)${windStr}`:'Weather data unavailable';
    const cityStr=city?`${city}${state?`, ${state}`:''}`:'the local area';
    const travelDateISO=dateObj.toISOString().slice(0,10);

    const [npsParks, ridbFacilities] = await Promise.all([
      fetchNPSParks(city, state),
      fetchRIDB(latitude, longitude),
    ]);

    const allOutdoor=[...outdoor,...npsParks,...ridbFacilities];

    const ctx = {
      location: cityStr,
      travelDates: { start: travelDateISO, end: travelDateISO },
      coords: { latitude, longitude },
      maxMiles: 25,
      weather,
      prefs: { pace, budget, group_type, cuisines, activityStyles, dietary },
      feedback: { likedPlaces, dislikedPlaces, dislikedReasons },
      tripNote,
      startTime, endTime,
    };
    const smart = await runSmartEngine({
      ctx,
      places: { food, activity, shopping, outdoor: allOutdoor },
    });

    let itinerary, isFallback = false;
    if (smart.itinerary && smart.itinerary.length) {
      itinerary = smart.itinerary;
    } else {
      itinerary = buildFallbackItinerary({ food, activity, shopping, outdoor: allOutdoor, startTime, endTime, pace, lat: latitude, lng: longitude });
      isFallback = true;
    }
    const enriched=await enrichWithDrivingTimes(itinerary);
    return res.json({itinerary:enriched,weather,meta:{date:formattedDate,day_of_week:dayOfWeek,time_window:`${startTime} – ${endTime}`,preferences:{pace,budget,group_type},city:cityStr},discovery:{hadLiveData:smart.hadLiveData,findCount:smart.finds.length,anchorCount:smart.anchors.length,anchors:smart.anchors.map((a)=>({title:a.find?.title,interest:a.find?.interest,why:a.rationale}))},generated_at:new Date().toISOString(),isFallback});
  } catch(err) {
    console.error('[itinerary] error:',err);
    return res.status(500).json({error:err.message});
  }
}
