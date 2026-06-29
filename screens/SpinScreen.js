import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
  Linking, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { getDemoSpinResult } from '../services/demoData';
import { isAtSpinLimit, incrementSpinCount, getRemainingSpins, LIMITS } from '../services/subscriptionService';
import { COLORS, FONTS, RADII } from '../constants/theme';
import ScreenBackground from '../components/brand/ScreenBackground';
import Card from '../components/brand/Card';
import CTAButton from '../components/brand/CTAButton';
import { searchNearbyPlaces } from '../services/placesService';

const PRICE_ENUM_TO_NUM = {
  PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

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

async function fetchNearbyPlaces(lat, lng, types) {
  const data = await searchNearbyPlaces(
    {
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 20000 } },
      maxResultCount: 20,
      includedTypes: types,
    },
    'places.id,places.displayName,places.formattedAddress,places.rating,places.editorialSummary,places.location,places.priceLevel',
  );
  return (data.places ?? []).map((p) => ({
    name:        p.displayName?.text ?? '',
    place_id:    p.id ?? '',
    address:     p.formattedAddress ?? '',
    rating:      p.rating ?? 0,
    summary:     p.editorialSummary?.text ?? null,
    lat:         p.location?.latitude ?? lat,
    lng:         p.location?.longitude ?? lng,
    price_level: PRICE_ENUM_TO_NUM[p.priceLevel] ?? null,
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
    <ScreenBackground variant="paper">
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
              <ActivityIndicator color={COLORS.primary} size="large" />
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
            <Animated.View style={{ transform: [{ scale: cardScale }], width: '100%' }}>
              <Card style={{ borderLeftWidth: 3, borderLeftColor: result.categoryColor, gap: 8, overflow: 'hidden', borderWidth: 0.5, borderColor: COLORS.border }}>
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
                {result.price_level ? (
                  <Text style={styles.resultPrice}>{['', '$', '$$', '$$$', '$$$$'][result.price_level] ?? ''}</Text>
                ) : null}

                <View style={styles.resultActions}>
                  <CTAButton variant="cobalt" title="LET'S GO →" onPress={handleGo} style={{ flex: 1 }} />
                  <TouchableOpacity style={styles.againBtn} onPress={spin} activeOpacity={0.7}>
                    <Text style={styles.againBtnTxt}>🎲 Spin Again</Text>
                  </TouchableOpacity>
                </View>
              </Card>
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
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40,
    alignItems: 'center',
  },

  title: {
    fontFamily: FONTS.displayHeavy,
    fontSize: 28, color: COLORS.textPrimary,
    letterSpacing: 5, textAlign: 'center',
  },
  sub:           { fontFamily: FONTS.body, fontSize: 13, color: COLORS.goldText, marginTop: 6, marginBottom: 8 },
  remainingText: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textMuted, marginBottom: 16 },

  // Category pills
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 32 },
  catPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADII.lg,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  catPillTxt:       { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.textSecondary },
  catPillTxtActive: { color: COLORS.surface },

  // Spin button
  spinWrap: { marginBottom: 32, alignItems: 'center' },
  spinBtn: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: COLORS.surface, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  spinEmoji:       { fontSize: 52 },
  spinLabel:       { fontFamily: FONTS.bodyBold, fontSize: 12, color: COLORS.primary, letterSpacing: 3 },
  spinLabelActive: { color: COLORS.accent },

  // Result card styles (Card primitive handles bg/radius/shadow/padding)
  resultHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultEmoji:   { fontSize: 24 },
  resultName:    { fontFamily: FONTS.displayHeavy, flex: 1, fontSize: 15, color: COLORS.textPrimary },
  resultReason:  { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, fontStyle: 'italic' },
  resultAddress: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary },
  resultRating:  { fontFamily: FONTS.body, fontSize: 13, color: COLORS.goldText },
  resultPrice:   { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.primary },

  resultActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  againBtn: {
    paddingHorizontal: 16, borderRadius: RADII.lg,
    height: 56, justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center',
  },
  againBtnTxt: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.textSecondary },

  // Error
  errorBox: {
    marginTop: 16, backgroundColor: COLORS.surfaceAlt, borderRadius: RADII.md,
    borderWidth: 1, borderColor: COLORS.error + '44', padding: 14,
  },
  errorTxt: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.error, textAlign: 'center', marginBottom: 8 },
  retryBtn: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADII.lg, paddingHorizontal: 24, height: 40,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  retryBtnTxt: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.primary },
});
