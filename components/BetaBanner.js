import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { FONTS } from '../constants/theme';

// Persistent beta banner. `topOffset` stacks it below the demo banner when both show.
export default function BetaBanner({ onDismiss, topOffset = 0 }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.banner, { top: insets.top + topOffset }]} pointerEvents="box-none">
      <View style={styles.side} />
      <Text style={styles.text} numberOfLines={2}>
        🧪 You're a Cheddar Beta Tester — thanks for helping us build something great!
      </Text>
      <TouchableOpacity
        style={styles.side}
        onPress={onDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Text style={styles.x}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  banner: {
    position: 'absolute', left: 0, right: 0,
    minHeight: 32, zIndex: 9998, elevation: 19,
    backgroundColor: c.beta,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 5,
  },
  side: { width: 28, alignItems: 'flex-end', justifyContent: 'center' },
  text: { flex: 1, fontSize: 11, fontFamily: FONTS.bodySemiBold, color: c.white, textAlign: 'center' },
  x:    { fontSize: 14, fontFamily: FONTS.bodyBold, color: c.white },
});
