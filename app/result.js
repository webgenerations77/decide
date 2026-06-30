import { useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { FONTS, RADII, SHADOWS } from '../constants/theme';
import ScreenBackground from '../components/brand/ScreenBackground';
import SectionLabel from '../components/brand/SectionLabel';
import CTAButton from '../components/brand/CTAButton';

function deriveProsAndCons(rating, userRatingsTotal, isOpenNow) {
  const pros = [];
  const cons = [];
  const r       = parseFloat(rating)        || 0;
  const reviews = parseInt(userRatingsTotal, 10) || 0;

  if (r >= 4.5)                           pros.push('Exceptional rating');
  else if (r >= 4.0)                      pros.push('Highly rated');
  else if (r > 0 && r < 3.5)             cons.push('Mixed reviews');

  if (reviews > 500)                      pros.push('Very popular');
  else if (reviews > 100)                 pros.push('Well established');
  else if (reviews > 0 && reviews < 20)  cons.push('Few reviews');

  if (isOpenNow)                          pros.push('Open right now');
  else                                    cons.push('Check hours');

  return { pros: pros.slice(0, 3), cons: cons.slice(0, 2) };
}

function PlaceCard({ place, rank }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { pros, cons } = deriveProsAndCons(place.rating, place.userRatingsTotal, place.isOpenNow);
  const enterAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(24)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(enterAnim, { toValue: 1, duration: 380, delay: (rank - 1) * 90, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 360, delay: (rank - 1) * 90, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePressIn  = () => Animated.spring(pressScale, { toValue: 0.98, useNativeDriver: true, damping: 22 }).start();
  const handlePressOut = () => Animated.spring(pressScale, { toValue: 1,    useNativeDriver: true, damping: 16 }).start();

  const handleGo = async () => {
    const url = `https://www.google.com/maps/search/?api=1`
      + `&query=${encodeURIComponent(place.name)}`
      + (place.placeId ? `&query_place_id=${place.placeId}` : '');

    try {
      const raw      = await AsyncStorage.getItem('@decide/decisions');
      const existing = raw ? JSON.parse(raw) : [];
      const entry    = {
        id:             `decision_${Date.now()}`,
        placeId:        place.placeId        ?? '',
        name:           place.name           ?? '',
        category:       place.category       ?? 'activity',
        emoji:          place.emoji          ?? '⚡',
        reason:         place.reason         ?? '',
        address:        place.vicinity       ?? place.address ?? '',
        rating:         place.rating         ?? 0,
        distance:       place.distance       ?? '',
        excitementScore: place.excitementScore ?? 0,
        timestamp:      Date.now(),
        feedback:       null,
        feedbackReason: null,
      };
      await AsyncStorage.setItem(
        '@decide/decisions',
        JSON.stringify([entry, ...existing.slice(0, 99)])
      );
    } catch (e) {
      console.warn('[history] save decision error', e);
    }

    Linking.openURL(url);
  };

  return (
    <Animated.View style={[styles.card, { opacity: enterAnim, transform: [{ translateY: slideAnim }, { scale: pressScale }] }]}>
      <View style={styles.cardLeft}>
        <View style={styles.rankCircle}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardEmoji}>{place.emoji}</Text>
          <Text style={styles.cardName} numberOfLines={2}>{place.name}</Text>
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
            {pros.map((p, i) => (
              <Text key={`p${i}`} style={styles.proLine}>✓  {p}</Text>
            ))}
            {cons.map((c, i) => (
              <Text key={`c${i}`} style={styles.conLine}>⚠  {c}</Text>
            ))}
          </View>
        )}

        <TouchableOpacity onPress={handleGo} onPressIn={handlePressIn} onPressOut={handlePressOut} activeOpacity={0.88}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.goBtn}
          >
            <Text style={styles.goBtnText}>Let's go →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {place.excitementScore != null && (
        <View style={styles.exciteBadge}>
          <Text style={styles.exciteText}>⚡{place.excitementScore}</Text>
        </View>
      )}
    </Animated.View>
  );
}

export default function ResultScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const router = useRouter();
  const params = useLocalSearchParams();

  let places = [];
  if (params.topPlaces) {
    try { places = JSON.parse(params.topPlaces); } catch {}
  }

  const timeframe = params.timeframe ?? 'today';
  const hasResults = places.length > 0;
  const timeframeLabel = timeframe === 'today' ? "Today's Picks" : "This Week";

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenBackground variant="paper">
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Top Picks</Text>
            <View style={styles.timeframeBadge}>
              <SectionLabel tone="cobalt" style={styles.timeframeText}>{timeframeLabel}</SectionLabel>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {hasResults ? (
            places.map((place, i) => (
              <PlaceCard key={i} place={place} rank={i + 1} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>Nothing found nearby</Text>
              <Text style={styles.emptySubtitle}>
                Try a different category or check your connection
              </Text>
            </View>
          )}

          {hasResults && (
            <CTAButton
              title="🎲  Find something different"
              variant="secondary"
              style={styles.differentBtn}
              onPress={() =>
                router.push({
                  pathname: '/fallback',
                  params: {
                    knownNames: JSON.stringify(places.map((p) => p.name)),
                    lat:        params.lat      ?? '',
                    lng:        params.lng      ?? '',
                    category:   params.category ?? 'anything',
                    timeframe,
                  },
                })
              }
            />
          )}
        </ScrollView>
      </ScreenBackground>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 4,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow:    { color: c.primary, fontSize: 20, lineHeight: 22 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title:        { fontSize: 28, color: c.textPrimary, fontFamily: FONTS.displayHeavy },
  timeframeBadge: {
    marginTop: 4, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 12, backgroundColor: c.gold + '22', borderWidth: 1, borderColor: c.amber + '44',
  },
  timeframeText: { color: c.primary },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Place card — Animated.View requires direct style; uses SHADOWS.card for brand shadow
  card: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: 20,
    marginBottom: 14,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  cardLeft: {
    width: 40,
    alignItems: 'center',
    paddingTop: 18,
    backgroundColor: c.surface,
  },
  rankCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: c.amber, alignItems: 'center', justifyContent: 'center',
  },
  rankText: { color: c.bg, fontSize: 12, fontFamily: FONTS.displayHeavy },

  cardBody:     { flex: 1, padding: 14, gap: 6 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingRight: 40 },
  cardEmoji:    { fontSize: 18 },
  cardName:     { flex: 1, fontSize: 24, fontFamily: FONTS.display, color: c.textPrimary, lineHeight: 28 },

  exciteBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: c.amber + '22', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: c.amber + '44',
  },
  exciteText: { color: c.goldText, fontSize: 10, fontFamily: FONTS.bodyBold },

  vicinity:   { fontSize: 14, color: c.textMuted, lineHeight: 19, fontStyle: 'italic', fontFamily: FONTS.body },

  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText:   { fontSize: 13, color: c.textMuted, fontFamily: FONTS.body },
  metaDot:    { fontSize: 13, color: c.border, fontFamily: FONTS.body },
  openText:   { fontSize: 13, color: c.success, fontFamily: FONTS.bodySemiBold },
  closedText: { fontSize: 13, color: c.textMuted, fontFamily: FONTS.body },

  prosConsBlock: { gap: 3 },
  proLine: { fontSize: 13, color: c.success, letterSpacing: 0.2, fontFamily: FONTS.body },
  conLine: { fontSize: 13, color: c.warning, letterSpacing: 0.2, fontFamily: FONTS.body },

  goBtn: {
    marginTop: 4, borderRadius: 16, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: c.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38, shadowRadius: 12, elevation: 8,
  },
  goBtnText: { color: c.primaryText, fontSize: 15, fontFamily: FONTS.bodyBold },

  // Empty state
  emptyState:    { paddingTop: 80, alignItems: 'center', gap: 12 },
  emptyEmoji:    { fontSize: 48 },
  emptyTitle:    { fontSize: 20, fontFamily: FONTS.display, color: c.textPrimary },
  emptySubtitle: { fontSize: 15, color: c.textMuted, textAlign: 'center', lineHeight: 20, fontFamily: FONTS.body },

  // "Find something different" button
  differentBtn: { marginTop: 6 },
});
