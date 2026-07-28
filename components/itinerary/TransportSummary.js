import { useMemo } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, RADII } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

// The day's travel verdict — one stated call, not a comparison of options.
//
// Deliberately NOT a mode picker: four modes side by side with times and prices is the
// search-results grid this product exists to replace. Decide makes the call ("Drive it —
// 31 mi, nothing walkable between stops"), and the alternatives live behind a tap on an
// individual leg instead of fanning out here.
//
// Rendered inside RouteMap's body so the map and the verdict read as one "how the day
// moves" block rather than two competing cards.

const MODE_ICON = {
  walk:    'walk-outline',
  bike:    'bicycle-outline',
  transit: 'bus-outline',
  drive:   'car-outline',
};

export default function TransportSummary({ transport }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!transport?.verdict) return null;
  const { verdict, local = [], measured } = transport;

  return (
    <View style={styles.wrap}>
      <View style={styles.verdictRow}>
        <View style={styles.iconBadge}>
          <Ionicons name={MODE_ICON[verdict.mode] ?? 'navigate-outline'} size={16} color={colors.primary} />
        </View>
        <View style={styles.verdictText}>
          <Text style={styles.verdictLabel}>{verdict.label}</Text>
          <Text style={styles.verdictDetail}>{verdict.detail}</Text>
        </View>
      </View>

      {/* A carless traveller holding a plan with a leg they cannot cover needs to know now,
          not at stop three. Gold, not red — it's a tradeoff to resolve, not a fault. */}
      {verdict.reachWarning ? (
        <View style={styles.warnRow}>
          <Ionicons name="alert-circle-outline" size={13} color={colors.gold} style={{ marginTop: 1 }} />
          <Text style={styles.warnTxt}>{verdict.reachWarning}</Text>
        </View>
      ) : null}

      {/* Said once, at day level — never repeated under every stop. */}
      {verdict.transitNote ? (
        <Text style={styles.note}>{verdict.transitNote}</Text>
      ) : null}

      {/* Distances are straight-line unless a leg was measured against the road network.
          Saying so is cheaper than being quietly wrong about a walk across an inlet. */}
      {!measured ? (
        <Text style={styles.estimateNote}>Times are estimates from distance, not measured routes.</Text>
      ) : null}

      {local.length > 0 ? (
        <View style={styles.localBlock}>
          <Text style={styles.localHeading}>Locally, people also use</Text>
          {local.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={styles.localRow}
              activeOpacity={0.7}
              onPress={() => opt.url && Linking.openURL(opt.url).catch(() => {})}
              accessibilityRole="link"
              accessibilityLabel={`${opt.name} — opens schedule and details`}
            >
              <Text style={styles.localName}>{opt.name}</Text>
              <Text style={styles.localText}>{opt.text}</Text>
              <Text style={styles.localLink}>Check current schedule →</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap: { gap: 8, paddingTop: 4 },

  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBadge: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.sky100,
  },
  verdictText:   { flex: 1 },
  verdictLabel:  { fontFamily: FONTS.display, fontSize: 15, color: c.textPrimary },
  verdictDetail: { fontFamily: FONTS.body, fontSize: 12, color: c.textSecondary, marginTop: 1 },

  note:         { fontFamily: FONTS.body, fontSize: 12, color: c.textSecondary, lineHeight: 17 },

  // Gold tint, goldText for the copy — gold itself is too light to carry text on paper.
  // Matches StopCard's detourNote: an honest tradeoff, not an error state.
  warnRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: RADII.sm, backgroundColor: c.gold + '22',
  },
  warnTxt: { flex: 1, fontFamily: FONTS.body, fontSize: 12, lineHeight: 16, color: c.goldText },
  estimateNote: { fontFamily: FONTS.body, fontSize: 11, color: c.textMuted, lineHeight: 15 },

  localBlock: {
    marginTop: 2, paddingTop: 10, gap: 10,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  // Space Mono eyebrow — structural label, matching SectionLabel's role in the system.
  // monoBold (700), per DESIGN.md's Label spec; never set fontWeight alongside a baked family.
  localHeading: {
    fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1.6,
    color: c.textMuted, textTransform: 'uppercase',
  },
  localRow:  { gap: 2 },
  localName: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: c.textPrimary },
  localText: { fontFamily: FONTS.body, fontSize: 12, color: c.textSecondary, lineHeight: 17 },
  localLink: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: c.primary, marginTop: 2 },
});
