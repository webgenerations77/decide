import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ActivityIndicator, Animated, Linking, StyleSheet, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FONTS, RADII } from '../../constants/theme';
import { categoryVisual } from '../../constants/categoryVisuals';
import useViewportOverlay, { WEB_OVERLAY_FIX } from '../../hooks/useViewportOverlay';
import { useTheme } from '../../context/ThemeContext';
import { getLocalKnowledge, getAllergyAlerts } from '../../constants/localKnowledge';
import { hapticTap } from '../../services/hapticsService';
import { placePhotoUrl } from '../../services/placesService';
import LegOptionsSheet from './LegOptionsSheet';

const FEEDBACK_REASONS = ['Closed', 'Too crowded', 'Not my style', 'Too far', 'Too expensive', 'Other'];

// Defensive host derivation for the ✓ Verified chip's source-link suffix.
// Never throws — falls back to null so the chip can render "Verified" alone.
function verifiedHost(url) {
  try {
    const host = new URL(url).hostname;
    return host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// ─── FeedbackModal ────────────────────────────────────────────────────────────
function FeedbackModal({ visible, placeName, onClose, onSelect }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const overlayRef = useViewportOverlay(visible);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View ref={overlayRef} style={styles.fbOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
          <View style={styles.fbCard}>
            <View style={styles.fbHandle} />
            <Text style={styles.fbTitle}>Why swap this one?</Text>
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
      </View>
    </Modal>
  );
}

// ─── VerifiedChip ─────────────────────────────────────────────────────────────
// Trust receipt for a stop whose event time was confirmed against a source page
// (Tasks 1–3). Tappable when a source URL exists; opens it in the browser.
function VerifiedChip({ stop, styles, colors }) {
  if (!stop.verify_source) {
    // verified=true but no source URL somehow — show a non-tappable receipt, don't crash.
    return (
      <View style={styles.verifiedChip}>
        <Ionicons name="checkmark-circle" size={12} color={colors.success} />
        <Text style={styles.verifiedChipTxt}>Verified</Text>
      </View>
    );
  }
  const host = verifiedHost(stop.verify_source);
  return (
    <TouchableOpacity
      style={styles.verifiedChip}
      onPress={() => Linking.openURL(stop.verify_source).catch(() => {})}
      activeOpacity={0.7}
    >
      <Ionicons name="checkmark-circle" size={12} color={colors.success} />
      <Text style={styles.verifiedChipTxt}>Verified</Text>
      {host ? <Text style={styles.verifiedHostTxt}> · {host}</Text> : null}
    </TouchableOpacity>
  );
}

// ─── StopCard ─────────────────────────────────────────────────────────────────
function StopCard({ stop, index = 0, isLast, onSwap, isSwapping, onViewDetails, weather, planDate, sensitivities, leg = null }) {
  const [feedback,          setFeedback]          = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showLegOptions,    setShowLegOptions]    = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Only the colour is used now — the category chip is gone, since the left border and the
  // timeline dot already carry the category twice. The icon still drives the detail modal.
  const { color } = categoryVisual(stop.category);

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

  // lat/lng are required — without them local knowledge is geographically ungated and leaks
  // regional advice into other states. A coordless stop correctly gets no local tips.
  const localTips    = getLocalKnowledge({ stopName: stop.name, stopAddress: stop.address ?? '', category: stop.category, weather, date: planDate, lat: stop.lat, lng: stop.lng });
  const allergyAlerts = getAllergyAlerts({ category: stop.category, stopName: stop.name, stopAddress: stop.address ?? '', sensitivities });

  // The card shows exactly one caveat. Priority is a safety ordering, not a stylistic one:
  // an allergy alert outranks everything because a missed one has consequences a detour note
  // does not. Below that, a detour costs real time on the road, and a warning-severity local
  // tip is a genuine heads-up. Info/tip-severity local knowledge is interesting but not
  // urgent, so it stays in the detail modal rather than competing here.
  const caveat = useMemo(() => {
    if (allergyAlerts.length) {
      const a = allergyAlerts[0];
      return { tone: 'alert', icon: 'warning-outline', text: `${a.sensitivity}: ${a.text}` };
    }
    if (stop.detour && stop.detour_note) {
      return { tone: 'warm', icon: 'git-branch-outline', text: stop.detour_note };
    }
    const warn = localTips.find((t) => t.severity === 'warning');
    if (warn) return { tone: 'warm', icon: 'alert-circle-outline', text: warn.text };
    return null;
  }, [allergyAlerts, localTips, stop.detour, stop.detour_note]);

  return (
    <>
      {/* How you get TO this stop. Rendered ABOVE the card in the timeline gutter rather
          than inside it — this card already carries fourteen conditional badges, and another
          row in the body walks straight into the badge-wall anti-reference.

          TWO VOLUMES, ONE TAP TARGET:
          · chip (loud, cobalt pill) — only when the leg disagrees with the day's verdict
            (isNotableLeg), so a driving day doesn't repeat "drive 12 min" five times.
          · hint (quiet, muted text) — every other leg. This exists because gating the tap on
            "is it news?" also gated the leg-alternatives sheet, the ONLY home of subway detail
            and rideshare: a real Brooklyn transit day rendered 1 tappable leg out of 6, so
            "could I take the subway instead?" was unanswerable on the other five. The quiet
            row stays type-only — no pill, no fill, no border — so it reads as connector rather
            than badge, and it fills a gutter the reshaped card left empty. */}
      {leg?.chip || leg?.hint ? (
        <View style={styles.legChipRow}>
          <TouchableOpacity
            style={leg.chip ? styles.legChip : styles.legHint}
            activeOpacity={0.7}
            onPress={() => { hapticTap(); setShowLegOptions(true); }}
            accessibilityRole="button"
            accessibilityLabel={`${leg.chip ?? leg.hint}. Other ways to cover this stretch.`}
          >
            <Ionicons
              name={leg.mode === 'walk' ? 'walk-outline' : leg.mode === 'bike' ? 'bicycle-outline' : 'car-outline'}
              size={11}
              color={leg.chip ? colors.primary : colors.textMuted}
            />
            <Text style={leg.chip ? styles.legChipTxt : styles.legHintTxt}>{leg.chip ?? leg.hint}</Text>
            <Ionicons name="chevron-forward" size={10} color={leg.chip ? colors.primary : colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : null}

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
          {stop.photo ? (
            <View style={styles.photoHeader}>
              <Image source={{ uri: placePhotoUrl(stop.photo, 800) }} style={styles.photoImg} resizeMode="cover" />
              <LinearGradient colors={['transparent', colors.surface]} style={styles.photoGradient} pointerEvents="none" />
            </View>
          ) : null}
          {/* THE TICKET LINE. Time, name, why — and nothing that competes with them.
              Category is carried by the left border and the timeline dot, which already say
              it twice; a third chip spelling it out was noise. Address, distance, admission,
              parking, live music, price, contacts and provenance all live in the detail
              modal, which previously duplicated the card and so bought the traveller nothing
              on tap. Mono per the Mono Is Structural rule — times should read as a timetable. */}
          <View style={styles.ticketLine}>
            <Text style={[styles.timeText, { color }]}>{stop.time}</Text>
            <Text style={styles.durationText}>{stop.duration_mins} min</Text>
            <View style={{ flex: 1 }} />
            {/* Trust in the time claim belongs ON the time, not three rows below it.
                Verified wins over any hedge; the server already suppresses time_note on
                verified stops, and this ordering is belt-and-suspenders. */}
            {stop.verified ? (
              <VerifiedChip stop={stop} styles={styles} colors={colors} />
            ) : (stop.time_note || stop.unverified) ? (
              <Text style={styles.timeHedge} numberOfLines={1}>worth confirming</Text>
            ) : null}
          </View>

          <Text style={styles.stopName} numberOfLines={2}>{stop.name}</Text>

          {/* Promoted from a boxed 13px italic aside to the loudest prose on the card.
              "Every recommendation carries its reason" is a stated product principle — it
              should read like a sentence from a friend, not a system callout. */}
          {stop.reason ? (
            <Text style={styles.stopReason} numberOfLines={3}>{stop.reason}</Text>
          ) : null}

          {/* ONE caveat slot, strict priority: allergy > detour > warning-severity local tip.
              An allergy alert always wins and always shows — accommodation is core behaviour,
              and a shellfish warning behind a tap is a product failure, not a design choice.
              Anything displaced by priority is still in the detail modal. */}
          {caveat ? (
            <View style={[styles.caveat, caveat.tone === 'alert' ? styles.caveatAlert : styles.caveatWarm]}>
              <Ionicons
                name={caveat.icon}
                size={13}
                color={caveat.tone === 'alert' ? colors.error : colors.gold}
                style={{ marginTop: 1 }}
              />
              <Text style={[styles.caveatTxt, caveat.tone === 'alert' && styles.caveatTxtAlert]}>
                {caveat.text}
              </Text>
            </View>
          ) : null}

          {/* Swap is the positioning-critical escape hatch, so it stays — as one quiet link
              rather than a footer of controls. The excitement badge, thumbs row and "Tap for
              details" hint are gone: an internal score wearing a costume, feedback furniture
              repeated eight times a plan, and eleven words explaining an affordance the
              press-scale animation already provides. */}
          {onSwap ? (
            <TouchableOpacity style={styles.swapBtn} onPress={() => { hapticTap(); setShowFeedbackModal(true); }} disabled={isSwapping} activeOpacity={0.7}>
              {isSwapping
                ? <View style={styles.swapLoadingRow}>
                    <ActivityIndicator size="small" color={colors.textMuted} style={{ marginRight: 5 }} />
                    <Text style={styles.swapBtnText}>Finding…</Text>
                  </View>
                : <Text style={styles.swapBtnText}>Try another →</Text>
              }
            </TouchableOpacity>
          ) : null}
        </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      <FeedbackModal
        visible={showFeedbackModal}
        placeName={stop.name}
        onClose={() => setShowFeedbackModal(false)}
        // Records the reason AND performs the swap. This is the only writer of
        // @decide/feedback_*, which app/(tabs)/plan.js reads to build dislikedPlaces /
        // dislikedReasons — the synthesis prompt's HARD AVOID list. When the thumbs row was
        // removed, wiring this to the swap kept that loop alive; dropping it outright would
        // have silently stopped the app learning what a traveller rejects.
        onSelect={(reason) => {
          saveFeedback('down', reason);
          setShowFeedbackModal(false);
          onSwap?.();
        }}
      />
      <LegOptionsSheet visible={showLegOptions} leg={leg} onClose={() => setShowLegOptions(false)} />
    </>
  );
}

export default StopCard;

const makeStyles = (c) => StyleSheet.create({
  // Leg chip — sits in the 28px timeline gutter above the card it describes.
  // Indented to align with the timeline rail rather than the card edge, so it reads as
  // part of the connector rather than as another badge belonging to the stop.
  legChipRow: { paddingLeft: 6, marginBottom: 6 },
  legChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: c.sky100,
    borderWidth: 1, borderColor: c.borderLight,
  },
  legChipTxt: { fontSize: 11, color: c.primary, fontFamily: FONTS.bodySemiBold },

  // The quiet volume. Same row, same tap target, none of the pill's weight — six of these down
  // a timeline must read as connective tissue, which is the whole reason the loud chip stays
  // rare enough to mean something. Vertical padding only, to keep the touch target honest.
  legHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 4, paddingRight: 4,
  },
  legHintTxt: { fontSize: 11, color: c.textMuted, fontFamily: FONTS.bodyMedium },

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

  // Place photo header (full-bleed across the padded card top)
  photoHeader:   { marginHorizontal: -16, marginTop: -16, marginBottom: 2, height: 150, backgroundColor: c.surfaceAlt },
  photoImg:      { width: '100%', height: '100%' },
  photoGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 104 },

  // The ticket line: time, duration, and the trust receipt on one row.
  ticketLine:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Space Mono — the Mono Is Structural rule exists so times read as a timetable.
  timeText:     { fontSize: 15, fontFamily: FONTS.monoBold, letterSpacing: 0.2 },
  durationText: { fontSize: 11, color: c.textMuted, fontFamily: FONTS.body },
  timeHedge:    { fontSize: 11, color: c.textMuted, fontFamily: FONTS.bodyMedium },

  stopName:     { fontSize: 18, color: c.textPrimary, fontFamily: FONTS.display, lineHeight: 23 },

  // Distance pill

  // Gold, not error red — an out-of-the-way stop is a tradeoff worth flagging, not a fault.
  // goldText carries the AA-passing warm text value; gold itself is too light on paper.

  // Admission badge

  // Honest hedging chip (time_note / unverified) — muted, non-alarming

  // Verified chip (confirmed event time, tappable → source URL) — success-tinted trust receipt
  verifiedChip: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: c.success + '18', borderWidth: 1, borderColor: c.success + '40',
    gap: 4,
  },
  verifiedChipTxt: { fontSize: 12, color: c.success, fontFamily: FONTS.bodySemiBold },
  verifiedHostTxt: { flexShrink: 1, fontSize: 12, color: c.textSecondary, fontFamily: FONTS.bodyMedium },

  // Splurge chip (above-budget pick) — cobalt-led, tasteful

  // Price tier pill

  // Contact links (website / call)

  // The reason — plain prose, not a boxed aside. It is the product's differentiator, so it
  // gets body size and the secondary text ramp rather than a container that frames it as
  // supplementary. No italic: a whole paragraph of italic reads as a system note.
  stopReason: { fontSize: 15, color: c.textSecondary, lineHeight: 21, fontFamily: FONTS.body },

  // The single caveat slot. Two tones only: alert (allergy — the one with consequences) and
  // warm (detour, warning tip — real tradeoffs, not faults). goldText/error carry the copy
  // because gold and the raw tint values are too light for text on paper.
  caveat: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: RADII.sm, marginTop: 2,
  },
  caveatWarm:     { backgroundColor: c.gold + '22' },
  caveatAlert:    { backgroundColor: c.error + '14', borderLeftWidth: 3, borderLeftColor: c.error },
  caveatTxt:      { flex: 1, fontSize: 12, lineHeight: 17, color: c.goldText, fontFamily: FONTS.body },
  caveatTxtAlert: { color: c.error },

  // Local knowledge callout

  // Allergy alert

  swapBtn:          { paddingVertical: 4, paddingHorizontal: 6 },
  swapBtnText:      { color: c.textMuted, fontSize: 12, fontFamily: FONTS.bodyMedium },
  swapLoadingRow:   { flexDirection: 'row', alignItems: 'center' },

  // Tap hint

  // Feedback modal
  fbOverlay: { ...WEB_OVERLAY_FIX, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
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
