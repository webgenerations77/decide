import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
  Linking, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDemoSpinResult } from '../services/demoData';
import { isAtSpinLimit, incrementSpinCount, getRemainingSpins, LIMITS } from '../services/subscriptionService';
import { COLORS, FONTS, RADII } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import ScreenBackground from '../components/brand/ScreenBackground';
import Card from '../components/brand/Card';
import CTAButton from '../components/brand/CTAButton';
import SectionLabel from '../components/brand/SectionLabel';
import { searchNearbyPlaces, placeDetails, placePhotoUrl } from '../services/placesService';

const SURPRISE_SEEN_KEY = '@decide/spin_surprise_seen';

// Cheddar-voiced "why this pick" built from real signals — no AI call, so it
// never invents preferences we don't have. Demo picks keep their own reason.
function buildSpinReason(pick, catNoun, openNow) {
  if (pick.reason) return pick.reason;
  const noun = catNoun || 'spot';
  let lead;
  if (pick.rating >= 4.6)      lead = `a highly-rated ${noun} just minutes from you`;
  else if (pick.rating >= 4.2) lead = `a well-reviewed ${noun} close by`;
  else if (pick.rating > 0)    lead = `a solid ${noun} nearby`;
  else                         lead = `a ${noun} near you worth a look`;

  let tail = '';
  if (openNow === true)       tail = " — and it's open right now";
  else if (openNow === false) tail = " — though it looks closed now, so call ahead";

  return `Picked this because it's ${lead}${tail}.`;
}

const PRICE_ENUM_TO_NUM = {
  PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const CATEGORIES = [
  { id: 'surprise',  label: 'Surprise Me', emoji: '🎲', color: COLORS.primary, noun: 'spot',
    types: ['restaurant','cafe','art_gallery','park','museum','movie_theater','bowling_alley'] },
  { id: 'food',      label: 'Food',        emoji: '🍽️', color: COLORS.food, noun: 'place to eat',
    types: ['restaurant','cafe','bar','bakery','coffee_shop'] },
  { id: 'activity',  label: 'Activity',    emoji: '🎭', color: COLORS.activity, noun: 'thing to do',
    types: ['museum','art_gallery','bowling_alley','movie_theater','karaoke','comedy_club'] },
  { id: 'outdoor',   label: 'Outdoor',     emoji: '🌿', color: COLORS.outdoor, noun: 'outdoor spot',
    types: ['park','hiking_area','botanical_garden','zoo'] },
  { id: 'shopping',  label: 'Shopping',    emoji: '🛍️', color: COLORS.shopping, noun: 'place to shop',
    types: ['shopping_mall','market','book_store','gift_shop'] },
];

async function fetchNearbyPlaces(lat, lng, types) {
  const data = await searchNearbyPlaces(
    {
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 20000 } },
      maxResultCount: 20,
      includedTypes: types,
    },
    'places.id,places.displayName,places.formattedAddress,places.rating,places.editorialSummary,places.location,places.priceLevel,places.photos,places.primaryTypeDisplayName',
  );
  return (data.places ?? []).map((p) => ({
    name:          p.displayName?.text ?? '',
    place_id:      p.id ?? '',
    address:       p.formattedAddress ?? '',
    rating:        p.rating ?? 0,
    summary:       p.editorialSummary?.text ?? null,
    lat:           p.location?.latitude ?? lat,
    lng:           p.location?.longitude ?? lng,
    price_level:   PRICE_ENUM_TO_NUM[p.priceLevel] ?? null,
    photo:         p.photos?.[0]?.name ?? null,
    categoryLabel: p.primaryTypeDisplayName?.text ?? null,
  }));
}

export default function SpinScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [category,    setCategory]    = useState('food');
  const [spinning,    setSpinning]    = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState(null);
  const [coords,      setCoords]      = useState(null);
  const [locLoading,  setLocLoading]  = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [remainingSpins, setRemainingSpins] = useState(null);
  const [surpriseSeen, setSurpriseSeen] = useState(true); // assume seen until storage says otherwise

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
    AsyncStorage.getItem(SURPRISE_SEEN_KEY)
      .then((v) => setSurpriseSeen(v === 'true'))
      .catch(() => {});
  }, []);

  const dismissSurpriseExplainer = () => {
    setSurpriseSeen(true);
    AsyncStorage.setItem(SURPRISE_SEEN_KEY, 'true').catch(() => {});
  };

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
        setResult({
          ...pick,
          reason: buildSpinReason(pick, cat.noun, null),
          categoryId: cat.id, categoryEmoji: cat.emoji, categoryColor: cat.color,
        });
        setSpinning(false);
        bounceAnim.setValue(0);
        Animated.spring(bounceAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
        await incrementSpinCount().catch(() => {});
        getRemainingSpins().then(setRemainingSpins).catch(() => {});

        // Enrich with website / phone / open-now so the result has real next steps
        const pid = pick.place_id ?? '';
        if (pid && !pid.startsWith('demo_') && !pid.startsWith('nps_') && !pid.startsWith('ridb_')) {
          setDetailLoading(true);
          try {
            const data = await placeDetails(pid, 'name,formatted_phone_number,website,opening_hours');
            const d = data?.result ?? null;
            const openNow = d?.opening_hours?.open_now;
            setResult((prev) => (prev && prev.place_id === pid ? {
              ...prev,
              website: d?.website ?? null,
              phone:   d?.formatted_phone_number ?? null,
              openNow: openNow ?? null,
              reason:  buildSpinReason(pick, cat.noun, openNow ?? null),
            } : prev));
          } catch { /* keep base reason; website/call simply won't show */ }
          setDetailLoading(false);
        }
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

  const handleWebsite = () => { if (result?.website) Linking.openURL(result.website); };
  const handleCall    = () => { if (result?.phone) Linking.openURL(`tel:${result.phone}`); };

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

          {/* One-time Surprise Me explainer */}
          {category === 'surprise' && !surpriseSeen && !result && (
            <View style={styles.explainerCard}>
              <Text style={styles.explainerEmoji}>🎲</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.explainerTitle}>How Surprise Me works</Text>
                <Text style={styles.explainerBody}>
                  One random spot near you — a single suggestion, not a full day plan. Don't love it? Just spin again.
                </Text>
                <TouchableOpacity onPress={dismissSurpriseExplainer} activeOpacity={0.7} style={styles.explainerDismiss}>
                  <Text style={styles.explainerDismissTxt}>Got it</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Spin button */}
          <View style={styles.spinWrap}>
            {locLoading ? (
              <ActivityIndicator color={colors.primary} size="large" />
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

          {/* Result card — one single suggested stop (not an itinerary) */}
          {result && !spinning && (
            <Animated.View style={{ transform: [{ scale: cardScale }], width: '100%' }}>
              <Card style={{ borderLeftWidth: 3, borderLeftColor: result.categoryColor, gap: 8, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.border }}>
                {result.photo ? (
                  <View style={styles.photoHeader}>
                    <Image source={{ uri: placePhotoUrl(result.photo, 1000) }} style={styles.photoImg} resizeMode="cover" />
                    <LinearGradient colors={['transparent', colors.surface]} style={styles.photoGradient} pointerEvents="none" />
                  </View>
                ) : null}

                <SectionLabel tone="cobalt">🎲 Your one pick</SectionLabel>

                {result.categoryLabel ? (
                  <View style={[styles.catBadge, { backgroundColor: result.categoryColor + '22', borderColor: result.categoryColor + '55' }]}>
                    <Text style={[styles.catBadgeTxt, { color: result.categoryColor }]}>{result.categoryLabel}</Text>
                  </View>
                ) : null}

                <View style={styles.resultHeader}>
                  <Text style={styles.resultEmoji}>{result.categoryEmoji}</Text>
                  <Text style={styles.resultName} numberOfLines={2}>{result.name}</Text>
                </View>

                {result.address ? (
                  <Text style={styles.resultAddress} numberOfLines={1}>📍 {result.address}</Text>
                ) : null}

                {/* Meta row: rating · price · open status */}
                {(result.rating > 0 || result.price_level || result.openNow != null) && (
                  <View style={styles.metaRow}>
                    {result.rating > 0 && (
                      <Text style={styles.metaTxt}>⭐ {typeof result.rating === 'number' ? result.rating.toFixed(1) : result.rating}</Text>
                    )}
                    {result.price_level ? (
                      <Text style={styles.metaTxt}>{['', '$', '$$', '$$$', '$$$$'][result.price_level] ?? ''}</Text>
                    ) : null}
                    {result.openNow != null && (
                      <Text style={[styles.metaTxt, { color: result.openNow ? colors.success : colors.error }]}>
                        {result.openNow ? '● Open now' : '● Closed now'}
                      </Text>
                    )}
                  </View>
                )}

                {/* Why this pick */}
                {result.reason ? (
                  <View style={styles.whyBox}>
                    <SectionLabel tone="cobalt" style={{ marginBottom: 6 }}>Why this pick</SectionLabel>
                    <Text style={styles.whyTxt}>{result.reason}</Text>
                  </View>
                ) : null}

                {/* Primary next step */}
                <CTAButton variant="cobalt" title="Get Directions" leftIcon={<Ionicons name="navigate" size={18} color={colors.white} />} onPress={handleGo} style={{ marginTop: 2 }} />

                {/* Website / Call */}
                {(result.website || result.phone) && (
                  <View style={styles.secRow}>
                    {result.website ? (
                      <TouchableOpacity style={styles.secBtn} onPress={handleWebsite} activeOpacity={0.7}>
                        <Ionicons name="globe-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.secBtnTxt}>Website</Text>
                      </TouchableOpacity>
                    ) : null}
                    {result.phone ? (
                      <TouchableOpacity style={styles.secBtn} onPress={handleCall} activeOpacity={0.7}>
                        <Ionicons name="call-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.secBtnTxt}>Call</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}

                {detailLoading && <ActivityIndicator color={colors.primary} size="small" style={{ marginTop: 2 }} />}

                {/* Spin again */}
                <TouchableOpacity style={styles.againBtn} onPress={spin} activeOpacity={0.7}>
                  <Text style={styles.againBtnTxt}>🎲 Spin Again</Text>
                </TouchableOpacity>
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

const makeStyles = (c) => StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40,
    alignItems: 'center',
  },

  title: {
    fontFamily: FONTS.displayHeavy,
    fontSize: 28, color: c.textPrimary,
    letterSpacing: 5, textAlign: 'center',
  },
  sub:           { fontFamily: FONTS.body, fontSize: 13, color: c.goldText, marginTop: 6, marginBottom: 8 },
  remainingText: { fontFamily: FONTS.mono, fontSize: 11, color: c.textMuted, marginBottom: 16 },

  // Category pills
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 32 },
  catPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADII.lg,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  catPillTxt:       { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: c.textSecondary },
  catPillTxtActive: { color: c.surface },

  // Spin button
  spinWrap: { marginBottom: 32, alignItems: 'center' },
  spinBtn: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: c.surface, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  spinEmoji:       { fontSize: 52 },
  spinLabel:       { fontFamily: FONTS.bodyBold, fontSize: 12, color: c.primary, letterSpacing: 3 },
  spinLabelActive: { color: c.accent },

  // One-time Surprise Me explainer
  explainerCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: c.sky100, borderRadius: RADII.md,
    borderWidth: 1, borderColor: c.borderLight,
    padding: 14, marginBottom: 24, width: '100%',
  },
  explainerEmoji: { fontSize: 22, marginTop: 1 },
  explainerTitle: { fontFamily: FONTS.bodyBold, fontSize: 14, color: c.textPrimary, marginBottom: 4 },
  explainerBody:  { fontFamily: FONTS.body, fontSize: 13, color: c.textSecondary, lineHeight: 19 },
  explainerDismiss: { alignSelf: 'flex-start', marginTop: 10 },
  explainerDismissTxt: { fontFamily: FONTS.bodyBold, fontSize: 13, color: c.primary },

  // Result card styles (Card primitive handles bg/radius/shadow/padding)
  // Full-bleed place photo header (negate the Card's 16px padding)
  photoHeader:   { marginHorizontal: -16, marginTop: -16, marginBottom: 2, height: 150, backgroundColor: c.surfaceAlt },
  photoImg:      { width: '100%', height: '100%' },
  photoGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56 },
  // Real place category eyebrow (e.g. "Brewery") — the key Surprise Me signal
  catBadge:      { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  catBadgeTxt:   { fontFamily: FONTS.bodySemiBold, fontSize: 11, letterSpacing: 0.3 },

  resultHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultEmoji:   { fontSize: 24 },
  resultName:    { fontFamily: FONTS.displayHeavy, flex: 1, fontSize: 16, color: c.textPrimary },
  resultAddress: { fontFamily: FONTS.body, fontSize: 13, color: c.textSecondary },

  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  metaTxt: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: c.goldText },

  whyBox: {
    backgroundColor: c.surfaceAlt, borderRadius: RADII.md,
    padding: 12, marginTop: 4,
    borderLeftWidth: 3, borderLeftColor: c.primary,
  },
  whyTxt: { fontFamily: FONTS.body, fontSize: 14, color: c.textPrimary, lineHeight: 20 },

  secRow: { flexDirection: 'row', gap: 10 },
  secBtn: {
    flex: 1, height: 48, borderRadius: RADII.lg, flexDirection: 'row',
    backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  secBtnTxt: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: c.primary },

  againBtn: {
    paddingHorizontal: 16, borderRadius: RADII.lg,
    height: 52, justifyContent: 'center',
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    alignItems: 'center', marginTop: 2,
  },
  againBtnTxt: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: c.textSecondary },

  // Error
  errorBox: {
    marginTop: 16, backgroundColor: c.surfaceAlt, borderRadius: RADII.md,
    borderWidth: 1, borderColor: c.error + '44', padding: 14,
  },
  errorTxt: { fontFamily: FONTS.body, fontSize: 13, color: c.error, textAlign: 'center', marginBottom: 8 },
  retryBtn: {
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    borderRadius: RADII.lg, paddingHorizontal: 24, height: 40,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  retryBtnTxt: { fontFamily: FONTS.bodyBold, fontSize: 13, color: c.primary },
});
