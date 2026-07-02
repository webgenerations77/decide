import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import DiscoveryAnchors from './DiscoveryAnchors';
import WeatherPill from './WeatherPill';

export default function ItineraryMeta({ meta, stopCount, research, timeEditor = null, weather = null }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!meta) return null;
  return (
    <View style={styles.itineraryMeta}>
      <Text style={styles.itineraryDay}>{meta.day_of_week}</Text>
      <Text style={styles.itineraryDate}>{meta.date} · {stopCount} stops</Text>
      {meta.city ? <Text style={styles.itineraryCity}>📍 {meta.city}</Text> : null}
      {weather ? <WeatherPill weather={weather} timeWindow="" /> : null}
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
          <Ionicons name="wallet-outline" size={14} color={colors.primary} style={{ marginRight: 5 }} />
          <Text style={styles.costSummaryTxt}>{meta.cost_summary}</Text>
        </View>
      ) : null}
      <DiscoveryAnchors research={research} />
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  itineraryMeta: {
    alignItems: 'center', marginBottom: 16,
    paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  itineraryDay: {
    fontSize: 22, color: c.textPrimary,
    fontFamily: FONTS.displayHeavy,
  },
  itineraryDate: { fontSize: 13, color: c.textMuted, marginTop: 3 },
  itineraryCity: { fontSize: 13, color: c.primary, marginTop: 2 },
  metaChips:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
  metaChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: c.surface,
    borderWidth: 1, borderColor: c.border,
  },
  metaChipTime:     { borderColor: c.border, backgroundColor: c.surfaceAlt },
  metaChipText:     { color: c.textSecondary, fontSize: 11, fontFamily: FONTS.bodySemiBold },
  metaChipTimeText: { color: c.textSecondary },
  costSummaryRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 8, maxWidth: '100%' },
  // flexShrink so a long cost summary wraps within the row instead of overflowing the screen.
  costSummaryTxt:   { flexShrink: 1, fontFamily: FONTS.bodySemiBold, fontSize: 13, color: c.primary },
});
