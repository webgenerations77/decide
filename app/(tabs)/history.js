import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { DEMO_HISTORY } from '../../services/demoData';

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  food: '#00d2be', activity: '#00a896', shopping: '#7c3aed', outdoor: '#00D2BE',
};
const CATEGORY_EMOJIS = {
  food: '🍽️', activity: '🎭', shopping: '🛍️', outdoor: '🌿',
};
const FEEDBACK_REASONS = ['Closed', 'Too crowded', 'Not my style', 'Too far', 'Too expensive', 'Other'];


// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTimestamp(ts) {
  const d   = new Date(ts);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dMidnight     = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const diff = todayMidnight - dMidnight;
  if (diff === 0)         return `Today · ${time}`;
  if (diff === 86400000)  return `Yesterday · ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
}

// ─── FeedbackModal ────────────────────────────────────────────────────────────
function FeedbackModal({ visible, itemName, onClose, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.fbOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
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
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── DecisionCard ─────────────────────────────────────────────────────────────
function DecisionCard({ item, onFeedbackUp, onFeedbackDown }) {
  const color    = CATEGORY_COLORS[item.category] ?? '#00D2BE';
  const catEmoji = CATEGORY_EMOJIS[item.category] ?? '⚡';
  const score    = item.excitementScore ?? item.excitement_score ?? 0;

  return (
    <View style={[styles.decisionCard, { borderLeftColor: color }]}>
      <View style={styles.decisionTop}>
        <View style={styles.decisionNameRow}>
          <Text style={styles.decisionCatEmoji}>{catEmoji}</Text>
          <Text style={styles.decisionName} numberOfLines={1}>{item.name}</Text>
          {score > 0 && (
            <View style={styles.exciteBadge}>
              <Text style={styles.exciteText}>⚡{score}</Text>
            </View>
          )}
        </View>

        {item.reason ? (
          <Text style={styles.decisionReason} numberOfLines={2}>{item.reason}</Text>
        ) : null}

        <View style={styles.decisionMetaRow}>
          <Text style={styles.decisionTime}>{formatTimestamp(item.timestamp)}</Text>
          {item.rating > 0 && <Text style={styles.decisionMeta}>⭐ {item.rating}</Text>}
          {item.distance ? <Text style={styles.decisionMeta}>{item.distance}</Text> : null}
        </View>

        {item.feedback === 'down' && item.feedbackReason ? (
          <View style={styles.feedbackTag}>
            <Text style={styles.feedbackTagTxt}>❌ {item.feedbackReason}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.thumbsRow}>
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
  );
}

// ─── ItineraryEntry ───────────────────────────────────────────────────────────
function ItineraryEntry({ item, onFeedbackUp, onFeedbackDown }) {
  const prefs   = item.meta?.preferences ?? {};
  const pills   = [prefs.pace, prefs.budget, prefs.group_type].filter(Boolean);
  const dayLine = `${item.meta?.day_of_week ?? ''}, ${item.meta?.date ?? ''}`.trim().replace(/^,\s*/, '');
  const weatherLine = item.weather
    ? `${item.weather.emoji ?? ''} ${item.weather.temp_f}°F`
    : '';
  const stopCount = item.stops?.length ?? 0;

  return (
    <View style={styles.itinCard}>
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

      {item.stops?.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {item.stops.map((stop, i) => {
            const c = CATEGORY_COLORS[stop.category] ?? '#555';
            return (
              <View key={i} style={[styles.stopChip, { borderColor: c + '55' }]}>
                <Text style={styles.stopChipTxt} numberOfLines={1}>{stop.name}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {item.feedback === 'down' && item.feedbackReason ? (
        <View style={[styles.feedbackTag, { marginTop: 6 }]}>
          <Text style={styles.feedbackTagTxt}>❌ {item.feedbackReason}</Text>
        </View>
      ) : null}

      <View style={[styles.thumbsRow, { borderTopWidth: 0.5, borderTopColor: '#003040', paddingTop: 10, marginTop: 8 }]}>
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
  const router = useRouter();

  const [activeFilter,    setActiveFilter]    = useState('decisions');
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
        const [dRaw, iRaw] = await Promise.all([
          AsyncStorage.getItem('@decide/decisions'),
          AsyncStorage.getItem('@decide/itineraries'),
        ]);
        setDecisions(dRaw ? JSON.parse(dRaw) : []);
        setItineraries(iRaw ? JSON.parse(iRaw) : []);
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
      if (!isDemo) { try { await AsyncStorage.setItem('@decide/decisions', JSON.stringify(updated)); } catch {} }
    } else {
      const updated = itineraries.map((it) =>
        it.id === pendingItem.id ? { ...it, feedback: type, feedbackReason: reason } : it
      );
      setItineraries(updated);
      if (!isDemo) { try { await AsyncStorage.setItem('@decide/itineraries', JSON.stringify(updated)); } catch {} }
    }

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
      if (!isDemo) { try { await AsyncStorage.setItem('@decide/decisions', JSON.stringify(updated)); } catch {} }
    } else {
      const updated = itineraries.map((it) =>
        it.id === item.id ? { ...it, feedback: nextFeedback, feedbackReason: null } : it
      );
      setItineraries(updated);
      if (!isDemo) { try { await AsyncStorage.setItem('@decide/itineraries', JSON.stringify(updated)); } catch {} }
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
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>HISTORY</Text>

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {['decisions', 'itineraries'].map((f) => (
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
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.replace('/(tabs)/plan')}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyBtnTxt}>Go to DECIDE</Text>
            </TouchableOpacity>
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
          />
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      <FeedbackModal
        visible={feedbackModal}
        itemName={pendingItem?.name ?? pendingItem?.meta?.day_of_week ?? ''}
        onClose={() => { setFeedbackModal(false); setPendingItem(null); setPendingType(null); }}
        onSelect={(reason) => applyFeedback('down', reason)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: '#00191f' },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  title: {
    fontSize: 28, fontWeight: '800', color: '#ffffff',
    letterSpacing: 5, textAlign: 'center', marginBottom: 20,
  },

  // Filter pills
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  filterPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16,
    backgroundColor: '#00262e', borderWidth: 1, borderColor: '#003040',
  },
  filterPillActive:    { backgroundColor: '#00d2be', borderColor: '#00d2be' },
  filterPillTxt:       { fontSize: 13, fontWeight: '600', color: '#00a896' },
  filterPillTxtActive: { color: '#00191f' },
  countTxt: { fontSize: 12, color: '#555', marginLeft: 4 },

  // Learning banner
  learningBanner: {
    marginBottom: 16, borderRadius: 12,
    backgroundColor: '#001419', borderWidth: 1, borderColor: '#003040',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  learningTxt: { fontSize: 12, color: '#a855f7', lineHeight: 17 },

  // Decision card
  decisionCard: {
    backgroundColor: '#00262e', borderRadius: 16,
    borderWidth: 0.5, borderColor: '#003040', borderLeftWidth: 3,
    marginBottom: 12, overflow: 'hidden',
  },
  decisionTop:     { padding: 14, gap: 5 },
  decisionNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  decisionCatEmoji: { fontSize: 16 },
  decisionName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#ffffff' },
  exciteBadge: {
    backgroundColor: '#9333EA', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  exciteText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  decisionReason: {
    fontSize: 13, color: '#00a896', fontStyle: 'italic', lineHeight: 17,
  },
  decisionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  decisionTime:    { fontSize: 11, color: '#555' },
  decisionMeta:    { fontSize: 11, color: '#555' },

  feedbackTag: {
    alignSelf: 'flex-start', backgroundColor: '#7f1d1d33',
    borderRadius: 8, borderWidth: 1, borderColor: '#991b1b55',
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 2,
  },
  feedbackTagTxt: { fontSize: 11, color: '#f87171', fontWeight: '600' },

  // Thumbs row (shared) — right-aligned
  thumbsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: 14, paddingVertical: 8,
  },
  thumbBtn:     { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  thumbBtnUp:   { backgroundColor: '#14532d33' },
  thumbBtnDown: { backgroundColor: '#7f1d1d33' },
  thumbTxt:     { fontSize: 15 },
  thumbDivider: { width: 1, height: 18, backgroundColor: '#003040', marginHorizontal: 6 },

  // Itinerary card
  itinCard: {
    backgroundColor: '#00262e', borderRadius: 16,
    borderWidth: 0.5, borderColor: '#003040',
    marginBottom: 12, padding: 14, gap: 6, overflow: 'hidden',
  },
  itinHeader:  { gap: 2 },
  itinDate:    { fontSize: 17, fontWeight: '800', color: '#ffffff' },
  itinCity:    { fontSize: 11, color: '#a855f7' },
  itinMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  prefPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: '#00262e',
    borderWidth: 1, borderColor: '#003040',
  },
  prefPillTxt: { fontSize: 11, color: '#00D2BE', fontWeight: '600' },
  itinStatsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  itinStats:    { fontSize: 11, color: '#00a896' },
  chipsScroll:  { paddingVertical: 4, gap: 6, flexDirection: 'row' },
  stopChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: '#00262e',
    borderWidth: 1,
  },
  stopChipTxt: { fontSize: 12, color: '#C0DCD9', maxWidth: 130 },

  // Empty state
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingTop: 80, paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff', textAlign: 'center' },
  emptySub:   { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 8, backgroundColor: '#00d2be', borderRadius: 16,
    height: 56, paddingHorizontal: 32,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#00d2be', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 12,
  },
  emptyBtnTxt: { color: '#00191f', fontSize: 15, fontWeight: '700' },

  // Feedback modal
  fbOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  fbCard: {
    backgroundColor: '#00262e',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: '#003040',
    paddingBottom: 34, overflow: 'hidden',
  },
  fbTitle: {
    fontSize: 11, fontWeight: '700', color: '#a855f7', letterSpacing: 2,
    textAlign: 'center', paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: '#003040',
  },
  fbPlace: {
    fontSize: 14, fontWeight: '600', color: '#fff',
    paddingHorizontal: 24, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#00262e',
  },
  fbOption:    { paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#00262e' },
  fbOptionTxt: { fontSize: 15, fontWeight: '500', color: '#C0DCD9' },
  fbCancel: {
    marginHorizontal: 20, marginTop: 14, borderRadius: 16,
    height: 56, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00262e', borderWidth: 1, borderColor: '#003040',
  },
  fbCancelTxt: { color: '#666', fontSize: 14, fontWeight: '600' },
});
