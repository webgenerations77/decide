import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { DEMO_HISTORY } from '../../services/demoData';
import { loadHistory, syncHistory, updateFeedback } from '../../services/historyService';
import WeatherArt from '../../components/itinerary/WeatherArt';
import DecisionCard from '../../components/history/DecisionCard';
import { FONTS } from '../../constants/theme';
import { categoryVisual } from '../../constants/categoryVisuals';
import useViewportOverlay, { WEB_OVERLAY_FIX } from '../../hooks/useViewportOverlay';
import { useTheme } from '../../context/ThemeContext';
import ScreenBackground from '../../components/brand/ScreenBackground';
import Card from '../../components/brand/Card';
import CTAButton from '../../components/brand/CTAButton';
import BrandLogo from '../../components/brand/BrandLogo';
import VersionTag from '../../components/brand/VersionTag';

// ─── Constants ────────────────────────────────────────────────────────────────
const FEEDBACK_REASONS = ['Closed', 'Too crowded', 'Not my style', 'Too far', 'Too expensive', 'Other'];

// ─── FeedbackModal ────────────────────────────────────────────────────────────
function FeedbackModal({ visible, itemName, onClose, onSelect }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const overlayRef = useViewportOverlay(visible);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View ref={overlayRef} style={styles.fbOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
          <View style={styles.fbCard}>
            <Text style={styles.fbTitle}>WHAT WAS THE ISSUE?</Text>
            <Text style={styles.fbPlace} numberOfLines={1}>{itemName}</Text>
            {FEEDBACK_REASONS.map((reason, i) => (
              <TouchableOpacity
                key={reason}
                style={[styles.fbOption, i === FEEDBACK_REASONS.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => onSelect(reason)}
                activeOpacity={0.7}
              >
                <Text style={styles.fbOptionTxt}>{reason}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.fbCancel} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.fbCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
      </View>
    </Modal>
  );
}

// ─── ItineraryEntry ───────────────────────────────────────────────────────────
function ItineraryEntry({ item, onFeedbackUp, onFeedbackDown, onOpen }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const prefs   = item.meta?.preferences ?? {};
  const pills   = [prefs.pace, prefs.budget, prefs.group_type].filter(Boolean);
  const dayLine = `${item.meta?.day_of_week ?? ''}, ${item.meta?.date ?? ''}`.trim().replace(/^,\s*/, '');
  const weatherLine = item.weather
    ? `${item.weather.emoji ?? ''} ${item.weather.temp_f}°F`
    : '';
  const stopCount = item.stops?.length ?? 0;
  const tappable = Array.isArray(item.itinerary) && item.itinerary.length > 0;

  return (
    <Card style={styles.itinCard}>
      <WeatherArt weather={item.weather} aspectRatio={32 / 9} style={styles.cardBanner} />
      <View style={styles.itinCardContent}>
        <TouchableOpacity
          activeOpacity={tappable ? 0.7 : 1}
          onPress={tappable ? onOpen : undefined}
          disabled={!tappable}
        >
          <View style={styles.itinHeader}>
            <Text style={styles.itinDate}>{dayLine}</Text>
            {item.meta?.city ? <Text style={styles.itinCity}>📍 {item.meta.city}</Text> : null}
          </View>

          <View style={styles.itinMetaRow}>
            {pills.map((p) => (
              <View key={p} style={styles.prefPill}>
                <Text style={styles.prefPillTxt}>{p}</Text>
              </View>
            ))}
          </View>

          <View style={styles.itinStatsRow}>
            <Text style={styles.itinStats}>{stopCount} stop{stopCount !== 1 ? 's' : ''}</Text>
            {weatherLine ? <Text style={styles.itinStats}>{weatherLine}</Text> : null}
            {item.meta?.time_window ? (
              <Text style={styles.itinStats}>🕐 {item.meta.time_window}</Text>
            ) : null}
          </View>

          {tappable && (
            <Text style={styles.tapDetailHint}>View full itinerary →</Text>
          )}

          {item.stops?.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
            >
              {item.stops.map((stop, i) => {
                const c = categoryVisual(stop.category).color;
                return (
                  <View key={i} style={[styles.stopChip, { borderColor: c + '55' }]}>
                    <Text style={styles.stopChipTxt} numberOfLines={1}>{stop.name}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </TouchableOpacity>

        {item.feedback === 'down' && item.feedbackReason ? (
          <View style={[styles.feedbackTag, { marginTop: 6 }]}>
            <Text style={styles.feedbackTagTxt}>❌ {item.feedbackReason}</Text>
          </View>
        ) : null}

        <View style={[styles.thumbsRow, { borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 10, marginTop: 8 }]}>
          <TouchableOpacity
            style={[styles.thumbBtn, item.feedback === 'up' && styles.thumbBtnUp]}
            onPress={onFeedbackUp}
            activeOpacity={0.7}
          >
            <Text style={styles.thumbTxt}>👍</Text>
          </TouchableOpacity>
          <View style={styles.thumbDivider} />
          <TouchableOpacity
            style={[styles.thumbBtn, item.feedback === 'down' && styles.thumbBtnDown]}
            onPress={onFeedbackDown}
            activeOpacity={0.7}
          >
            <Text style={styles.thumbTxt}>👎</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

// ─── Demo normalisers ─────────────────────────────────────────────────────────
function normalizeDemoDecision(dec) {
  return { ...dec, excitementScore: dec.excitement_score };
}

function normalizeDemoItinerary(itin) {
  return {
    id: itin.id,
    feedback: itin.feedback,
    feedbackReason: itin.feedbackReason ?? null,
    meta: {
      day_of_week: itin.displayDate,
      date: '',
      city: itin.location,
      preferences: { pace: itin.preferences.pace, budget: itin.preferences.budget, group_type: itin.preferences.group },
      time_window: itin.timeWindow,
    },
    weather: { emoji: itin.weather.icon, temp_f: itin.weather.temp.replace('°F', '') },
    stops: itin.stops.map((name) => ({ name, category: null })),
  };
}

// ─── HistoryScreen ────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [activeFilter,    setActiveFilter]    = useState('itineraries');
  const [decisions,       setDecisions]       = useState([]);
  const [itineraries,     setItineraries]     = useState([]);
  const [feedbackModal,   setFeedbackModal]   = useState(false);
  const [pendingItem,     setPendingItem]     = useState(null);
  const [pendingType,     setPendingType]     = useState(null);
  const [isDemo,          setIsDemo]          = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const demoRaw = await AsyncStorage.getItem('@decide/demo_mode');
        if (demoRaw === 'true') {
          setIsDemo(true);
          setDecisions(DEMO_HISTORY.decisions.map(normalizeDemoDecision));
          setItineraries(DEMO_HISTORY.itineraries.map(normalizeDemoItinerary));
          return;
        }
        setIsDemo(false);
        const cached = await loadHistory();
        setDecisions(cached.decisions);
        setItineraries(cached.itineraries);
        // background reconcile with the cloud; refresh UI when it returns
        syncHistory().then((merged) => {
          setDecisions(merged.decisions);
          setItineraries(merged.itineraries);
        }).catch(() => {});
      } catch {
        setDecisions([]);
        setItineraries([]);
      }
    })();
  }, []));

  const applyFeedback = async (type, reason = null) => {
    if (!pendingItem) return;

    if (pendingType === 'decision') {
      const updated = decisions.map((d) =>
        d.id === pendingItem.id ? { ...d, feedback: type, feedbackReason: reason } : d
      );
      setDecisions(updated);
    } else {
      const updated = itineraries.map((it) =>
        it.id === pendingItem.id ? { ...it, feedback: type, feedbackReason: reason } : it
      );
      setItineraries(updated);
    }
    if (!isDemo) { updateFeedback(pendingType === 'decision' ? 'decisions' : 'itineraries', pendingItem.id, type, reason); }

    setPendingItem(null);
    setPendingType(null);
    setFeedbackModal(false);
  };

  const handleThumbsUp = async (item, type) => {
    const nextFeedback = item.feedback === 'up' ? null : 'up';

    if (type === 'decision') {
      const updated = decisions.map((d) =>
        d.id === item.id ? { ...d, feedback: nextFeedback, feedbackReason: null } : d
      );
      setDecisions(updated);
      if (!isDemo) { updateFeedback('decisions', item.id, nextFeedback, null); }
    } else {
      const updated = itineraries.map((it) =>
        it.id === item.id ? { ...it, feedback: nextFeedback, feedbackReason: null } : it
      );
      setItineraries(updated);
      if (!isDemo) { updateFeedback('itineraries', item.id, nextFeedback, null); }
    }
  };

  const handleThumbsDown = (item, type) => {
    setPendingItem(item);
    setPendingType(type);
    setFeedbackModal(true);
  };

  const thumbsDownCount = decisions.filter((d) => d.feedback === 'down').length
    + itineraries.filter((it) => it.feedback === 'down').length;
  const showLearningBanner = thumbsDownCount >= 5;

  const isEmptyDecisions   = activeFilter === 'decisions'   && decisions.length === 0;
  const isEmptyItineraries = activeFilter === 'itineraries' && itineraries.length === 0;
  const isEmpty = isEmptyDecisions || isEmptyItineraries;

  const countLabel = activeFilter === 'decisions'
    ? `${decisions.length} decision${decisions.length !== 1 ? 's' : ''}`
    : `${itineraries.length} itinerar${itineraries.length !== 1 ? 'ies' : 'y'}`;

  return (
    <ScreenBackground variant="paper">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.brandRow}><BrandLogo variant="full" size={30} /></View>
          <Text style={styles.title}>History</Text>

          {/* Filter pills */}
          <View style={styles.filterRow}>
            {['itineraries', 'decisions'].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterPill, activeFilter === f && styles.filterPillActive]}
                onPress={() => setActiveFilter(f)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterPillTxt, activeFilter === f && styles.filterPillTxtActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.countTxt}>{countLabel}</Text>
          </View>

          {/* Learning banner */}
          {showLearningBanner && (
            <View style={styles.learningBanner}>
              <Text style={styles.learningTxt}>⚡ Decide is learning your taste — keep rating to improve suggestions</Text>
            </View>
          )}

          {/* Empty state */}
          {isEmpty ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎯</Text>
              <Text style={styles.emptyTitle}>
                {activeFilter === 'decisions' ? 'No decisions yet' : 'No itineraries yet'}
              </Text>
              <Text style={styles.emptySub}>
                {activeFilter === 'decisions'
                  ? 'Tap DECIDE on the home screen to get started'
                  : 'Generate your first day plan from the DECIDE tab'}
              </Text>
              <CTAButton
                title="Go to DECIDE"
                onPress={() => router.replace('/(tabs)/plan')}
                variant="cobalt"
                style={{ marginTop: 8, alignSelf: 'stretch' }}
              />
            </View>
          ) : null}

          {/* Decisions list */}
          {!isEmpty && activeFilter === 'decisions' && decisions.map((item) => (
            <DecisionCard
              key={item.id}
              item={item}
              onFeedbackUp={() => handleThumbsUp(item, 'decision')}
              onFeedbackDown={() => handleThumbsDown(item, 'decision')}
            />
          ))}

          {/* Itineraries list */}
          {!isEmpty && activeFilter === 'itineraries' && itineraries.map((item) => (
            <ItineraryEntry
              key={item.id}
              item={item}
              onFeedbackUp={() => handleThumbsUp(item, 'itinerary')}
              onFeedbackDown={() => handleThumbsDown(item, 'itinerary')}
              onOpen={() => router.push(`/itinerary/${item.id}`)}
            />
          ))}

          <VersionTag style={{ marginTop: 24 }} />
          <View style={{ height: 40 }} />
        </ScrollView>

        <FeedbackModal
          visible={feedbackModal}
          itemName={pendingItem?.name ?? pendingItem?.meta?.day_of_week ?? ''}
          onClose={() => { setFeedbackModal(false); setPendingItem(null); setPendingType(null); }}
          onSelect={(reason) => applyFeedback('down', reason)}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (c) => StyleSheet.create({
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  brandRow: { alignItems: 'center', marginBottom: 12 },
  title: {
    fontSize: 28, color: c.textPrimary,
    fontFamily: FONTS.displayHeavy,
    textAlign: 'center', marginBottom: 20,
  },

  // Filter pills
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  filterPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  filterPillActive:    { backgroundColor: c.primary, borderColor: c.primary },
  filterPillTxt:       { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: c.textSecondary },
  filterPillTxtActive: { color: c.primaryText },
  countTxt:            { fontSize: 12, color: c.textMuted, marginLeft: 4 },

  // Learning banner
  learningBanner: {
    marginBottom: 16, borderRadius: 12,
    backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  learningTxt: { fontSize: 12, color: c.primary, lineHeight: 17 },

  feedbackTag: {
    alignSelf: 'flex-start', backgroundColor: c.error + '22',
    borderRadius: 8, borderWidth: 1, borderColor: c.error + '44',
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 2,
  },
  feedbackTagTxt: { fontSize: 11, fontFamily: FONTS.bodySemiBold, color: c.error },

  // Thumbs row (shared) — right-aligned
  thumbsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: 14, paddingVertical: 8,
  },
  thumbBtn:     { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  thumbBtnUp:   { backgroundColor: c.success + '33' },
  thumbBtnDown: { backgroundColor: c.error + '22' },
  thumbTxt:     { fontSize: 15 },
  thumbDivider: { width: 1, height: 18, backgroundColor: c.border, marginHorizontal: 6 },

  // Itinerary card — capped width + centered so the 16:9 weather banner (which scales with
  // width) stays a sensible height on wide/desktop screens instead of becoming a giant strip.
  // On phones the card is narrower than the cap, so it just fills the column as before.
  itinCard: {
    borderRadius: 16,
    borderWidth: 0.5, borderColor: c.border,
    marginBottom: 12, padding: 14, gap: 6, overflow: 'hidden',
    width: '100%', maxWidth: 480, alignSelf: 'center',
  },
  // Weather photo as a short, wide rounded banner across the top of the card. The box is 32:9
  // (an ultra-wide letterbox strip — half the height of a 16:9 band); source images are authored
  // at 32:9 (1600x450) so they fill it edge-to-edge with NO cropping and no letterbox.
  // item.weather may be absent — WeatherArt falls back to its default bundled photo.
  cardBanner: { borderRadius: 12, marginBottom: 4 },
  itinCardContent: { gap: 6 },
  itinHeader:  { gap: 2 },
  itinDate:    { fontSize: 17, fontFamily: FONTS.displayHeavy, color: c.textPrimary },
  itinCity:    { fontSize: 11, color: c.goldText },
  itinMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  prefPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: c.surfaceAlt,
    borderWidth: 1, borderColor: c.border,
  },
  prefPillTxt:  { fontSize: 11, fontFamily: FONTS.bodySemiBold, color: c.goldText },
  itinStatsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  itinStats:    { fontSize: 11, color: c.textSecondary },
  tapDetailHint: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: c.primary, marginTop: 8 },
  chipsScroll:  { paddingVertical: 4, gap: 6, flexDirection: 'row' },
  stopChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: c.surfaceAlt,
    borderWidth: 1,
  },
  stopChipTxt: { fontSize: 12, color: c.textSecondary, maxWidth: 130 },

  // Empty state
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingTop: 80, paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 20, fontFamily: FONTS.bodyBold, color: c.textPrimary, textAlign: 'center' },
  emptySub:   { fontSize: 15, color: c.textMuted, textAlign: 'center', lineHeight: 20 },

  // Feedback modal
  fbOverlay: { ...WEB_OVERLAY_FIX, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  fbCard: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: c.border,
    paddingBottom: 34, overflow: 'hidden',
  },
  fbTitle: {
    fontSize: 16, color: c.textPrimary,
    fontFamily: FONTS.display,
    textAlign: 'center', paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  fbPlace: {
    fontSize: 14, fontFamily: FONTS.bodySemiBold, color: c.textPrimary,
    paddingHorizontal: 24, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: c.surfaceAlt,
  },
  fbOption:    { paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.surfaceAlt },
  fbOptionTxt: { fontSize: 15, fontFamily: FONTS.bodyMedium, color: c.textSecondary },
  fbCancel: {
    marginHorizontal: 20, marginTop: 14, borderRadius: 16,
    height: 56, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
  },
  fbCancelTxt: { color: c.textMuted, fontSize: 14, fontFamily: FONTS.bodySemiBold },
});
