import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/theme';

function deriveProsAndCons(rating, userRatingsTotal, isOpenNow) {
  const pros = [];
  const cons = [];
  const r       = parseFloat(rating)        || 0;
  const reviews = parseInt(userRatingsTotal, 10) || 0;

  if (r >= 4.5)                           pros.push('Exceptional rating');
  else if (r >= 4.0)                      pros.push('Highly rated');
  else if (r > 0 && r < 3.5)              cons.push('Mixed reviews');

  if (reviews > 500)                      pros.push('Very popular');
  else if (reviews > 100)                 pros.push('Well established');
  else if (reviews > 0 && reviews < 20)   cons.push('Few reviews');

  if (isOpenNow)                          pros.push('Open right now');
  else                                    cons.push('Check hours');

  return { pros: pros.slice(0, 3), cons: cons.slice(0, 2) };
}

function PlaceCard({ place, rank }) {
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
            colors={[COLORS.primary, COLORS.primaryDark]}
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Top Picks</Text>
          <View style={styles.timeframeBadge}>
            <Text style={styles.timeframeText}>{timeframeLabel}</Text>
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
          <TouchableOpacity
            style={styles.differentBtn}
            activeOpacity={0.7}
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
          >
            <Text style={styles.differentBtnText}>🎲  Find something different</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 4,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow:    { color: COLORS.amber, fontSize: 20, lineHeight: 22 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title:        { fontSize: 28, color: COLORS.textPrimary, fontFamily: 'PlayfairDisplay_800ExtraBold' },
  timeframeBadge: {
    marginTop: 4, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 12, backgroundColor: COLORS.amberFaint, borderWidth: 1, borderColor: COLORS.amber + '44',
  },
  timeframeText: { color: COLORS.amber, fontSize: 11, fontWeight: '600' },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Place card
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    marginHorizontal: 0,
    overflow: 'hidden',
  },
  cardLeft: {
    width: 40,
    alignItems: 'center',
    paddingTop: 18,
    backgroundColor: COLORS.surface,
  },
  rankCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.amber, alignItems: 'center', justifyContent: 'center',
  },
  rankText: { color: COLORS.bg, fontSize: 12, fontWeight: '800' },

  cardBody:     { flex: 1, padding: 14, gap: 6 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingRight: 40 },
  cardEmoji:    { fontSize: 18 },
  cardName:     { flex: 1, fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 28 },

  exciteBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: COLORS.amber + '22', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: COLORS.amber + '44',
  },
  exciteText: { color: COLORS.amber, fontSize: 10, fontWeight: '700' },

  vicinity: { fontSize: 14, color: COLORS.textMuted, lineHeight: 19, fontStyle: 'italic' },

  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText:   { fontSize: 13, color: COLORS.textMuted },
  metaDot:    { fontSize: 13, color: COLORS.border },
  openText:   { fontSize: 13, color: COLORS.success, fontWeight: '600' },
  closedText: { fontSize: 13, color: COLORS.textMuted },

  prosConsBlock: { gap: 3 },
  proLine: { fontSize: 13, color: COLORS.success, letterSpacing: 0.2 },
  conLine: { fontSize: 13, color: COLORS.warning, letterSpacing: 0.2 },

  goBtn: {
    marginTop: 4, borderRadius: 16, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38, shadowRadius: 12, elevation: 8,
  },
  goBtnText: { color: COLORS.primaryText, fontSize: 15, fontWeight: '700' },

  // Empty state
  emptyState:    { paddingTop: 80, alignItems: 'center', gap: 12 },
  emptyEmoji:    { fontSize: 48 },
  emptyTitle:    { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  emptySubtitle: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  // "Find something different" button
  differentBtn: {
    marginTop: 6,
    borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  differentBtnText: { color: COLORS.amber, fontSize: 15, fontWeight: '700' },
});
