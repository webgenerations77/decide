import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, PRICE_LEGEND } from '../../constants/theme';

export default function PriceLegendModal({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.legendCard}>
            <Text style={styles.legendTitle}>Price guide</Text>
            {PRICE_LEGEND.map((row) => (
              <View key={row.symbol} style={styles.legendRow}>
                <Text style={styles.legendSymbol}>{row.symbol}</Text>
                <Text style={styles.legendLabel}>{row.label}</Text>
              </View>
            ))}
            <Text style={styles.legendSub}>Estimated per-person cost including a typical meal or entry</Text>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  legendCard: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border,
    width: 280, padding: 22,
  },
  legendTitle: {
    fontSize: 15, color: COLORS.textPrimary,
    fontFamily: FONTS.display,
    textAlign: 'center', marginBottom: 16,
  },
  legendRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  legendSymbol:{ fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.goldText, width: 40 },
  legendLabel: { fontSize: 14, color: COLORS.textSecondary, flex: 1, fontFamily: FONTS.body },
  legendSub:   { fontSize: 11, color: COLORS.textMuted, marginTop: 14, lineHeight: 15, textAlign: 'center', fontFamily: FONTS.body },
});
