import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Linking, ActivityIndicator, Animated, Modal, Platform, Dimensions, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import SkeletonStopCard from '../../components/SkeletonCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { generateItinerary, swapStop } from '../../services/itineraryService';
import { loadPlanDefaults, KEYS } from '../../services/settingsService';
import { isAtDecisionLimit, incrementDecisionCount, getRemainingDecisions, LIMITS } from '../../services/subscriptionService';
import { scheduleItineraryAlerts, cancelItineraryAlerts } from '../../services/notificationService';
import { COLORS, CATEGORY_COLORS, CATEGORY_EMOJIS, PRICE_LEGEND, FONTS } from '../../constants/theme';
import { getLocalKnowledge, getAllergyAlerts } from '../../constants/localKnowledge';

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

function getApiBase() {
  if (Platform.OS === 'web') return '';
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri.split(':')[0]}:8081`;
  return 'http://localhost:8081';
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function getNextSevenDays() {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const label =
      i === 0 ? 'Today' :
      i === 1 ? 'Tomorrow' :
      d.toLocaleDateString('en-US', { weekday: 'long' });
    const sub =
      i <= 1
        ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    days.push({ label, sub, isoDate: d.toISOString() });
  }
  return days;
}

function datePillLabel(isoDate) {
  const d       = isoDate ? new Date(isoDate) : new Date();
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const cmp     = new Date(d); cmp.setHours(0, 0, 0, 0);
  if (cmp.getTime() === today.getTime())    return 'Today';
  if (cmp.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// ─── Time options ─────────────────────────────────────────────────────────────
const START_TIMES = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM'];
const END_TIMES   = ['4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'];

function timeToMinutes(timeStr) {
  const [time, period] = timeStr.split(' ');
  let [hours] = time.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60;
}

// ─── Preference options ───────────────────────────────────────────────────────
const PACE_OPTIONS = [
  { id: 'relaxed',  label: 'Relaxed',  emoji: '🌿' },
  { id: 'moderate', label: 'Moderate', emoji: '⚡' },
  { id: 'packed',   label: 'Packed',   emoji: '🔥' },
];
const BUDGET_OPTIONS = [
  { id: '$',    label: '$'    },
  { id: '$$',   label: '$$'   },
  { id: '$$$',  label: '$$$'  },
  { id: '$$$$', label: '$$$$' },
];
const GROUP_OPTIONS = [
  { id: 'solo',    label: 'Solo',    emoji: '🧍' },
  { id: 'couple',  label: 'Couple',  emoji: '👫' },
  { id: 'family',  label: 'Family',  emoji: '👨‍👩‍👧' },
  { id: 'friends', label: 'Friends', emoji: '👥' },
];

// ─── Feedback reasons ─────────────────────────────────────────────────────────
const FEEDBACK_REASONS = ['Closed', 'Too crowded', 'Not my style', 'Too far', 'Too expensive', 'Other'];

// ─── Highlight config ─────────────────────────────────────────────────────────
const highlightConfig = {
  entertainment: { icon: '🎵', borderColor: COLORS.amber },
  special:       { icon: '🏷️', borderColor: COLORS.primary },
  feature:       { icon: '✨', borderColor: COLORS.amber },
  buzz:          { icon: '📰', borderColor: COLORS.textMuted },
};

// ─── Open maps ────────────────────────────────────────────────────────────────
function openMaps(stop) {
  const target = stop.lat && stop.lng
    ? `${stop.lat},${stop.lng}`
    : encodeURIComponent(stop.address || stop.name);
  const url = Platform.OS === 'ios'
    ? `maps://?daddr=${target}`
    : `https://maps.google.com/?daddr=${target}`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${target}`);
  });
}

// ─── Price legend modal ───────────────────────────────────────────────────────
function PriceLegendModal({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.legendCard}>
            <Text style={styles.legendTitle}>Price guide</Text>
            {PRICE_LEGEND.map((row) => (
              <View key={row.symbol} style={styles.legendRow}>
                <Text style={styles.legendSymbol}>{row.symbol}</Text>
                <Text style={styles.legendLabel}>{row.label}</Text>
              </View>
            ))}
            <Text style={styles.legendSub}>Estimated per-person cost including a typical meal or entry</Text>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── TimePickerPill ───────────────────────────────────────────────────────────
function TimePickerPill({ label, value, options, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={[styles.timePill, disabled && { opacity: 0.5 }]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.timePillLabel}>{label}</Text>
        <View style={styles.timePillInner}>
          <Text style={styles.timePillValue}>{value}</Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textMuted} />
        </View>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{label} time</Text>
              {options.map((opt, i) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.modalOption,
                    opt === value && styles.modalOptionActive,
                    i === options.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => { onChange(opt); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalOptionText, opt === value && styles.modalOptionTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── FeedbackModal ────────────────────────────────────────────────────────────
function FeedbackModal({ visible, placeName, onClose, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.fbOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.fbCard}>
            <View style={styles.fbHandle} />
            <Text style={styles.fbTitle}>What was the issue?</Text>
            <Text style={styles.fbPlace} numberOfLines={1}>{placeName}</Text>
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

// ─── PlaceDetailModal ─────────────────────────────────────────────────────────
function PlaceDetailModal({ visible, stop, onClose }) {
  const [placeDetails,  setPlaceDetails]  = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showLegend,    setShowLegend]    = useState(false);
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    if (!visible || !stop) { setPlaceDetails(null); return; }
    const pid = stop.place_id ?? '';
    const isDemo     = pid.startsWith('demo_');
    const isExternal = pid.startsWith('nps_') || pid.startsWith('ridb_');
    if (isDemo || isExternal || !GOOGLE_KEY || !pid) {
      setPlaceDetails(null);
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    setPlaceDetails(null);
    const fields = 'name,rating,user_ratings_total,formatted_phone_number,website,opening_hours,price_level';
    const base = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pid}&fields=${encodeURIComponent(fields)}&key=${GOOGLE_KEY}`;
    const url  = Platform.OS === 'web' ? `https://corsproxy.io/?${encodeURIComponent(base)}` : base;
    fetch(url)
      .then((r) => r.json())
      .then((data) => { setPlaceDetails(data.result ?? null); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }, [visible, stop?.place_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stop) return null;

  const color    = CATEGORY_COLORS[stop.category] ?? COLORS.amber;
  const catEmoji = CATEGORY_EMOJIS[stop.category] ?? '⚡';
  const priceLvl = [null, '$', '$$', '$$$', '$$$$'];

  const rating    = stop.rating ?? placeDetails?.rating ?? 0;
  const priceStr  = placeDetails?.price_level != null ? (priceLvl[placeDetails.price_level] ?? null) : null;
  const openNow   = placeDetails?.opening_hours?.open_now;
  const todayIdx  = new Date().getDay();
  const todayHours = placeDetails?.opening_hours?.weekday_text
    ? placeDetails.opening_hours.weekday_text[(todayIdx + 6) % 7]?.split(': ').slice(1).join(': ') ?? null
    : null;
  const phone   = stop.phone   ?? placeDetails?.formatted_phone_number ?? null;
  const website = stop.website ?? placeDetails?.website ?? null;

  const hasInfoRow = rating > 0 || priceStr || openNow != null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.detailOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[styles.detailSheet, { height: screenHeight * 0.75 }]}>
            <View style={styles.dragHandle} />

            <View style={styles.detailHeader}>
              <View style={[styles.detailCatPill, { backgroundColor: color + '22' }]}>
                <Text style={[styles.detailCatPillTxt, { color }]}>{catEmoji} {(stop.category ?? '').toUpperCase()}</Text>
              </View>
              <TouchableOpacity style={styles.detailCloseBtn} onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.detailScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 32 }}
            >
              <Text style={styles.detailName}>{stop.name}</Text>
              {stop.address ? <Text style={styles.detailAddr}>{stop.address}</Text> : null}

              {hasInfoRow && (
                <View style={styles.detailInfoRow}>
                  {rating > 0 && (
                    <Text style={styles.detailInfoTxt}>
                      ⭐ {typeof rating === 'number' ? rating.toFixed(1) : rating}
                    </Text>
                  )}
                  {priceStr && (
                    <>
                      <Text style={styles.detailInfoDot}>·</Text>
                      <TouchableOpacity onPress={() => setShowLegend(true)} activeOpacity={0.7}>
                        <Text style={[styles.detailInfoTxt, { color: COLORS.amber }]}>{priceStr} ⓘ</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {openNow != null && (
                    <>
                      <Text style={styles.detailInfoDot}>·</Text>
                      <Text style={[styles.detailInfoTxt, { color: openNow ? COLORS.success : COLORS.error }]}>
                        {openNow ? '● Open' : '● Closed'}
                      </Text>
                    </>
                  )}
                  {todayHours && (
                    <><Text style={styles.detailInfoDot}>·</Text><Text style={styles.detailInfoTxt}>{todayHours}</Text></>
                  )}
                </View>
              )}

              {stop.admission_cost && (
                <View style={styles.admissionRow}>
                  <Ionicons name="ticket-outline" size={14} color={COLORS.amber} />
                  <Text style={styles.admissionLabel}>Admission</Text>
                  <Text style={styles.admissionValue}>{stop.admission_cost}</Text>
                </View>
              )}

              {detailLoading && <ActivityIndicator color={COLORS.amber} style={{ marginVertical: 20 }} />}

              {stop.place_id?.startsWith('nps_')  && <View style={styles.detailSourceBadge}><Text style={styles.detailSourceTxt}>🌲 National Park Service</Text></View>}
              {stop.place_id?.startsWith('ridb_') && <View style={styles.detailSourceBadge}><Text style={styles.detailSourceTxt}>🏕️ Recreation.gov</Text></View>}

              {stop.reason ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionLabel}>Cheddar's take</Text>
                  <Text style={styles.detailReasonText}>{stop.reason}</Text>
                </View>
              ) : null}

              {stop.highlights?.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionLabel}>Highlights</Text>
                  {stop.highlights.map((h, i) => {
                    const cfg = highlightConfig[h.type] ?? highlightConfig.feature;
                    return (
                      <View key={i} style={[styles.highlightRow, { borderLeftColor: cfg.borderColor }]}>
                        <Text style={styles.highlightIcon}>{cfg.icon}</Text>
                        <Text style={styles.highlightText}>{h.text}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {(stop.distance || stop.excitement_score > 0) && (
                <View style={styles.detailStatsRow}>
                  {stop.distance ? (
                    <TouchableOpacity onPress={() => openMaps(stop)} activeOpacity={0.7} style={styles.distanceLink}>
                      <Ionicons name="location-outline" size={14} color={COLORS.amber} style={{ marginRight: 4 }} />
                      <Text style={styles.distanceLinkTxt}>{stop.distance}</Text>
                    </TouchableOpacity>
                  ) : <View />}
                  {stop.excitement_score > 0 && (
                    <View style={styles.detailExciteBadge}>
                      <Text style={styles.detailExciteTxt}>⚡ {stop.excitement_score}</Text>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity style={styles.detailNavBtn} onPress={() => openMaps(stop)} activeOpacity={0.7}>
                <Ionicons name="navigate" size={18} color={COLORS.primaryText} style={{ marginRight: 8 }} />
                <Text style={styles.detailNavBtnTxt}>Navigate here</Text>
              </TouchableOpacity>

              {(phone || website) && (
                <View style={styles.detailSecondaryBtns}>
                  {phone ? (
                    <TouchableOpacity
                      style={styles.detailSecBtn}
                      onPress={() => Linking.openURL(`tel:${phone}`)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="call-outline" size={16} color={COLORS.amber} style={{ marginRight: 6 }} />
                      <Text style={styles.detailSecBtnTxt}>Call</Text>
                    </TouchableOpacity>
                  ) : null}
                  {website ? (
                    <TouchableOpacity
                      style={styles.detailSecBtn}
                      onPress={() => Linking.openURL(website)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="globe-outline" size={16} color={COLORS.amber} style={{ marginRight: 6 }} />
                      <Text style={styles.detailSecBtnTxt}>Website</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>

      <PriceLegendModal visible={showLegend} onClose={() => setShowLegend(false)} />
    </Modal>
  );
}

// ─── StopCard ─────────────────────────────────────────────────────────────────
function StopCard({ stop, index = 0, isLast, onSwap, isSwapping, onViewDetails, weather, planDate, sensitivities }) {
  const [feedback,          setFeedback]          = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showLegend,        setShowLegend]        = useState(false);
  const color = CATEGORY_COLORS[stop.category] ?? COLORS.amber;
  const emoji = CATEGORY_EMOJIS[stop.category] ?? '⚡';

  // Staggered entrance animation
  const enterAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(28)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(enterAnim, { toValue: 1, duration: 380, delay: index * 75, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 360, delay: index * 75, useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCardPressIn  = () => Animated.spring(pressScale, { toValue: 0.98, useNativeDriver: true, damping: 22, stiffness: 320 }).start();
  const handleCardPressOut = () => Animated.spring(pressScale, { toValue: 1,    useNativeDriver: true, damping: 16, stiffness: 260 }).start();

  useEffect(() => {
    if (!stop.place_id) return;
    AsyncStorage.getItem(`@decide/feedback_${stop.place_id}`)
      .then((raw) => { if (raw) { try { setFeedback(JSON.parse(raw).feedback); } catch {} } })
      .catch(() => {});
  }, [stop.place_id]);

  const saveFeedback = (type, reason = null) => {
    if (!stop.place_id) return;
    const data = { placeId: stop.place_id, placeName: stop.name, feedback: type, reason, timestamp: Date.now() };
    AsyncStorage.setItem(`@decide/feedback_${stop.place_id}`, JSON.stringify(data)).catch(() => {});
    setFeedback(type);
  };

  const localTips    = getLocalKnowledge({ stopName: stop.name, stopAddress: stop.address ?? '', category: stop.category, weather, date: planDate });
  const allergyAlerts = getAllergyAlerts({ category: stop.category, stopName: stop.name, stopAddress: stop.address ?? '', sensitivities });

  const isFood = stop.category === 'food';

  return (
    <>
      <Animated.View style={[styles.stopRow, { opacity: enterAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.timelineCol}>
          <View style={[styles.timelineDot, { backgroundColor: color }]} />
          {!isLast && <View style={[styles.timelineLine, { backgroundColor: color + '33' }]} />}
        </View>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => onViewDetails(stop)}
          onPressIn={handleCardPressIn}
          onPressOut={handleCardPressOut}
          disabled={isSwapping}
          style={{ flex: 1 }}
        >
        <Animated.View style={[styles.stopCard, { borderLeftColor: color }, isSwapping && styles.stopCardSwapping, { transform: [{ scale: pressScale }] }]}>
          <View style={styles.stopHeaderRow}>
            <View style={[styles.timeChip, { backgroundColor: color + '22', borderColor: color + '55' }]}>
              <Text style={[styles.timeText, { color }]}>{stop.time}</Text>
            </View>
            <Text style={styles.durationText}>{stop.duration_mins} min</Text>
            <View style={[styles.catChip, { backgroundColor: color + '22' }]}>
              <Text style={styles.catEmoji}>{emoji}</Text>
              <Text style={[styles.catLabel, { color }]}>{stop.category}</Text>
            </View>
          </View>

          <Text style={styles.stopName} numberOfLines={1}>{stop.name}</Text>
          {stop.address ? <Text style={styles.stopAddress} numberOfLines={1}>{stop.address}</Text> : null}

          {stop.distance ? (
            <TouchableOpacity onPress={() => openMaps(stop)} activeOpacity={0.7} style={styles.distancePill}>
              <Ionicons name="location-outline" size={12} color={COLORS.amber} style={{ marginRight: 3 }} />
              <Text style={styles.distancePillTxt}>{stop.distance}</Text>
            </TouchableOpacity>
          ) : null}

          {stop.admission_cost && (
            <View style={styles.admissionBadge}>
              <Ionicons name="ticket-outline" size={12} color={COLORS.amber} style={{ marginRight: 4 }} />
              <Text style={styles.admissionBadgeTxt}>{stop.admission_cost}</Text>
            </View>
          )}

          {isFood && stop.price_level ? (
            <TouchableOpacity onPress={() => setShowLegend(true)} activeOpacity={0.7} style={styles.pricePill}>
              <Text style={styles.pricePillTxt}>{['', '$', '$$', '$$$', '$$$$'][stop.price_level] ?? ''} ⓘ</Text>
            </TouchableOpacity>
          ) : null}

          {stop.reason ? (
            <View style={styles.reasonRow}>
              <Text style={styles.stopReason}>{stop.reason}</Text>
            </View>
          ) : null}

          {localTips.map((tip) => (
            <View key={tip.id} style={[
              styles.localKnowledgeBadge,
              tip.severity === 'warning' ? styles.lkWarning
              : tip.severity === 'info'  ? styles.lkInfo
              : styles.lkTip,
            ]}>
              <Text style={styles.lkIcon}>
                {tip.severity === 'warning' ? '⚠' : tip.severity === 'info' ? 'ℹ' : '💡'}
              </Text>
              <Text style={styles.lkText}>{tip.text}</Text>
            </View>
          ))}

          {allergyAlerts.map((alert, i) => (
            <View key={i} style={styles.allergyBadge}>
              <Ionicons name="warning-outline" size={14} color={COLORS.error} style={{ marginRight: 6 }} />
              <Text style={styles.allergyText}>{alert.sensitivity}: {alert.text}</Text>
            </View>
          ))}

          <View style={styles.cardActionsRow}>
            {stop.excitement_score > 0
              ? <View style={styles.exciteBadge}><Text style={styles.exciteText}>⚡ {stop.excitement_score}</Text></View>
              : <View />
            }
            <TouchableOpacity style={styles.swapBtn} onPress={onSwap} disabled={isSwapping} activeOpacity={0.7}>
              {isSwapping
                ? <View style={styles.swapLoadingRow}>
                    <ActivityIndicator size="small" color={COLORS.textMuted} style={{ marginRight: 5 }} />
                    <Text style={styles.swapBtnText}>Finding…</Text>
                  </View>
                : <Text style={styles.swapBtnText}>Try another →</Text>
              }
            </TouchableOpacity>
          </View>

          <View style={styles.thumbsRow}>
            <TouchableOpacity style={[styles.thumbBtn, feedback === 'up' && styles.thumbBtnUp]} onPress={() => saveFeedback('up')} activeOpacity={0.7}>
              <Text style={styles.thumbTxt}>👍</Text>
            </TouchableOpacity>
            <View style={styles.thumbDivider} />
            <TouchableOpacity style={[styles.thumbBtn, feedback === 'down' && styles.thumbBtnDown]} onPress={() => setShowFeedbackModal(true)} activeOpacity={0.7}>
              <Text style={styles.thumbTxt}>👎</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tapHint}>
            <Text style={styles.tapHintTxt}>Tap for details</Text>
          </View>
        </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      <FeedbackModal
        visible={showFeedbackModal}
        placeName={stop.name}
        onClose={() => setShowFeedbackModal(false)}
        onSelect={(reason) => { saveFeedback('down', reason); setShowFeedbackModal(false); }}
      />
      <PriceLegendModal visible={showLegend} onClose={() => setShowLegend(false)} />
    </>
  );
}

// ─── PillRow ──────────────────────────────────────────────────────────────────
function PillRow({ options, selected, onSelect, disabled }) {
  return (
    <View style={styles.pillsRow}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.id}
          style={[styles.prefPill, selected === o.id && styles.prefPillActive]}
          onPress={() => onSelect(o.id)}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={[styles.prefPillText, selected === o.id && styles.prefPillTextActive]}>
            {o.emoji ? `${o.emoji} ` : ''}{o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── PlanScreen ───────────────────────────────────────────────────────────────
export default function PlanScreen() {
  const router = useRouter();
  const [view, setView] = useState('landing');
  const [remainingDecisions, setRemainingDecisions] = useState(null);

  const [locationLabel, setLocationLabel] = useState('Locating…');
  const [isManual,      setIsManual]      = useState(false);
  const [displayName,   setDisplayName]   = useState('');
  const [sensitivities, setSensitivities] = useState([]);
  const gpsLoadedRef  = useRef(false);
  const gpsLabelRef   = useRef(null);
  const gpsCoordsRef  = useRef(null);

  const [showWeekPicker, setShowWeekPicker] = useState(false);

  const [pace,      setPace]      = useState('moderate');
  const [budget,    setBudget]    = useState('$$');
  const [groupType, setGroupType] = useState('couple');
  const [startTime, setStartTime] = useState('11:00 AM');
  const [endTime,   setEndTime]   = useState('8:00 PM');
  const [cuisines,  setCuisines]  = useState([]);

  const [itinerary,      setItinerary]      = useState(null);
  const [weather,        setWeather]        = useState(null);
  const [meta,           setMeta]           = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [swappingIndex,  setSwappingIndex]  = useState(null);
  const [error,          setError]          = useState(null);
  const [isFallback,     setIsFallback]     = useState(false);
  const [coords,         setCoords]         = useState(null);
  const [planDate,       setPlanDate]       = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [selectedStop,    setSelectedStop]    = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const pulseLoop   = useRef(null);
  const seenDateRef = useRef(null);

  // Landing entrance animations
  const logoAnim  = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const tagAnim   = useRef(new Animated.Value(0)).current;
  const tagSlide  = useRef(new Animated.Value(24)).current;
  const locAnim   = useRef(new Animated.Value(0)).current;
  const btn1Anim  = useRef(new Animated.Value(0)).current;
  const btn1Slide = useRef(new Animated.Value(28)).current;
  const btn2Anim  = useRef(new Animated.Value(0)).current;
  const btn2Slide = useRef(new Animated.Value(28)).current;
  const params      = useLocalSearchParams();

  const isValidTimeWindow = timeToMinutes(endTime) - timeToMinutes(startTime) >= 180;

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const [modeRaw, locRaw, sensRaw] = await Promise.all([
          AsyncStorage.getItem('@decide/location_mode'),
          AsyncStorage.getItem('@decide/manual_location'),
          AsyncStorage.getItem('@decide/sensitivities'),
        ]);
        if (sensRaw) { try { setSensitivities(JSON.parse(sensRaw) ?? []); } catch {} }
        const mode = modeRaw ?? 'auto';
        if (mode === 'manual' && locRaw) {
          const loc = JSON.parse(locRaw);
          if (loc?.latitude && loc?.longitude) {
            setIsManual(true);
            setLocationLabel(loc.short ?? loc.label ?? 'Manual location');
            setCoords({ latitude: loc.latitude, longitude: loc.longitude });
            return;
          }
        }
        setIsManual(false);
      } catch {
        setIsManual(false);
      }

      if (gpsLoadedRef.current && gpsLabelRef.current) {
        setIsManual(false);
        setLocationLabel(gpsLabelRef.current);
        setCoords(gpsCoordsRef.current);
        return;
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLocationLabel('Location unavailable'); return; }

        let pos = await Location.getLastKnownPositionAsync({ maxAge: 300000 });
        if (!pos) {
          pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }
        const { latitude, longitude } = pos.coords;
        setCoords({ latitude, longitude });
        gpsCoordsRef.current = { latitude, longitude };
        AsyncStorage.setItem('lastKnownCoords', JSON.stringify({ latitude, longitude })).catch(() => {});

        let label = null;
        try {
          const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (geo) {
            const city  = geo.city || geo.district || geo.subregion;
            const state = geo.region;
            label = city && state ? `${city}, ${state}`
                  : city          ? city
                  : state         ? state
                  : null;
          }
        } catch (e) {
          console.warn('[location] reverseGeocodeAsync failed:', e?.message ?? e);
        }

        if (!label) {
          try {
            const res  = await fetch(`${getApiBase()}/api/geocode?lat=${latitude}&lng=${longitude}`);
            const data = await res.json();
            if (data.label) label = data.label;
          } catch (e) {
            console.warn('[location] geocode API fetch failed:', e?.message ?? e);
          }
        }

        const finalLabel = label ?? 'Your location';
        gpsLoadedRef.current = true;
        gpsLabelRef.current = finalLabel;
        setLocationLabel(finalLabel);
      } catch (e) {
        console.warn('[location] GPS acquisition failed:', e?.message ?? e);
        setLocationLabel('Location unavailable');
      }
    })();
    getRemainingDecisions().then(setRemainingDecisions).catch(() => {});
  }, []));

  useEffect(() => {
    loadPlanDefaults().then((d) => {
      setPace(d.pace); setBudget(d.budget); setGroupType(d.group);
      setStartTime(d.startTime); setEndTime(d.endTime);
      setCuisines(d.cuisines ?? []);
    });
    AsyncStorage.getItem('@decide/display_name').then((n) => {
      if (n) setDisplayName(n);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!params.date || params.date === seenDateRef.current) return;
    seenDateRef.current = params.date;
    setPlanDate(params.date);
    setView('configuring');
  }, [params.date]);

  useEffect(() => {
    if (loading) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [loading]);

  // Run landing entrance animation whenever the landing view becomes active
  useEffect(() => {
    if (view !== 'landing') return;
    logoAnim.setValue(0); logoScale.setValue(0.85);
    tagAnim.setValue(0);  tagSlide.setValue(24);
    locAnim.setValue(0);
    btn1Anim.setValue(0); btn1Slide.setValue(28);
    btn2Anim.setValue(0); btn2Slide.setValue(28);

    const seq = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, tension: 75, friction: 9, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(tagAnim,  { toValue: 1, duration: 300, delay: 40, useNativeDriver: true }),
        Animated.timing(tagSlide, { toValue: 0, duration: 300, delay: 40, useNativeDriver: true }),
      ]),
      Animated.timing(locAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(btn1Anim,  { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(btn1Slide, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(btn2Anim,  { toValue: 1, duration: 210, delay: 60, useNativeDriver: true }),
        Animated.timing(btn2Slide, { toValue: 0, duration: 210, delay: 60, useNativeDriver: true }),
      ]),
    ]);
    seq.start();
    return () => seq.stop();
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToday = () => {
    setPlanDate(null);
    setView('configuring');
  };

  const handleDaySelect = (isoDate) => {
    setShowWeekPicker(false);
    setPlanDate(isoDate);
    setView('configuring');
  };

  const goToLanding = () => {
    setItinerary(null); setWeather(null); setMeta(null); setError(null); setIsFallback(false);
    setView('landing');
    cancelItineraryAlerts().catch(() => {});
  };

  const generate = async () => {
    if (!coords) { setError("Still finding your location — give it a moment and try again."); return; }
    if (!isValidTimeWindow) return;
    if (await isAtDecisionLimit()) { router.push('/paywall'); return; }
    setLoading(true); setError(null);
    try {
      let feedbackCtx = {};
      try {
        const [dRaw, iRaw] = await Promise.all([
          AsyncStorage.getItem('@decide/decisions'),
          AsyncStorage.getItem('@decide/itineraries'),
        ]);
        const decisions   = dRaw ? JSON.parse(dRaw) : [];
        const itineraries = iRaw ? JSON.parse(iRaw) : [];
        const dislikedPlaces  = decisions.filter((d) => d.feedback === 'down').map((d) => d.name).filter(Boolean);
        const likedPlaces     = decisions.filter((d) => d.feedback === 'up').map((d) => d.name).filter(Boolean);
        const allReasons      = [
          ...decisions.filter((d) => d.feedback === 'down' && d.feedbackReason).map((d) => d.feedbackReason),
          ...itineraries.filter((it) => it.feedback === 'down' && it.feedbackReason).map((it) => it.feedbackReason),
        ];
        const dislikedReasons = [...new Set(allReasons)];
        feedbackCtx = { dislikedPlaces: dislikedPlaces.slice(0, 20), likedPlaces: likedPlaces.slice(0, 10), dislikedReasons };
      } catch {}

      const maxDistRaw = await AsyncStorage.getItem('@decide/max_distance').catch(() => null);
      const maxDistanceMiles = maxDistRaw ? parseInt(maxDistRaw, 10) : 25;

      const data = await generateItinerary({
        latitude:  coords.latitude,
        longitude: coords.longitude,
        preferences: { pace, budget, group_type: groupType, cuisines, sensitivities },
        startTime, endTime, date: planDate,
        feedback: feedbackCtx,
        maxDistanceMiles,
      });
      setItinerary(data.itinerary);
      setWeather(data.weather);
      setMeta(data.meta);
      setIsFallback(data.isFallback ?? false);
      setView('itinerary');

      try {
        const raw      = await AsyncStorage.getItem('@decide/itineraries');
        const existing = raw ? JSON.parse(raw) : [];
        const entry    = {
          id:        `itinerary_${Date.now()}`,
          timestamp: Date.now(),
          meta:      data.meta,
          weather:   data.weather,
          stops:     (data.itinerary ?? []).map((s) => ({ name: s.name, category: s.category })),
          feedback:  null, feedbackReason: null,
        };
        await AsyncStorage.setItem(
          '@decide/itineraries',
          JSON.stringify([entry, ...existing.slice(0, 49)])
        );
      } catch (e) {
        console.warn('[history] save itinerary error', e);
      }
      await incrementDecisionCount().catch(() => {});
      getRemainingDecisions().then(setRemainingDecisions).catch(() => {});
      const notifEnabled = await AsyncStorage.getItem(KEYS.NOTIFICATIONS).catch(() => null);
      if (notifEnabled === 'true' && data.itinerary) {
        scheduleItineraryAlerts(data.itinerary).catch(console.warn);
      }
    } catch (err) {
      console.error('[plan] generate error:', err);
      setError(err.message ?? "Hmm, something didn't go through. Try again?");
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async (index) => {
    if (!coords) return;
    setSwappingIndex(index);
    try {
      const updated = await swapStop({
        itinerary, stopIndex: index,
        latitude: coords.latitude, longitude: coords.longitude,
      });
      setItinerary(updated);
    } catch (err) {
      console.error('[plan] swap error:', err);
      setError(err.message ?? "Couldn't find a swap. Try again.");
    } finally {
      setSwappingIndex(null);
    }
  };

  const handleNavigateFullDay = () => {
    if (!itinerary?.length) return;
    const encode = (s) => s.lat && s.lng
      ? `${s.lat},${s.lng}`
      : encodeURIComponent(s.address || s.name);
    const stops = itinerary.map(encode);
    let url = `https://www.google.com/maps/dir/?api=1&origin=${stops[0]}&destination=${stops[stops.length - 1]}&travelmode=driving`;
    if (stops.length > 2) url += `&waypoints=${stops.slice(1, -1).join('|')}`;
    Linking.openURL(url);
  };

  const resetToConfiguring = () => {
    setItinerary(null); setWeather(null); setMeta(null); setError(null); setIsFallback(false);
    setView('configuring');
  };

  const locationPillText = `${isManual ? '📌 ' : '📍 '}${locationLabel}`;
  const hasItinerary     = Array.isArray(itinerary) && itinerary.length > 0;
  const weatherPillText  = weather
    ? `${weather.emoji ?? ''} ${weather.condition} · ${weather.temp_f}°F${weather.wind_speed_mph ? ` · 💨 ${weather.wind_speed_mph}mph` : ''} · ${meta?.time_window ?? `${startTime} – ${endTime}`}`
    : `${startTime} – ${endTime}`;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── LANDING ──────────────────────────────────────────────────────── */}
        {view === 'landing' && (
          <LinearGradient
            colors={[COLORS.bg, '#0D2040', '#0A1C38', COLORS.bg]}
            locations={[0, 0.28, 0.68, 1]}
            style={styles.landingContainer}
          >
            {/* Logo — springs in */}
            <Animated.View style={[styles.landingHeader, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}>
              {displayName ? (
                <Text style={styles.landingGreeting}>Hey, {displayName}</Text>
              ) : null}
              <Image
                source={require('../../assets/logo-small.png')}
                style={styles.landingLogo}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Tagline — slides up */}
            <Animated.View style={[styles.landingTaglineWrap, { opacity: tagAnim, transform: [{ translateY: tagSlide }] }]}>
              <Text style={styles.landingTagline}>Your day, decided.</Text>
            </Animated.View>

            {/* Location pill */}
            <Animated.View style={[styles.locationPillWrap, { opacity: locAnim }]}>
              <View style={styles.locationPill}>
                <Ionicons name={isManual ? 'pin' : 'location'} size={13} color={COLORS.amber} />
                <Text style={styles.locationText}>{locationLabel}</Text>
              </View>
            </Animated.View>

            {/* CTA buttons */}
            <View style={styles.landingButtons}>
              <Animated.View style={{ opacity: btn1Anim, transform: [{ translateY: btn1Slide }], width: '100%' }}>
                <TouchableOpacity style={styles.landingBtnTouch} onPress={handleToday} activeOpacity={0.88}>
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.decideBtn, styles.decideBtnPrimary]}
                  >
                    <Text style={styles.decideBtnTitle}>Plan today</Text>
                    <Text style={styles.decideBtnSub}>Build my full-day itinerary</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ opacity: btn2Anim, transform: [{ translateY: btn2Slide }], width: '100%' }}>
                <TouchableOpacity style={styles.landingBtnTouch} onPress={() => setShowWeekPicker(true)} activeOpacity={0.75}>
                  <View style={[styles.decideBtn, styles.decideBtnSecondary]}>
                    <Text style={[styles.decideBtnTitle, { color: COLORS.amber }]}>Plan another day</Text>
                    <Text style={[styles.decideBtnSub, { color: COLORS.textMuted }]}>Choose a day this week</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>

            <Text style={styles.landingSubtext}>Cheddar-curated, based on where you are</Text>
          </LinearGradient>
        )}

        {/* ─── CONFIGURING ──────────────────────────────────────────────────── */}
        {view === 'configuring' && (
          <View style={styles.planContainer}>
            <View style={styles.header}>
              <TouchableOpacity onPress={goToLanding} activeOpacity={0.7} style={styles.backRow}>
                <Text style={styles.backText}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.appName}>Plan your day</Text>
              <View style={styles.headerPill}>
                <Text style={styles.headerPillText}>{locationPillText}</Text>
              </View>
            </View>

            <View style={styles.prefsCard}>
              <Text style={styles.prefLabel}>Date</Text>
              <TouchableOpacity
                style={[styles.datePill, loading && { opacity: 0.5 }]}
                onPress={() => !loading && setShowDatePicker(true)}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Text style={styles.datePillValue}>📅  {datePillLabel(planDate)}</Text>
                <Ionicons name="chevron-down" size={13} color={COLORS.textMuted} />
              </TouchableOpacity>

              <Text style={styles.prefLabel}>Pace</Text>
              <PillRow options={PACE_OPTIONS}   selected={pace}      onSelect={setPace}      disabled={loading} />

              <Text style={styles.prefLabel}>Budget</Text>
              <PillRow options={BUDGET_OPTIONS} selected={budget}    onSelect={setBudget}    disabled={loading} />

              <Text style={styles.prefLabel}>Group</Text>
              <PillRow options={GROUP_OPTIONS}  selected={groupType} onSelect={setGroupType} disabled={loading} />

              <Text style={styles.prefLabel}>Time window</Text>
              <View style={styles.timePickerRow}>
                <TimePickerPill label="Start" value={startTime} options={START_TIMES} onChange={setStartTime} disabled={loading} />
                <Text style={styles.timeArrow}>→</Text>
                <TimePickerPill label="End"   value={endTime}   options={END_TIMES}   onChange={setEndTime}   disabled={loading} />
              </View>
              {!isValidTimeWindow && (
                <Text style={styles.timeValidationHint}>Please allow at least 3 hours</Text>
              )}
            </View>

            {error ? (
              <View style={styles.errorBlock}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={generate} activeOpacity={0.7}>
                  <Text style={styles.retryBtnText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {loading && (
              <View style={styles.skeletonSection}>
                <Text style={styles.skeletonLabel}>Building your day…</Text>
                <SkeletonStopCard delay={0} />
                <SkeletonStopCard delay={180} />
                <SkeletonStopCard delay={360} />
              </View>
            )}
          </View>
        )}

        {/* ─── ITINERARY ────────────────────────────────────────────────────── */}
        {view === 'itinerary' && hasItinerary && (
          <View style={styles.planContainer}>
            <View style={styles.header}>
              <Text style={styles.appName}>Your day</Text>
              <View style={styles.headerPill}>
                <Text style={styles.headerPillText}>{weatherPillText}</Text>
              </View>
            </View>

            <View style={styles.itineraryContainer}>
              {isFallback && (
                <View style={styles.fallbackBanner}>
                  <Ionicons name="cloud-offline-outline" size={14} color={COLORS.warning} style={{ marginRight: 6 }} />
                  <Text style={styles.fallbackBannerTxt}>
                    Offline mode — showing top-rated nearby places.
                  </Text>
                </View>
              )}
              {meta && (
                <View style={styles.itineraryMeta}>
                  <Text style={styles.itineraryDay}>{meta.day_of_week}</Text>
                  <Text style={styles.itineraryDate}>{meta.date} · {itinerary.length} stops</Text>
                  {meta.city ? <Text style={styles.itineraryCity}>📍 {meta.city}</Text> : null}
                  <View style={styles.metaChips}>
                    {meta.time_window && (
                      <View style={[styles.metaChip, styles.metaChipTime]}>
                        <Text style={[styles.metaChipText, styles.metaChipTimeText]}>🕐 {meta.time_window}</Text>
                      </View>
                    )}
                    {[meta.preferences?.pace, meta.preferences?.budget, meta.preferences?.group_type]
                      .filter(Boolean)
                      .map((v) => (
                        <View key={v} style={styles.metaChip}>
                          <Text style={styles.metaChipText}>{v}</Text>
                        </View>
                      ))}
                  </View>
                </View>
              )}

              {itinerary.map((stop, i) => (
                <StopCard
                  key={`${stop.place_id}-${i}`}
                  stop={stop}
                  index={i}
                  isLast={i === itinerary.length - 1}
                  onSwap={() => handleSwap(i)}
                  isSwapping={swappingIndex === i}
                  onViewDetails={(s) => { setSelectedStop(s); setShowDetailModal(true); }}
                  weather={weather}
                  planDate={planDate}
                  sensitivities={sensitivities}
                />
              ))}

              <TouchableOpacity
                style={styles.resetBtn}
                onPress={resetToConfiguring}
                disabled={swappingIndex !== null}
                activeOpacity={0.7}
              >
                <Text style={styles.resetBtnText}>Change plan preferences</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: view === 'landing' ? 40 : 100 }} />
      </ScrollView>

      {/* Sticky generate button */}
      {view === 'configuring' && (
        <View style={styles.stickyNavContainer}>
          <Animated.View style={{ opacity: loading ? pulseAnim : 1 }}>
            <TouchableOpacity
              onPress={generate}
              disabled={loading || !isValidTimeWindow}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.generateBtn, (loading || !isValidTimeWindow) && styles.generateBtnDisabled]}
              >
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={COLORS.primaryText} size="small" style={{ marginRight: 10 }} />
                    <Text style={styles.generateBtnText}>Finding the good stuff…</Text>
                  </View>
                ) : (
                  <Text style={styles.generateBtnText}>Build my day →</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
          {!loading && <Text style={styles.generateSubtext}>Cheddar-curated, based on where you are</Text>}
          {!loading && remainingDecisions != null && remainingDecisions !== Infinity && (
            <Text style={styles.remainingText}>{remainingDecisions}/{LIMITS.FREE_DECISIONS_PER_DAY} decisions left today</Text>
          )}
        </View>
      )}

      {/* Sticky navigate button */}
      {view === 'itinerary' && hasItinerary && (
        <View style={styles.stickyNavContainer}>
          <TouchableOpacity onPress={handleNavigateFullDay} activeOpacity={0.88}>
            <LinearGradient
              colors={[COLORS.amber, COLORS.amberDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.stickyNavBtn}
            >
              <Ionicons name="navigate" size={18} color={COLORS.bg} style={{ marginRight: 8 }} />
              <Text style={[styles.stickyNavTxt, { color: COLORS.bg }]}>Navigate full day</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Week picker */}
      <Modal visible={showWeekPicker} transparent animationType="slide" onRequestClose={() => setShowWeekPicker(false)}>
        <TouchableOpacity style={styles.weekPickerOverlay} activeOpacity={1} onPress={() => setShowWeekPicker(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.weekPickerCard}>
              <View style={styles.weekPickerHeader}>
                <Text style={styles.weekPickerTitle}>Choose a day</Text>
                <TouchableOpacity style={styles.weekPickerClose} onPress={() => setShowWeekPicker(false)} activeOpacity={0.7}>
                  <Ionicons name="close" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              {getNextSevenDays().map((day, i) => (
                <TouchableOpacity
                  key={day.isoDate}
                  style={[styles.dayRow, i === 6 && styles.dayRowLast]}
                  onPress={() => handleDaySelect(i === 0 ? null : day.isoDate)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayLabel, i === 0 && styles.dayLabelToday]}>{day.label}</Text>
                  <Text style={styles.daySub}>{day.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Date picker */}
      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity style={styles.weekPickerOverlay} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.weekPickerCard}>
              <View style={styles.weekPickerHeader}>
                <Text style={styles.weekPickerTitle}>Choose a day</Text>
                <TouchableOpacity style={styles.weekPickerClose} onPress={() => setShowDatePicker(false)} activeOpacity={0.7}>
                  <Ionicons name="close" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              {getNextSevenDays().map((day, i) => (
                <TouchableOpacity
                  key={day.isoDate}
                  style={[styles.dayRow, i === 6 && styles.dayRowLast]}
                  onPress={() => { setPlanDate(i === 0 ? null : day.isoDate); setShowDatePicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayLabel, datePillLabel(planDate) === day.label && styles.dayLabelToday]}>
                    {day.label}
                  </Text>
                  <Text style={styles.daySub}>{day.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <PlaceDetailModal
        visible={showDetailModal}
        stop={selectedStop}
        onClose={() => setShowDetailModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: COLORS.bg },
  scroll:        { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // ── Landing ──────────────────────────────────────────────────────────────
  landingContainer: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 56, paddingBottom: 48,
    justifyContent: 'center',
  },
  landingHeader: { alignItems: 'center', marginBottom: 8 },
  landingGreeting: {
    fontSize: 15, color: COLORS.amber, fontWeight: '600',
    letterSpacing: 0.2, marginBottom: 8,
  },
  landingLogo: { width: 148, height: 148 },
  landingTaglineWrap: { alignItems: 'center', marginBottom: 20, marginTop: 4 },
  landingTagline: {
    fontSize: 22, color: COLORS.textPrimary, textAlign: 'center',
    fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: 0.3, lineHeight: 30,
  },
  locationPillWrap: { marginBottom: 44 },
  locationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 20, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  locationText: { fontSize: 13, color: COLORS.textSecondary, letterSpacing: 0.2 },
  landingButtons: { width: '100%', gap: 14, marginBottom: 28 },
  landingBtnTouch: { width: '100%' },
  decideBtn: {
    width: '100%', paddingVertical: 20, paddingHorizontal: 24,
    borderRadius: 20, alignItems: 'center', gap: 5,
  },
  decideBtnPrimary: {
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 20, elevation: 18,
  },
  decideBtnSecondary: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  decideBtnTitle: { color: COLORS.primaryText, fontSize: 18, fontWeight: '700' },
  decideBtnSub:   { color: 'rgba(255,248,240,0.5)', fontSize: 12, letterSpacing: 0.2 },
  landingSubtext: { fontSize: 12, color: COLORS.textMuted, letterSpacing: 0.2, textAlign: 'center' },

  // Skeleton loading
  skeletonSection: { marginTop: 24, gap: 0 },
  skeletonLabel: {
    fontSize: 12, color: COLORS.amber, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 20, textAlign: 'center',
  },

  // ── Plan / Itinerary container ────────────────────────────────────────────
  planContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },

  // Header
  header:         { alignItems: 'center', marginBottom: 24 },
  backRow:        { marginBottom: 10 },
  backText:       { fontSize: 13, color: COLORS.amber, fontWeight: '600' },
  appName: {
    fontSize: 26, color: COLORS.textPrimary,
    fontFamily: 'PlayfairDisplay_800ExtraBold',
  },
  headerPill: {
    marginTop: 10, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerPillText: { fontSize: 12, color: COLORS.textSecondary, letterSpacing: 0.2 },

  // Preferences card
  prefsCard: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 20, marginBottom: 16, gap: 12,
  },
  datePill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceAlt, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  datePillValue:   { fontSize: 14, fontWeight: '700', color: COLORS.amber },
  prefLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.amber,
    letterSpacing: 0.5, marginTop: 4,
  },
  pillsRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prefPill: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 16, borderWidth: 1,
    backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border,
  },
  prefPillActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  prefPillText:       { fontSize: 13, fontWeight: '600', color: COLORS.amber },
  prefPillTextActive: { color: COLORS.primaryText },
  timePickerRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeArrow:          { color: COLORS.textMuted, fontSize: 16, fontWeight: '300' },
  timePill: {
    flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 10, gap: 3,
  },
  timePillLabel:   { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5 },
  timePillInner:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timePillValue:   { fontSize: 14, fontWeight: '700', color: COLORS.amber },
  timeValidationHint: { fontSize: 11, color: COLORS.error, marginTop: 2 },

  // Time picker modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  modalCard: {
    backgroundColor: COLORS.surface, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.border,
    width: 240, overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 11, fontWeight: '700', color: COLORS.amber, letterSpacing: 1,
    textAlign: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    textTransform: 'capitalize',
  },
  modalOption:           { paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceAlt },
  modalOptionActive:     { backgroundColor: COLORS.surfaceAlt },
  modalOptionText:       { fontSize: 15, fontWeight: '500', color: COLORS.textMuted, textAlign: 'center' },
  modalOptionTextActive: { color: COLORS.amber, fontWeight: '700' },

  // Error block
  errorBlock: { alignItems: 'center', gap: 12, marginTop: 4 },
  errorText: {
    color: COLORS.error, fontSize: 14, textAlign: 'center',
    backgroundColor: COLORS.error + '12', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16,
    borderWidth: 1, borderColor: COLORS.error + '33',
    lineHeight: 20,
  },

  // Generate button
  loadingRow:      { flexDirection: 'row', alignItems: 'center' },
  generateBtn: {
    borderRadius: 18, height: 58,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 18, elevation: 14,
  },
  generateBtnDisabled: { opacity: 0.45 },
  generateBtnText: {
    color: COLORS.primaryText, fontSize: 17, fontWeight: '700',
  },
  generateSubtext: { textAlign: 'center', fontSize: 12, color: COLORS.textMuted, marginTop: 10 },
  remainingText:   { textAlign: 'center', fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  retryBtn: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 16, paddingHorizontal: 24, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  retryBtnText: { color: COLORS.amber, fontSize: 14, fontWeight: '700' },

  // Itinerary
  fallbackBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 16, borderRadius: 12,
    backgroundColor: COLORS.warning + '12', borderWidth: 1, borderColor: COLORS.warning + '44',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  fallbackBannerTxt: { fontSize: 13, color: COLORS.warning, lineHeight: 18, flex: 1 },
  itineraryContainer: { gap: 0 },
  itineraryMeta: {
    alignItems: 'center', marginBottom: 28,
    paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  itineraryDay: {
    fontSize: 28, color: COLORS.textPrimary,
    fontFamily: 'PlayfairDisplay_800ExtraBold',
  },
  itineraryDate: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  itineraryCity: { fontSize: 13, color: COLORS.amber, marginTop: 3 },
  metaChips:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  metaChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  metaChipTime:     { borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt },
  metaChipText:     { color: COLORS.amber, fontSize: 11, fontWeight: '600' },
  metaChipTimeText: { color: COLORS.textSecondary },

  // Stop card + timeline
  stopRow:     { flexDirection: 'row', marginBottom: 14 },
  timelineCol: { width: 28, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 18, zIndex: 1 },
  timelineLine:{ flex: 1, width: 2, marginTop: 2 },
  stopCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3,
    padding: 16, gap: 7, overflow: 'hidden',
  },
  stopCardSwapping: { opacity: 0.6 },
  stopHeaderRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  timeChip:         { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  timeText:         { fontSize: 12, fontWeight: '700' },
  durationText:     { fontSize: 11, color: COLORS.textMuted },
  catChip:          { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  catEmoji:         { fontSize: 12 },
  catLabel:         { fontSize: 11, fontWeight: '600' },
  stopName:         { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, fontFamily: 'PlayfairDisplay_700Bold' },
  stopAddress:      { fontSize: 12, color: COLORS.textMuted, lineHeight: 17 },

  // Distance pill
  distancePill: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1, borderColor: COLORS.border,
  },
  distancePillTxt: { fontSize: 12, color: COLORS.amber, fontWeight: '600' },

  // Admission badge
  admissionBadge: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: COLORS.amberFaint,
    borderWidth: 1, borderColor: COLORS.amber + '44',
  },
  admissionBadgeTxt: { fontSize: 12, color: COLORS.amber, fontWeight: '600' },

  // Price tier pill
  pricePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: COLORS.amberFaint,
    borderWidth: 1, borderColor: COLORS.amber + '44',
  },
  pricePillTxt: { fontSize: 12, color: COLORS.amber, fontWeight: '700' },

  // Reason row
  reasonRow: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    borderLeftWidth: 2, borderLeftColor: COLORS.amber + '66',
  },
  stopReason: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, fontStyle: 'italic' },

  // Local knowledge callout
  localKnowledgeBadge: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 10, padding: 10, marginTop: 2,
    borderLeftWidth: 3,
  },
  lkWarning: { backgroundColor: COLORS.warning + '12', borderLeftColor: COLORS.warning },
  lkInfo:    { backgroundColor: COLORS.amber + '10', borderLeftColor: COLORS.amber },
  lkTip:     { backgroundColor: COLORS.primary + '10', borderLeftColor: COLORS.primary },
  lkIcon:    { fontSize: 13, lineHeight: 18 },
  lkText:    { flex: 1, fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },

  // Allergy alert
  allergyBadge: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: COLORS.error + '12', borderRadius: 10, padding: 10,
    borderLeftWidth: 3, borderLeftColor: COLORS.error, marginTop: 2,
  },
  allergyText: { flex: 1, fontSize: 12, color: COLORS.error, lineHeight: 17 },

  cardActionsRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  exciteBadge:      { backgroundColor: COLORS.amber + '22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.amber + '44' },
  exciteText:       { color: COLORS.amber, fontSize: 10, fontWeight: '700' },
  swapBtn:          { paddingVertical: 4, paddingHorizontal: 6 },
  swapBtnText:      { color: COLORS.textMuted, fontSize: 12, fontWeight: '500' },
  swapLoadingRow:   { flexDirection: 'row', alignItems: 'center' },
  thumbsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  thumbBtn:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  thumbBtnUp:   { backgroundColor: COLORS.success + '22' },
  thumbBtnDown: { backgroundColor: COLORS.error + '22' },
  thumbTxt:     { fontSize: 15 },
  thumbDivider: { width: 1, height: 18, backgroundColor: COLORS.border, marginHorizontal: 6 },

  resetBtn: {
    marginTop: 12, borderRadius: 16, height: 52,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  resetBtnText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },

  // Sticky footer
  stickyNavContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: 28, paddingTop: 14,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  stickyNavBtn: {
    borderRadius: 18, height: 58,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: COLORS.amber, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 12,
  },
  stickyNavTxt: { color: COLORS.bg, fontSize: 17, fontWeight: '700' },

  // Week / Date picker
  weekPickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  weekPickerCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: COLORS.border,
    paddingBottom: 34, overflow: 'hidden',
  },
  weekPickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  weekPickerTitle: {
    fontSize: 16, fontWeight: '700', color: COLORS.textPrimary,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  weekPickerClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: COLORS.surfaceAlt,
  },
  dayRowLast:    { borderBottomWidth: 0 },
  dayLabel:      { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  dayLabelToday: { color: COLORS.amber },
  daySub:        { fontSize: 13, color: COLORS.textMuted },

  // Feedback modal
  fbOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  fbCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: COLORS.border,
    paddingBottom: 34, overflow: 'hidden',
  },
  fbHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 2,
  },
  fbTitle: {
    fontSize: 16, fontWeight: '700', color: COLORS.textPrimary,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center', paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  fbPlace:     { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, paddingHorizontal: 24, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceAlt },
  fbOption:    { paddingHorizontal: 24, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceAlt },
  fbOptionTxt: { fontSize: 15, fontWeight: '500', color: COLORS.textSecondary },
  fbCancel: {
    marginHorizontal: 20, marginTop: 16,
    borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  fbCancelTxt: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },

  // Tap hint
  tapHint:    { alignItems: 'center', paddingTop: 6, paddingBottom: 2 },
  tapHintTxt: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },

  // Place detail modal
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  detailSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 2,
  },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  detailCatPill:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  detailCatPillTxt: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  detailCloseBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  detailScroll:     { paddingHorizontal: 20, paddingTop: 18 },
  detailName:       {
    fontSize: 22, color: COLORS.textPrimary,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginBottom: 4,
  },
  detailAddr:       { fontSize: 13, color: COLORS.textMuted, marginBottom: 14, lineHeight: 18 },

  detailInfoRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 18 },
  detailInfoTxt:  { fontSize: 13, fontWeight: '600', color: COLORS.amber },
  detailInfoDot:  { fontSize: 13, color: COLORS.textMuted },

  admissionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.amberFaint, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.amber + '33',
  },
  admissionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.amber, letterSpacing: 0.5 },
  admissionValue: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500', flex: 1 },

  detailSection:      { marginBottom: 18 },
  detailSectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.amber,
    letterSpacing: 1.2, marginBottom: 10, textTransform: 'uppercase',
  },
  detailReasonText:   { fontSize: 15, color: COLORS.textPrimary, lineHeight: 23, fontStyle: 'italic' },

  highlightRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: COLORS.surfaceAlt, borderRadius: 8, padding: 10,
    borderLeftWidth: 3, marginBottom: 6,
  },
  highlightIcon: { fontSize: 16, lineHeight: 20 },
  highlightText: { flex: 1, fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },

  detailStatsRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  distanceLink:    { flexDirection: 'row', alignItems: 'center' },
  distanceLinkTxt: { fontSize: 13, color: COLORS.amber, fontWeight: '600' },
  detailExciteBadge: { backgroundColor: COLORS.amber + '22', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.amber + '44' },
  detailExciteTxt:   { color: COLORS.amber, fontSize: 12, fontWeight: '700' },

  detailNavBtn: {
    backgroundColor: COLORS.primary, borderRadius: 16,
    height: 56, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 10,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  detailNavBtnTxt: { color: COLORS.primaryText, fontSize: 16, fontWeight: '700' },

  detailSecondaryBtns: { flexDirection: 'row', gap: 10 },
  detailSecBtn: {
    flex: 1, height: 48, borderRadius: 14, flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  detailSecBtnTxt: { fontSize: 14, fontWeight: '600', color: COLORS.amber },

  detailSourceBadge: { backgroundColor: COLORS.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 14, alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.border },
  detailSourceTxt:   { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },

  // Price legend modal
  legendCard: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border,
    width: 280, padding: 22,
  },
  legendTitle: {
    fontSize: 15, fontWeight: '700', color: COLORS.textPrimary,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center', marginBottom: 16,
  },
  legendRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  legendSymbol:{ fontSize: 15, fontWeight: '700', color: COLORS.amber, width: 40 },
  legendLabel: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
  legendSub:   { fontSize: 11, color: COLORS.textMuted, marginTop: 14, lineHeight: 15, textAlign: 'center' },
});
