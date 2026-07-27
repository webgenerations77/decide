import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ActivityIndicator, Linking, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, RADII } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import useViewportOverlay, { WEB_OVERLAY_FIX } from '../../hooks/useViewportOverlay';
import { getLegAlternatives } from '../../services/itineraryService';
import { rideshareLink } from '../../lib/transport/local';

// The escape hatch behind a leg chip: "I know what you picked — what else could I do here?"
//
// This is where alternatives are allowed to fan out, and ONLY here. The itinerary itself
// commits to one answer; a traveller who wants to second-guess a single hop gets a comparison
// on request rather than having one imposed on every leg of every plan. Costs three billable
// elements, and only when someone actually asks.
//
// Follows the project's mobile-web modal rules: useViewportOverlay + WEB_OVERLAY_FIX and
// animationType="fade" — "slide" traps position:fixed and the sheet drifts on mobile web.

const MODE_META = {
  walk:  { icon: 'walk-outline',    label: 'Walk' },
  bike:  { icon: 'bicycle-outline', label: 'Bike' },
  drive: { icon: 'car-outline',     label: 'Drive' },
};

export default function LegOptionsSheet({ visible, leg, onClose }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const overlayRef = useViewportOverlay(visible);

  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);

  useEffect(() => {
    if (!visible || !leg?.fromCoord || !leg?.toCoord) return;
    let alive = true;
    setLoading(true);
    setOptions([]);
    getLegAlternatives({ from: leg.fromCoord, to: leg.toCoord })
      .then((r) => { if (alive) setOptions(Array.isArray(r?.options) ? r.options : []); })
      .catch(() => { if (alive) setOptions([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [visible, leg?.fromCoord, leg?.toCoord]);

  if (!leg) return null;

  const uber = rideshareLink({ ...(leg.toCoord ?? {}), name: leg.to });
  const heading = leg.from && leg.to ? `${leg.from} → ${leg.to}` : 'This stretch';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View ref={overlayRef} style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.handle} />
          <Text style={styles.title}>Other ways to do this</Text>
          <Text style={styles.sub} numberOfLines={2}>{heading}</Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : options.length ? (
            options.map((opt) => {
              const meta = MODE_META[opt.mode] ?? { icon: 'navigate-outline', label: opt.mode };
              const isCurrent = opt.mode === leg.mode;
              return (
                <View key={opt.mode} style={styles.row}>
                  <Ionicons name={meta.icon} size={17} color={isCurrent ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.rowLabel, isCurrent && styles.rowLabelCurrent]}>
                    {meta.label}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {opt.mins} min{opt.miles != null ? ` · ${opt.miles} mi` : ''}
                  </Text>
                  {/* Marks what the plan already assumes, so the sheet reads as "here is the
                      rest of the picture" rather than as an undecided menu. */}
                  {isCurrent ? <Text style={styles.currentTag}>picked</Text> : null}
                </View>
              );
            })
          ) : (
            <Text style={styles.empty}>Couldn’t work out the options for this stretch.</Text>
          )}

          {/* No ETA, no price, no "cars nearby" — Uber and Lyft both retired the public APIs
              that could tell us any of that, so we open the app and claim nothing. */}
          {uber ? (
            <TouchableOpacity
              style={styles.rideBtn}
              activeOpacity={0.7}
              onPress={() => Linking.openURL(uber).catch(() => {})}
            >
              <Ionicons name="car-sport-outline" size={15} color={colors.primary} />
              <Text style={styles.rideBtnTxt}>Open a rideshare app</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeTxt}>Close</Text>
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
    paddingHorizontal: 20, paddingBottom: 34, overflow: 'hidden',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: c.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 10,
  },
  title: { fontSize: 17, color: c.textPrimary, fontFamily: FONTS.display, textAlign: 'center' },
  sub: {
    fontSize: 12, color: c.textMuted, fontFamily: FONTS.body,
    textAlign: 'center', marginTop: 3, marginBottom: 14,
  },

  loadingWrap: { paddingVertical: 26, alignItems: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: c.surfaceAlt,
  },
  rowLabel:        { flex: 1, fontSize: 15, color: c.textSecondary, fontFamily: FONTS.bodyMedium },
  rowLabelCurrent: { color: c.textPrimary, fontFamily: FONTS.bodySemiBold },
  // Space Mono for the duration — a time, so it follows the Mono Is Structural rule.
  rowMeta:    { fontSize: 12, color: c.textMuted, fontFamily: FONTS.mono },
  currentTag: {
    fontSize: 10, color: c.primary, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 0.4, textTransform: 'uppercase',
  },

  empty: {
    fontSize: 13, color: c.textMuted, fontFamily: FONTS.body,
    textAlign: 'center', paddingVertical: 22, lineHeight: 18,
  },

  rideBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginTop: 14, paddingVertical: 12,
    borderRadius: RADII.md, borderWidth: 1, borderColor: c.borderLight,
    backgroundColor: c.sky100,
  },
  rideBtnTxt: { fontSize: 13, color: c.primary, fontFamily: FONTS.bodySemiBold },

  close: {
    marginTop: 12, borderRadius: 16, height: 52,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
  },
  closeTxt: { color: c.textMuted, fontSize: 14, fontFamily: FONTS.bodySemiBold },
});
