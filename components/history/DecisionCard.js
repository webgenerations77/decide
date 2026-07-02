import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { categoryVisual } from '../../constants/categoryVisuals';
import { useTheme } from '../../context/ThemeContext';
import Card from '../brand/Card';

function formatTimestamp(ts) {
  const d   = new Date(ts);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dMidnight     = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const diff = todayMidnight - dMidnight;
  if (diff === 0)         return `Today · ${time}`;
  if (diff === 86400000)  return `Yesterday · ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
}

export default function DecisionCard({ item, onFeedbackUp, onFeedbackDown, readOnly = false }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { icon: catIcon, color } = categoryVisual(item.category);
  const score = item.excitementScore ?? item.excitement_score ?? 0;

  return (
    <Card style={[styles.decisionCard, { borderLeftColor: color }]}>
      <View style={styles.decisionTop}>
        <View style={styles.decisionNameRow}>
          <Ionicons name={catIcon} size={15} color={color} style={styles.decisionCatIcon} />
          <Text style={styles.decisionName} numberOfLines={1}>{item.name}</Text>
          {score > 0 && (
            <View style={styles.exciteBadge}>
              <Text style={styles.exciteText}>⚡{score}</Text>
            </View>
          )}
        </View>

        {item.reason ? (
          <Text style={styles.decisionReason} numberOfLines={2}>{item.reason}</Text>
        ) : null}

        <View style={styles.decisionMetaRow}>
          <Text style={styles.decisionTime}>{formatTimestamp(item.timestamp)}</Text>
          {item.rating > 0 && <Text style={styles.decisionMeta}>⭐ {item.rating}</Text>}
          {item.distance ? <Text style={styles.decisionMeta}>{item.distance}</Text> : null}
        </View>

        {item.feedback === 'down' && item.feedbackReason ? (
          <View style={styles.feedbackTag}>
            <Text style={styles.feedbackTagTxt}>❌ {item.feedbackReason}</Text>
          </View>
        ) : null}
      </View>

      {!readOnly && (
        <View style={styles.thumbsRow}>
          <TouchableOpacity
            style={[styles.thumbBtn, item.feedback === 'up' && styles.thumbBtnUp]}
            onPress={onFeedbackUp}
            activeOpacity={0.7}
          >
            <Text style={styles.thumbTxt}>👍</Text>
          </TouchableOpacity>
          <View style={styles.thumbDivider} />
          <TouchableOpacity
            style={[styles.thumbBtn, item.feedback === 'down' && styles.thumbBtnDown]}
            onPress={onFeedbackDown}
            activeOpacity={0.7}
          >
            <Text style={styles.thumbTxt}>👎</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

const makeStyles = (c) => StyleSheet.create({
  decisionCard: {
    borderRadius: 16,
    borderWidth: 0.5, borderColor: c.border, borderLeftWidth: 3,
    marginBottom: 12, overflow: 'hidden', padding: 0,
  },
  decisionTop:      { padding: 14, gap: 5 },
  decisionNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  decisionCatIcon:  { marginRight: 2 },
  decisionName:     { flex: 1, fontSize: 15, fontFamily: FONTS.bodyBold, color: c.textPrimary },
  exciteBadge: {
    backgroundColor: c.primary + '33', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: c.primary + '55',
  },
  exciteText: { color: c.primaryDark, fontSize: 10, fontFamily: FONTS.bodyBold },
  decisionReason:  { fontSize: 13, color: c.textSecondary, fontStyle: 'italic', lineHeight: 17 },
  decisionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  decisionTime:    { fontSize: 11, color: c.textMuted },
  decisionMeta:    { fontSize: 11, color: c.textMuted },
  feedbackTag: {
    alignSelf: 'flex-start', backgroundColor: c.error + '22',
    borderRadius: 8, borderWidth: 1, borderColor: c.error + '44',
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 2,
  },
  feedbackTagTxt: { fontSize: 11, fontFamily: FONTS.bodySemiBold, color: c.error },
  thumbsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: 14, paddingVertical: 8,
  },
  thumbBtn:     { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  thumbBtnUp:   { backgroundColor: c.success + '33' },
  thumbBtnDown: { backgroundColor: c.error + '22' },
  thumbTxt:     { fontSize: 15 },
  thumbDivider: { width: 1, height: 18, backgroundColor: c.border, marginHorizontal: 6 },
});
