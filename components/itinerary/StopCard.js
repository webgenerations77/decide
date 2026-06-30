import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ActivityIndicator, Animated, Linking, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, CATEGORY_COLORS, CATEGORY_EMOJIS, FONTS, RADII } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { getLocalKnowledge, getAllergyAlerts } from '../../constants/localKnowledge';
import { openMaps } from './helpers';
import PriceLegendModal from './PriceLegendModal';

const FEEDBACK_REASONS = ['Closed', 'Too crowded', 'Not my style', 'Too far', 'Too expensive', 'Other'];

// ─── FeedbackModal ────────────────────────────────────────────────────────────
function FeedbackModal({ visible, placeName, onClose, onSelect }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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

// ─── StopCard ─────────────────────────────────────────────────────────────────
function StopCard({ stop, index = 0, isLast, onSwap, isSwapping, onViewDetails, weather, planDate, sensitivities }) {
  const [feedback,          setFeedback]          = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showLegend,        setShowLegend]        = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const color = CATEGORY_COLORS[stop.category] ?? COLORS.amber;  // data-layer: brand-fixed category color
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
              <Ionicons name="location-outline" size={12} color={colors.primary} style={{ marginRight: 3 }} />
              <Text style={styles.distancePillTxt}>{stop.distance}</Text>
            </TouchableOpacity>
          ) : null}

          {stop.admission_cost && (
            <View style={styles.admissionBadge}>
              <Ionicons name="ticket-outline" size={12} color={colors.gold} style={{ marginRight: 4 }} />
              <Text style={styles.admissionBadgeTxt}>{stop.admission_cost}</Text>
            </View>
          )}

          {stop.live_music?.note ? (
            <View style={styles.liveMusicBadge}>
              <Ionicons name="musical-notes-outline" size={12} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.liveMusicTxt} numberOfLines={1}>{stop.live_music.note}</Text>
            </View>
          ) : null}

          {stop.provenance?.why ? (
            <View style={styles.provenanceBadge}>
              <Text style={styles.provenanceTxt} numberOfLines={1}>📰 Live find</Text>
            </View>
          ) : null}

          {isFood && stop.price_level ? (
            <TouchableOpacity onPress={() => setShowLegend(true)} activeOpacity={0.7} style={styles.pricePill}>
              <Text style={styles.pricePillTxt}>{['', '$', '$$', '$$$', '$$$$'][stop.price_level] ?? ''} ⓘ</Text>
            </TouchableOpacity>
          ) : null}

          {(stop.website || stop.phone) ? (
            <View style={styles.contactRow}>
              {stop.phone ? (
                <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${stop.phone}`)} activeOpacity={0.7}>
                  <Ionicons name="call-outline" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.contactBtnTxt}>Call</Text>
                </TouchableOpacity>
              ) : null}
              {stop.website ? (
                <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(stop.website)} activeOpacity={0.7}>
                  <Ionicons name="globe-outline" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.contactBtnTxt}>Website</Text>
                </TouchableOpacity>
              ) : null}
            </View>
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
              <Ionicons name="warning-outline" size={14} color={colors.error} style={{ marginRight: 6 }} />
              <Text style={styles.allergyText}>{alert.sensitivity}: {alert.text}</Text>
            </View>
          ))}

          <View style={styles.cardActionsRow}>
            {stop.excitement_score > 0
              ? <View style={styles.exciteBadge}><Text style={styles.exciteText}>⚡ {stop.excitement_score}</Text></View>
              : <View />
            }
            {onSwap ? (
              <TouchableOpacity style={styles.swapBtn} onPress={onSwap} disabled={isSwapping} activeOpacity={0.7}>
                {isSwapping
                  ? <View style={styles.swapLoadingRow}>
                      <ActivityIndicator size="small" color={colors.textMuted} style={{ marginRight: 5 }} />
                      <Text style={styles.swapBtnText}>Finding…</Text>
                    </View>
                  : <Text style={styles.swapBtnText}>Try another →</Text>
                }
              </TouchableOpacity>
            ) : <View />}
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

export default StopCard;

const makeStyles = (c) => StyleSheet.create({
  // Stop card + timeline
  stopRow:     { flexDirection: 'row', marginBottom: 14 },
  timelineCol: { width: 28, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 18, zIndex: 1 },
  timelineLine:{ flex: 1, width: 2, marginTop: 2 },
  stopCard: {
    flex: 1, backgroundColor: c.surface, borderRadius: 18,
    borderWidth: 1, borderColor: c.border, borderLeftWidth: 3,
    padding: 16, gap: 7, overflow: 'hidden',
  },
  stopCardSwapping: { opacity: 0.6 },
  stopHeaderRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  timeChip:         { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  timeText:         { fontSize: 12, fontFamily: FONTS.bodyBold },
  durationText:     { fontSize: 11, color: c.textMuted, fontFamily: FONTS.body },
  catChip:          { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  catEmoji:         { fontSize: 12 },
  catLabel:         { fontSize: 11, fontFamily: FONTS.bodySemiBold },
  stopName:         { fontSize: 17, color: c.textPrimary, fontFamily: FONTS.display },
  stopAddress:      { fontSize: 12, color: c.textMuted, lineHeight: 17 },

  // Distance pill
  distancePill: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: c.surfaceAlt,
    borderWidth: 1, borderColor: c.border,
  },
  distancePillTxt: { fontSize: 12, color: c.primary, fontFamily: FONTS.bodySemiBold },

  // Admission badge
  admissionBadge: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: c.gold + '22',
    borderWidth: 1, borderColor: c.gold + '44',
  },
  admissionBadgeTxt: { fontSize: 12, color: c.goldText, fontFamily: FONTS.bodySemiBold },
  liveMusicBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADII.sm, backgroundColor: c.sky100 },
  liveMusicTxt:   { fontFamily: FONTS.bodyMedium, fontSize: 12, color: c.primary },
  provenanceBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADII.sm, backgroundColor: c.sky100 },
  provenanceTxt:   { fontFamily: FONTS.bodyMedium, fontSize: 12, color: c.primary },

  // Price tier pill
  pricePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: c.gold + '22',
    borderWidth: 1, borderColor: c.gold + '44',
  },
  pricePillTxt: { fontSize: 12, color: c.goldText, fontFamily: FONTS.bodyBold },

  // Contact links (website / call)
  contactRow:    { flexDirection: 'row', gap: 8, marginTop: 8 },
  contactBtn:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADII.sm, borderWidth: 1, borderColor: c.borderLight, backgroundColor: c.surface },
  contactBtnTxt: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: c.primary },

  // Reason row
  reasonRow: {
    backgroundColor: c.surfaceAlt, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    borderLeftWidth: 2, borderLeftColor: c.gold + '66',
  },
  stopReason: { fontSize: 13, color: c.textSecondary, lineHeight: 18, fontStyle: 'italic', fontFamily: FONTS.body },

  // Local knowledge callout
  localKnowledgeBadge: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 10, padding: 10, marginTop: 2,
    borderLeftWidth: 3,
  },
  lkWarning: { backgroundColor: c.warning + '12', borderLeftColor: c.warning },
  lkInfo:    { backgroundColor: c.amber + '10', borderLeftColor: c.amber },
  lkTip:     { backgroundColor: c.primary + '10', borderLeftColor: c.primary },
  lkIcon:    { fontSize: 13, lineHeight: 18 },
  lkText:    { flex: 1, fontSize: 12, color: c.textSecondary, lineHeight: 17, fontFamily: FONTS.body },

  // Allergy alert
  allergyBadge: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: c.error + '12', borderRadius: 10, padding: 10,
    borderLeftWidth: 3, borderLeftColor: c.error, marginTop: 2,
  },
  allergyText: { flex: 1, fontSize: 12, color: c.error, lineHeight: 17 },

  cardActionsRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  exciteBadge:      { backgroundColor: c.gold + '22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: c.gold + '44' },
  exciteText:       { color: c.goldText, fontSize: 10, fontFamily: FONTS.bodyBold },
  swapBtn:          { paddingVertical: 4, paddingHorizontal: 6 },
  swapBtnText:      { color: c.textMuted, fontSize: 12, fontFamily: FONTS.bodyMedium },
  swapLoadingRow:   { flexDirection: 'row', alignItems: 'center' },
  thumbsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  thumbBtn:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  thumbBtnUp:   { backgroundColor: c.success + '22' },
  thumbBtnDown: { backgroundColor: c.error + '22' },
  thumbTxt:     { fontSize: 15 },
  thumbDivider: { width: 1, height: 18, backgroundColor: c.border, marginHorizontal: 6 },

  // Tap hint
  tapHint:    { alignItems: 'center', paddingTop: 6, paddingBottom: 2 },
  tapHintTxt: { fontSize: 11, color: c.textMuted, fontFamily: FONTS.bodyMedium },

  // Feedback modal
  fbOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  fbCard: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: c.border,
    paddingBottom: 34, overflow: 'hidden',
  },
  fbHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: c.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 2,
  },
  fbTitle: {
    fontSize: 16, color: c.textPrimary,
    fontFamily: FONTS.display,
    textAlign: 'center', paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  fbPlace:     { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: c.textSecondary, paddingHorizontal: 24, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.surfaceAlt },
  fbOption:    { paddingHorizontal: 24, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: c.surfaceAlt },
  fbOptionTxt: { fontSize: 15, fontFamily: FONTS.bodyMedium, color: c.textSecondary },
  fbCancel: {
    marginHorizontal: 20, marginTop: 16,
    borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
  },
  fbCancelTxt: { color: c.textMuted, fontSize: 14, fontFamily: FONTS.bodySemiBold },
});
