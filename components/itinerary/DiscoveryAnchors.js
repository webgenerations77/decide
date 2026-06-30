import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, RADII } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

// Collapsible "receipts" disclosure: shows the 1–3 live finds Cheddar built the
// day around, each tappable to its source when a url is present.
export default function DiscoveryAnchors({ research }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  // No live data at all → render nothing (prior behavior).
  if (!research?.hadLiveData) return null;

  const anchors = research.anchors ?? [];

  // Live data but no anchors → keep the original one-liner.
  if (anchors.length === 0) {
    return <Text style={styles.liveDataNote}>✨ Cheddar checked what's happening this week</Text>;
  }

  const openSource = (url) => { if (url) Linking.openURL(url).catch(() => {}); };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded((e) => !e)} activeOpacity={0.7}>
        <Text style={styles.headerText}>✨ What Cheddar found this week ({anchors.length})</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {anchors.map((a, i) => {
            const tappable = !!a.url;
            const Row = tappable ? TouchableOpacity : View;
            const rowProps = tappable ? { onPress: () => openSource(a.url), activeOpacity: 0.7 } : {};
            return (
              <Row key={i} style={styles.row} {...rowProps}>
                <View style={styles.rowTextCol}>
                  <Text style={[styles.anchorTitle, tappable && styles.anchorTitleLink]} numberOfLines={2}>
                    {a.title}
                  </Text>
                  {a.why ? <Text style={styles.anchorWhy} numberOfLines={3}>{a.why}</Text> : null}
                </View>
                {tappable && (
                  <Ionicons name="open-outline" size={14} color={colors.primary} style={{ marginLeft: 6, marginTop: 2 }} />
                )}
              </Row>
            );
          })}
        </View>
      )}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap: { marginTop: 10, alignSelf: 'stretch' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  headerText: { color: c.teal, fontSize: 12, fontFamily: FONTS.bodySemiBold, fontStyle: 'italic' },
  body: {
    marginTop: 10, gap: 10,
    backgroundColor: c.surfaceAlt, borderRadius: RADII.md,
    borderWidth: 1, borderColor: c.border, padding: 12,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  rowTextCol: { flex: 1 },
  anchorTitle: { fontSize: 13, color: c.textPrimary, fontFamily: FONTS.bodySemiBold },
  anchorTitleLink: { color: c.primary },
  anchorWhy: { fontSize: 12, color: c.textMuted, lineHeight: 17, marginTop: 2, fontFamily: FONTS.body },
  // Fallback one-liner (matches the old ItineraryMeta style).
  liveDataNote: { color: c.teal, fontSize: 11, fontStyle: 'italic', marginTop: 10, textAlign: 'center' },
});
