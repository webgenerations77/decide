import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../constants/theme';

export default function ItineraryMeta({ meta, stopCount, research, timeEditor = null }) {
  if (!meta) return null;
  return (
    <View style={styles.itineraryMeta}>
      <Text style={styles.itineraryDay}>{meta.day_of_week}</Text>
      <Text style={styles.itineraryDate}>{meta.date} · {stopCount} stops</Text>
      {meta.city ? <Text style={styles.itineraryCity}>📍 {meta.city}</Text> : null}
      {timeEditor}
      <View style={styles.metaChips}>
        {!timeEditor && meta.time_window && (
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
      {meta.cost_summary ? (
        <View style={styles.costSummaryRow}>
          <Ionicons name="wallet-outline" size={14} color={COLORS.primary} style={{ marginRight: 5 }} />
          <Text style={styles.costSummaryTxt}>{meta.cost_summary}</Text>
        </View>
      ) : null}
      {research?.hadLiveData && (
        <Text style={styles.liveDataNote}>✨ Cheddar checked what's happening this week</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  itineraryMeta: {
    alignItems: 'center', marginBottom: 28,
    paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  itineraryDay: {
    fontSize: 28, color: COLORS.textPrimary,
    fontFamily: FONTS.displayHeavy,
  },
  itineraryDate: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  itineraryCity: { fontSize: 13, color: COLORS.primary, marginTop: 3 },
  metaChips:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  metaChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  metaChipTime:     { borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt },
  metaChipText:     { color: COLORS.textSecondary, fontSize: 11, fontFamily: FONTS.bodySemiBold },
  metaChipTimeText: { color: COLORS.textSecondary },
  liveDataNote:     { color: COLORS.teal, fontSize: 11, fontStyle: 'italic', marginTop: 10, textAlign: 'center' },
  costSummaryRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  costSummaryTxt:   { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.primary },
});
