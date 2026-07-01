import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, RADII } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

// Collapsible "receipts" disclosure: shows the 1–3 live finds Cheddar built the
// day around, each tappable to its source when a url is present. Also surfaces
// a "Local Happenings" block for holiday/event awareness when present.
export default function DiscoveryAnchors({ research }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  if (!research) return null;
  const lh = research.localHappenings;
  const anchors = research.anchors ?? [];
  const hasEvents = lh?.events?.length > 0;
  // Nothing live AND no local-happenings info → render nothing.
  if (!research.hadLiveData && !hasEvents && !lh?.note) return null;

  const openSource = (url) => { if (url) Linking.openURL(url).catch(() => {}); };

  return (
    <View>
      {(hasEvents || lh?.note) && (
        <View style={styles.lhWrap}>
          <Text style={styles.lhHeader}>🎉 Local Happenings{lh?.holiday ? ` · ${lh.holiday}` : ''}</Text>
          {lh.events?.map((ev, i) => {
            const tappable = !!ev.url;
            const Row = tappable ? TouchableOpacity : View;
            const rp = tappable ? { onPress: () => openSource(ev.url), activeOpacity: 0.7 } : {};
            return (
              <Row key={i} style={styles.lhRow} {...rp}>
                <Text style={[styles.lhEvent, tappable && styles.anchorTitleLink]} numberOfLines={2}>{ev.title}</Text>
                {tappable && <Ionicons name="open-outline" size={13} color={colors.primary} style={{ marginLeft: 6 }} />}
              </Row>
            );
          })}
          {lh?.note ? <Text style={styles.lhNote}>{lh.note}</Text> : null}
        </View>
      )}

      {research.hadLiveData && (
        <>
          {anchors.length === 0 ? null : (
            <View style={styles.wrap}>
              <TouchableOpacity style={styles.header} onPress={() => setExpanded((e) => !e)} activeOpacity={0.7}>
                <Text style={styles.headerText}>✨ What we found this week ({anchors.length})</Text>
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
          )}
        </>
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
  // Local Happenings block
  lhWrap: { marginTop: 10, alignSelf: 'stretch', backgroundColor: c.surfaceAlt, borderRadius: RADII.md, borderWidth: 1, borderColor: c.border, padding: 12, gap: 6 },
  lhHeader: { fontSize: 12, color: c.primary, fontFamily: FONTS.bodySemiBold, textAlign: 'center' },
  lhRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  lhEvent: { fontSize: 13, color: c.textPrimary, fontFamily: FONTS.bodyMedium, textAlign: 'center' },
  lhNote: { fontSize: 12, color: c.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 2, fontFamily: FONTS.body },
});
