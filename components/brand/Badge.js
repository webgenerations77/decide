import { View, Text } from 'react-native';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

export default function Badge({ label, tone = 'muted', style }) {
  const { colors } = useTheme();
  const toneColor = {
    muted:  colors.textMuted,
    beta:   colors.beta,
    gold:   colors.goldText,
    cobalt: colors.primary,
  }[tone] ?? colors.textMuted;

  return (
    <View
      style={[
        {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: toneColor + '55',
          backgroundColor: toneColor + '1A',
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 10, fontFamily: FONTS.monoBold, letterSpacing: 0.8, color: toneColor, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  );
}
