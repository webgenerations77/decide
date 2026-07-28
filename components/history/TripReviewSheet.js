import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, Linking, Platform, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, RADII } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import useViewportOverlay, { WEB_OVERLAY_FIX } from '../../hooks/useViewportOverlay';
import { hapticTap, hapticSuccess } from '../../services/hapticsService';
import { savePlaceFeedback } from '../../services/placeFeedback';
import { pendingReviewReward, grantReviewReward } from '../../services/reviewRewards';
import { googleReviewUrl } from '../../lib/tripReview';

// "How was it?" — the only moment the app asks about a day that has actually happened.
//
// WHY PER-STOP: whole-day thumbs already existed on the history screen and produce one reason
// for a whole day. The avoid list is keyed on PLACES, so a named stop plus a reason is worth far
// more — it is the difference between "that day was meh" and "don't send me back to that bar".
// Everything here is optional; the day-level answer alone is a complete review.
//
// ⚠ NEVER GATE THE GOOGLE LINK ON SENTIMENT. Offering it only to happy travellers is review
// gating and breaches Google's policy outright. It is shown for every stop that has a real
// place_id, whatever they thought — see lib/tripReview.js.

const QUICK = [
  { key: 'up', icon: 'thumbs-up-outline', label: 'Liked it' },
  { key: 'down', icon: 'thumbs-down-outline', label: 'Not for me' },
];

export default function TripReviewSheet({ visible, trip, onClose, onSubmitted }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const overlayRef = useViewportOverlay(visible);

  const [dayVerdict, setDayVerdict] = useState(null);
  const [stopVerdicts, setStopVerdicts] = useState({});
  const [reward, setReward] = useState(0);
  const [saving, setSaving] = useState(false);

  // Ask what a review is worth BEFORE offering it, so the sheet never promises a decision the
  // daily cap will refuse.
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setDayVerdict(null);
    setStopVerdicts({});
    pendingReviewReward().then((r) => { if (alive) setReward(r); }).catch(() => {});
    return () => { alive = false; };
  }, [visible, trip?.id]);

  if (!trip) return null;

  const stops = Array.isArray(trip.itinerary) && trip.itinerary.length
    ? trip.itinerary
    : (trip.stops ?? []);

  const openGoogle = (placeId) => {
    const url = googleReviewUrl(placeId);
    if (!url) return;
    hapticTap();
    // New tab, same reason as the house ad: never navigate the PWA away from work in progress.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(url).catch(() => {});
  };

  const submit = async () => {
    if (!dayVerdict || saving) return;
    setSaving(true);
    try {
      // Per-stop reactions go to the same store the swap flow writes, so they reach the HARD
      // AVOID list through lib/feedbackContext.js like any other rejection.
      await Promise.all(
        stops
          .filter((s) => s?.place_id && stopVerdicts[s.place_id])
          .map((s) => savePlaceFeedback({
            placeId: s.place_id,
            placeName: s.name,
            feedback: stopVerdicts[s.place_id],
            reason: null,
          })),
      );
      const granted = await grantReviewReward();
      hapticSuccess();
      onSubmitted?.({ verdict: dayVerdict, granted });
    } finally {
      setSaving(false);
    }
  };

  const setStop = (placeId, key) => {
    hapticTap();
    setStopVerdicts((prev) => ({ ...prev, [placeId]: prev[placeId] === key ? null : key }));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View ref={overlayRef} style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.handle} />
          <Text style={styles.title}>How was it?</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {trip.meta?.city ? `${trip.meta.city} · ` : ''}{trip.meta?.date ?? ''}
          </Text>

          {/* The whole review can be one tap. Everything below is optional. */}
          <View style={styles.dayRow}>
            {QUICK.map((q) => {
              const on = dayVerdict === q.key;
              return (
                <TouchableOpacity
                  key={q.key}
                  style={[styles.dayBtn, on && styles.dayBtnOn]}
                  onPress={() => { hapticTap(); setDayVerdict(q.key); }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`The day overall: ${q.label}`}
                >
                  <Ionicons name={q.icon} size={17} color={on ? colors.primaryText : colors.textSecondary} />
                  <Text style={[styles.dayBtnTxt, on && styles.dayBtnTxtOn]}>{q.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {stops.length ? (
            <>
              <Text style={styles.eyebrow}>Any stops worth calling out?</Text>
              <ScrollView style={styles.stopList} keyboardShouldPersistTaps="handled">
                {stops.map((s, i) => {
                  const pid = s?.place_id;
                  const gUrl = googleReviewUrl(pid);
                  return (
                    <View key={pid ?? `s${i}`} style={styles.stopRow}>
                      <Text style={styles.stopName} numberOfLines={1}>{s?.name ?? 'Stop'}</Text>
                      <View style={styles.stopBtns}>
                        {QUICK.map((q) => {
                          const on = pid && stopVerdicts[pid] === q.key;
                          return (
                            <TouchableOpacity
                              key={q.key}
                              style={[styles.stopBtn, on && (q.key === 'up' ? styles.stopBtnUp : styles.stopBtnDown)]}
                              onPress={() => pid && setStop(pid, q.key)}
                              disabled={!pid}
                              activeOpacity={0.7}
                              accessibilityRole="button"
                              accessibilityState={{ selected: !!on }}
                              accessibilityLabel={`${s?.name ?? 'Stop'}: ${q.label}`}
                            >
                              <Ionicons
                                name={q.icon}
                                size={14}
                                color={on ? colors.primaryText : colors.textMuted}
                              />
                            </TouchableOpacity>
                          );
                        })}
                        {/* Offered regardless of what they picked — see the gating note above. */}
                        {gUrl ? (
                          <TouchableOpacity
                            style={styles.googleBtn}
                            onPress={() => openGoogle(pid)}
                            activeOpacity={0.7}
                            accessibilityRole="link"
                            accessibilityLabel={`Review ${s?.name ?? 'this stop'} on Google. Opens in a new tab.`}
                          >
                            <Ionicons name="open-outline" size={13} color={colors.primary} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              <Text style={styles.googleNote}>
                The ↗ opens Google’s own review box for that place — you write it, it stays yours.
              </Text>
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.submit, !dayVerdict && styles.submitOff]}
            onPress={submit}
            disabled={!dayVerdict || saving}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save this review"
          >
            <Text style={styles.submitTxt}>
              {saving ? 'Saving…' : reward > 0 ? `Save review · +${reward} decision today` : 'Save review'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeTxt}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c) => StyleSheet.create({
  overlay: { ...WEB_OVERLAY_FIX, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: c.border,
    paddingHorizontal: 20, paddingBottom: 30, overflow: 'hidden',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: c.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 10,
  },
  title: { fontSize: 18, color: c.textPrimary, fontFamily: FONTS.display, textAlign: 'center' },
  sub: {
    fontSize: 12, color: c.textMuted, fontFamily: FONTS.body,
    textAlign: 'center', marginTop: 3, marginBottom: 14,
  },

  dayRow: { flexDirection: 'row', gap: 10 },
  dayBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 12, borderRadius: RADII.md,
    backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
  },
  dayBtnOn: { backgroundColor: c.primary, borderColor: c.primary },
  dayBtnTxt: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: c.textSecondary },
  dayBtnTxtOn: { color: c.primaryText },

  eyebrow: {
    fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 1.5,
    color: c.textMuted, textTransform: 'uppercase', marginTop: 18, marginBottom: 6,
  },
  stopList: { maxHeight: 240 },
  stopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.surfaceAlt,
  },
  stopName: { flex: 1, fontFamily: FONTS.body, fontSize: 13, color: c.textPrimary },
  stopBtns: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stopBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
  },
  stopBtnUp: { backgroundColor: c.success, borderColor: c.success },
  stopBtnDown: { backgroundColor: c.error, borderColor: c.error },
  googleBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.sky100, borderWidth: 1, borderColor: c.borderLight,
  },
  googleNote: {
    fontFamily: FONTS.body, fontSize: 11, lineHeight: 15, color: c.textMuted, marginTop: 8,
  },

  submit: {
    marginTop: 16, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary,
  },
  submitOff: { backgroundColor: c.border },
  submitTxt: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: c.primaryText },
  close: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  closeTxt: { color: c.textMuted, fontSize: 13, fontFamily: FONTS.bodySemiBold },
});
