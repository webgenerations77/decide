import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
  Linking, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { getDemoSpinResult } from '../services/demoData';
import { isAtSpinLimit, incrementSpinCount, getRemainingSpins, LIMITS } from '../services/subscriptionService';
import { COLORS } from '../constants/theme';

const GOOGLE_KEY  = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const NEARBY_URL  = 'https://places.googleapis.com/v1/places:searchNearby';

const CATEGORIES = [
  { id: 'surprise',  label: 'Surprise Me', emoji: '🎲', color: COLORS.primary,
    types: ['restaurant','cafe','art_gallery','park','museum','movie_theater','bowling_alley'] },
  { id: 'food',      label: 'Food',        emoji: '🍽️', color: COLORS.food,
    types: ['restaurant','cafe','bar','bakery','coffee_shop'] },
  { id: 'activity',  label: 'Activity',    emoji: '🎭', color: COLORS.activity,
    types: ['museum','art_gallery','bowling_alley','movie_theater','karaoke','comedy_club'] },
  { id: 'outdoor',   label: 'Outdoor',     emoji: '🌿', color: COLORS.outdoor,
    types: ['park','hiking_area','botanical_garden','zoo'] },
  { id: 'shopping',  label: 'Shopping',    emoji: '🛍️', color: COLORS.shopping,
    types: ['shopping_mall','market','book_store','gift_shop'] },
];

function googleFetchUrl() {
  const endpoint = `${NEARBY_URL}?key=${GOOGLE_KEY}`;
  return Platform.OS === 'web'
    ? `https://corsproxy.io/?${encodeURIComponent(endpoint)}`
    : endpoint;
}

async function fetchNearbyPlaces(lat, lng, types) {
  const res = await fetch(googleFetchUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,' +
        'places.rating,places.editorialSummary,places.location',
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: 20000 },
      },
      maxResultCount: 20,
      includedTypes: types,
    }),
  });
  const data = await res.json();
  return (data.places ?? []).map((p) => ({
    name:     p.displayName?.text ?? '',
    place_id: p.id ?? '',
    address:  p.formattedAddress ?? '',
    rating:   p.rating ?? 0,
    summary:  p.editorialSummary?.text ?? null,
    lat:      p.location?.latitude ?? lat,
    lng:      p.location?.longitude ?? lng,
  }));
}

export default function SpinScreen() {
  const router = useRouter();
  const [category,    setCategory]    = useState('surprise');
  const [spinning,    setSpinning]    = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState(null);
  const [coords,      setCoords]      = useState(null);
  const [locLoading,  setLocLoading]  = useState(true);
  const [remainingSpins, setRemainingSpins] = useState(null);

  const spinAnim   = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  // Load coords on mount
  useEffect(() => {
    (async () => {
      try {
        const demoRaw = await AsyncStorage.getItem('@decide/demo_mode');
        if (demoRaw === 'true') {
          setCoords({ latitude: 38.3226, longitude: -75.2179 });
          setLocLoading(false);
          return;
        }
        const modeRaw = await AsyncStorage.getItem('@decide/location_mode');
        const locRaw  = await AsyncStorage.getItem('@decide/manual_location');
        if (modeRaw === 'manual' && locRaw) {
          const loc = JSON.parse(locRaw);
          if (loc?.latitude && loc?.longitude) {
            setCoords({ latitude: loc.latitude, longitude: loc.longitude });
            setLocLoading(false);
            return;
          }
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setError('Location permission needed'); setLocLoading(false); return; }
        const pos = await Location.getCurrentPositionAsync({});
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch (e) {
        setError('Could not get location');
      } finally {
        setLocLoading(false);
      }
    })();
    getRemainingSpins().then(setRemainingSpins).catch(() => {});
  }, []);

  const spin = async () => {
    if (spinning || !coords) return;
    if (await isAtSpinLimit()) { router.push('/paywall'); return; }
    setSpinning(true);
    setResult(null);
    setError(null);

    // Spin animation
    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    try {
      const demoRaw = await AsyncStorage.getItem('@decide/demo_mode');
      if (demoRaw === 'true') {
        const cat = CATEGORIES.find((c) => c.id === category);
        const demo = getDemoSpinResult(category);
        setTimeout(() => {
          setResult({ ...demo, place_id: `demo_${category}`, address: demo.address ?? 'Eastern Shore, MD', rating: (demo.excitement_score / 20).toFixed(1) * 1, categoryId: cat.id, categoryEmoji: cat.emoji, categoryColor: cat.color });
          setSpinning(false);
          bounceAnim.setValue(0);
          Animated.spring(bounceAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
        }, 1000);
        return;
      }

      const cat    = CATEGORIES.find((c) => c.id === category);
      const places = await fetchNearbyPlaces(coords.latitude, coords.longitude, cat.types);
      if (!places.length) throw new Error('No places found nearby');

      // Weighted random: higher-rated places more likely
      const pool = places.filter((p) => p.name);
      const weights = pool.map((p) => Math.max(p.rating, 3));
      const total   = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let pick = pool[0];
      for (let i = 0; i < pool.length; i++) {
        r -= weights[i];
        if (r <= 0) { pick = pool[i]; break; }
      }

      setTimeout(async () => {
        setResult({ ...pick, categoryId: cat.id, categoryEmoji: cat.emoji, categoryColor: cat.color });
        setSpinning(false);
        bounceAnim.setValue(0);
        Animated.spring(bounceAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
        await incrementSpinCount().catch(() => {});
        getRemainingSpins().then(setRemainingSpins).catch(() => {});
      }, 1000);
    } catch (e) {
      setTimeout(() => {
        setError(e.message ?? 'Something went wrong');
        setSpinning(false);
      }, 1000);
    }
  };

  const handleGo = () => {
    if (!result) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.address || result.name)}&query_place_id=${result.place_id}`;
    Linking.openURL(url);
  };

  const spinRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '720deg'],
  });
  const cardScale = bounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  const activeCat = CATEGORIES.find((c) => c.id === category);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={styles.title}>QUICK SPIN</Text>
        <Text style={styles.sub}>Instant pick, no overthinking</Text>
        {remainingSpins != null && remainingSpins !== Infinity && (
          <Text style={styles.remainingText}>{remainingSpins}/{LIMITS.FREE_SPINS_PER_DAY} spins remaining today</Text>
        )}

        {/* Category pills */}
        <View style={styles.catRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catPill, category === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
              onPress={() => { setCategory(cat.id); setResult(null); setError(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.catPillTxt, category === cat.id && styles.catPillTxtActive]}>
                {cat.emoji} {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Spin button */}
        <View style={styles.spinWrap}>
          {locLoading ? (
            <ActivityIndicator color={COLORS.teal} size="large" />
          ) : (
            <TouchableOpacity
              style={[styles.spinBtn, { borderColor: activeCat.color + '88', shadowColor: activeCat.color }]}
              onPress={spin}
              disabled={spinning || !coords}
              activeOpacity={0.7}
            >
              <Animated.Text style={[styles.spinEmoji, { transform: [{ rotate: spinRotation }] }]}>
                {spinning ? '🎲' : activeCat.emoji}
              </Animated.Text>
              <Text style={[styles.spinLabel, spinning && styles.spinLabelActive]}>
                {spinning ? 'SPINNING...' : 'SPIN'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Result card */}
        {result && !spinning && (
          <Animated.View style={[styles.resultCard, { borderLeftColor: result.categoryColor, transform: [{ scale: cardScale }] }]}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultEmoji}>{result.categoryEmoji}</Text>
              <Text style={styles.resultName} numberOfLines={2}>{result.name}</Text>
            </View>
            {result.summary ? (
              <Text style={styles.resultReason} numberOfLines={3}>{result.summary}</Text>
            ) : null}
            {result.address ? (
              <Text style={styles.resultAddress} numberOfLines={1}>📍 {result.address}</Text>
            ) : null}
            {result.rating > 0 ? (
              <Text style={styles.resultRating}>⭐ {result.rating.toFixed(1)}</Text>
            ) : null}

            <View style={styles.resultActions}>
              <TouchableOpacity style={styles.goBtn} onPress={handleGo} activeOpacity={0.7}>
                <Text style={styles.goBtnTxt}>LET'S GO →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.againBtn} onPress={spin} activeOpacity={0.7}>
                <Text style={styles.againBtnTxt}>🎲 Spin Again</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Error */}
        {error && !spinning && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTxt}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={spin} activeOpacity={0.7}>
              <Text style={styles.retryBtnTxt}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40,
    alignItems: 'center',
  },

  title: {
    fontSize: 28, fontWeight: '800', color: COLORS.textPrimary,
    letterSpacing: 5, textAlign: 'center',
    textShadowColor: COLORS.primaryDark, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14,
  },
  sub:           { fontSize: 13, color: COLORS.teal, marginTop: 6, marginBottom: 8 },
  remainingText: { fontSize: 11, color: COLORS.textMuted, marginBottom: 16 },

  // Category pills
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 32 },
  catPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  catPillTxt:       { fontSize: 13, fontWeight: '600', color: COLORS.teal },
  catPillTxtActive: { color: COLORS.bg },

  // Spin button
  spinWrap: { marginBottom: 32, alignItems: 'center' },
  spinBtn: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: COLORS.surface, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  spinEmoji:       { fontSize: 52 },
  spinLabel:       { fontSize: 12, fontWeight: '800', color: COLORS.teal, letterSpacing: 3 },
  spinLabelActive: { color: COLORS.primary },

  // Result card
  resultCard: {
    width: '100%', backgroundColor: COLORS.surface,
    borderRadius: 16, borderWidth: 0.5, borderColor: COLORS.border, borderLeftWidth: 3,
    padding: 16, gap: 8, overflow: 'hidden',
  },
  resultHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultEmoji:   { fontSize: 24 },
  resultName:    { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  resultReason:  { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, fontStyle: 'italic' },
  resultAddress: { fontSize: 13, color: COLORS.textSecondary },
  resultRating:  { fontSize: 13, color: COLORS.teal },

  resultActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  goBtn: {
    flex: 1, backgroundColor: COLORS.primary, borderRadius: 16,
    height: 56, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  goBtnTxt: { color: COLORS.primaryText, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  againBtn: {
    paddingHorizontal: 16, borderRadius: 16,
    height: 56, justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center',
  },
  againBtnTxt: { fontSize: 13, color: COLORS.teal, fontWeight: '600' },

  // Error
  errorBox: {
    marginTop: 16, backgroundColor: COLORS.surfaceAlt, borderRadius: 12,
    borderWidth: 1, borderColor: '#991b1b44', padding: 14,
  },
  errorTxt: { fontSize: 13, color: COLORS.error, textAlign: 'center', marginBottom: 8 },
  retryBtn: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 16, paddingHorizontal: 24, height: 40,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  retryBtnTxt: { color: COLORS.teal, fontSize: 13, fontWeight: '700' },
});
