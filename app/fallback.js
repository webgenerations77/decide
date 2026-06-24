import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

// Same confirmed Table A types as HomeScreen
const CATEGORY_TYPES = {
  food: [
    'restaurant', 'cafe', 'bar', 'bakery', 'barbecue_restaurant',
    'coffee_shop', 'diner', 'donut_shop', 'fast_food_restaurant',
    'fine_dining_restaurant', 'french_restaurant', 'gastropub',
    'german_restaurant', 'greek_restaurant', 'hamburger_restaurant',
    'ice_cream_shop', 'indian_restaurant', 'italian_restaurant',
    'japanese_restaurant', 'korean_restaurant', 'lebanese_restaurant',
    'mexican_restaurant', 'pizza_restaurant', 'pub', 'ramen_restaurant',
    'sandwich_shop', 'seafood_restaurant', 'steak_house', 'sushi_restaurant',
    'thai_restaurant', 'vegan_restaurant', 'vegetarian_restaurant',
    'vietnamese_restaurant', 'wine_bar', 'american_restaurant',
    'chinese_restaurant',
  ],
  activity: [
    'amusement_center', 'amusement_park', 'amphitheatre', 'aquarium',
    'art_gallery', 'art_museum', 'bowling_alley', 'casino', 'comedy_club',
    'concert_hall', 'cultural_center', 'dance_hall', 'event_venue',
    'fitness_center', 'go_karting_venue', 'hiking_area', 'ice_skating_rink',
    'karaoke', 'live_music_venue', 'movie_theater', 'museum', 'night_club',
    'opera_house', 'park', 'performing_arts_theater',
    'sports_complex', 'stadium', 'tourist_attraction', 'water_park', 'zoo',
  ],
  anything: [
    'restaurant', 'cafe', 'bar', 'amusement_park', 'art_gallery',
    'bowling_alley', 'casino', 'comedy_club', 'concert_hall', 'event_venue',
    'karaoke', 'live_music_venue', 'movie_theater', 'museum', 'night_club',
    'park', 'performing_arts_theater', 'spa', 'tourist_attraction', 'zoo',
  ],
};

const CATEGORY_EMOJI = { food: '🍽️', activity: '🎭', anything: '⚡' };

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deriveProsAndCons(rating, userRatingsTotal, isOpenNow) {
  const pros = [];
  const cons = [];
  const r       = parseFloat(rating)        || 0;
  const reviews = parseInt(userRatingsTotal, 10) || 0;

  if (r >= 4.5)                          pros.push('Exceptional rating');
  else if (r >= 4.0)                     pros.push('Highly rated');
  else if (r > 0 && r < 3.5)             cons.push('Mixed reviews');

  if (reviews > 500)                     pros.push('Very popular');
  else if (reviews > 100)                pros.push('Well established');
  else if (reviews > 0 && reviews < 20)  cons.push('Few reviews');

  if (isOpenNow)                         pros.push('Open right now');
  else                                   cons.push('Check hours');

  return { pros: pros.slice(0, 3), cons: cons.slice(0, 2) };
}

function PlaceCard({ place }) {
  const { pros, cons } = deriveProsAndCons(place.rating, place.userRatingsTotal, place.isOpenNow);
  const emoji = place.emoji || CATEGORY_EMOJI[place.category] || '⚡';

  const handleGo = () => {
    const url = `https://www.google.com/maps/search/?api=1`
      + `&query=${encodeURIComponent(place.name)}`
      + (place.placeId ? `&query_place_id=${place.placeId}` : '');
    Linking.openURL(url);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardEmoji}>{emoji}</Text>
          <Text style={styles.cardName} numberOfLines={1}>{place.name}</Text>
          {place.excitementScore != null && (
            <View style={styles.exciteBadge}>
              <Text style={styles.exciteText}>⚡{place.excitementScore}</Text>
            </View>
          )}
        </View>

        <Text style={styles.vicinity} numberOfLines={2}>{place.vicinity}</Text>

        <View style={styles.metaRow}>
          {place.rating > 0 && (
            <Text style={styles.metaText}>⭐ {place.rating}</Text>
          )}
          {place.rating > 0 && <Text style={styles.metaDot}>·</Text>}
          {place.isOpenNow
            ? <Text style={styles.openText}>Open now</Text>
            : <Text style={styles.closedText}>Check hours</Text>
          }
        </View>

        {(pros.length > 0 || cons.length > 0) && (
          <View style={styles.prosConsBlock}>
            {pros.map((p, i) => <Text key={`p${i}`} style={styles.proLine}>✓  {p}</Text>)}
            {cons.map((c, i) => <Text key={`c${i}`} style={styles.conLine}>⚠  {c}</Text>)}
          </View>
        )}

        <TouchableOpacity style={styles.goBtn} onPress={handleGo} activeOpacity={0.7}>
          <Text style={styles.goBtnText}>LET'S GO →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function FallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [places,  setPlaces]  = useState([]);
  const [error,   setError]   = useState(null);

  const category = params.category  ?? 'anything';
  const timeframe = params.timeframe ?? 'today';
  const lat = parseFloat(params.lat);
  const lng = parseFloat(params.lng);

  let knownNames = new Set();
  if (params.knownNames) {
    try { knownNames = new Set(JSON.parse(params.knownNames)); } catch {}
  }

  useEffect(() => {
    fetchAlternatives();
  }, []);

  const fetchAlternatives = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
      if (!apiKey || !lat || !lng) {
        setError('Location data missing — go back and try again.');
        return;
      }

      const types = CATEGORY_TYPES[category];
      const endpoint = `https://places.googleapis.com/v1/places:searchNearby?key=${apiKey}`;
      const fetchUrl = Platform.OS === 'web'
        ? `https://corsproxy.io/?${encodeURIComponent(endpoint)}`
        : endpoint;

      const requestBody = {
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: 50000 },
        },
        maxResultCount: 20,
        includedTypes:  types,
      };

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type':     'application/json',
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours,places.location',
        },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();

      if (!data.places?.length) {
        setError('No additional places found. Try a different category.');
        return;
      }

      const emoji = CATEGORY_EMOJI[category] ?? '⚡';

      let candidates = data.places.map((p) => {
        const pLat = p.location?.latitude ?? 0;
        const pLng = p.location?.longitude ?? 0;
        const distanceKm = getDistanceKm(lat, lng, pLat, pLng);
        const score = Math.round(
          (p.rating ?? 0) * 20
          + Math.min(p.userRatingCount ?? 0, 500) / 5
          + (p.currentOpeningHours?.openNow ? 15 : 0)
          - distanceKm * 2
        );
        return {
          name:             p.displayName?.text ?? '',
          rating:           p.rating ?? 0,
          userRatingsTotal: p.userRatingCount ?? 0,
          placeId:          p.id ?? '',
          vicinity:         p.formattedAddress ?? '',
          isOpenNow:        p.currentOpeningHours?.openNow ?? false,
          excitementScore:  score,
          emoji,
        };
      });

      if (timeframe === 'today') {
        const openNow = candidates.filter((p) => p.isOpenNow);
        if (openNow.length >= 3) candidates = openNow;
      }

      // Filter out places already shown on the previous screen
      const fresh = candidates
        .filter((p) => !knownNames.has(p.name))
        .sort((a, b) => b.excitementScore - a.excitementScore)
        .slice(0, 5);

      setPlaces(fresh.length > 0 ? fresh : candidates.sort((a, b) => b.excitementScore - a.excitementScore).slice(0, 5));
    } catch (err) {
      console.error('Fallback fetch error:', err);
      setError('Something went wrong. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>More Options</Text>
          {!loading && places.length > 0 && (
            <Text style={styles.subtitle}>Wider search — {places.length} found</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#00d2be" size="large" />
          <Text style={styles.loadingText}>Searching wider area...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorState}>
          <Text style={styles.errorEmoji}>😕</Text>
          <Text style={styles.errorTitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchAlternatives} activeOpacity={0.7}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {places.map((place, i) => (
            <PlaceCard key={i} place={place} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#00191f' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, marginBottom: 4,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#00262e', borderWidth: 1, borderColor: '#003040',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow:    { color: '#00D2BE', fontSize: 20, lineHeight: 22 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title:        { fontSize: 28, fontWeight: '800', color: '#ffffff' },
  subtitle:     { fontSize: 13, color: '#a855f7', marginTop: 3 },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  card: {
    backgroundColor: '#00262e', borderRadius: 20,
    borderWidth: 1, borderColor: '#003040', marginBottom: 14,
    overflow: 'hidden',
  },
  cardBody:     { padding: 16, gap: 6 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardEmoji:    { fontSize: 18 },
  cardName:     { flex: 1, fontSize: 15, fontWeight: '700', color: '#ffffff' },
  exciteBadge: {
    backgroundColor: '#9333EA', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  exciteText:   { color: '#fff', fontSize: 10, fontWeight: '700' },

  vicinity:     { fontSize: 13, color: '#666', lineHeight: 18, fontStyle: 'italic' },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText:     { fontSize: 13, color: '#888' },
  metaDot:      { fontSize: 13, color: '#444' },
  openText:     { fontSize: 13, color: '#4ade80', fontWeight: '600' },
  closedText:   { fontSize: 13, color: '#888' },

  prosConsBlock: { gap: 3 },
  proLine:  { fontSize: 13, color: '#4ade80', letterSpacing: 0.2 },
  conLine:  { fontSize: 13, color: '#f59e0b', letterSpacing: 0.2 },

  goBtn: {
    marginTop: 4, backgroundColor: '#00d2be', borderRadius: 16,
    height: 56, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#00d2be', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
  goBtnText: { color: '#00191f', fontSize: 13, fontWeight: '800', letterSpacing: 2 },

  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText:  { color: '#555', fontSize: 15 },

  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  errorEmoji: { fontSize: 48 },
  errorTitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  retryBtn: {
    marginTop: 8, backgroundColor: '#00262e', borderRadius: 16,
    height: 56, paddingHorizontal: 32,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#003040',
  },
  retryText: { color: '#00D2BE', fontSize: 15, fontWeight: '600' },
});
