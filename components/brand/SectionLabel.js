import { Text, View } from 'react-native';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

// `rule` draws a hairline from the end of the label to the right edge, so the label and
// its divider read as one unit instead of a rule floating between cards. Opt-in — plain
// SectionLabel is unchanged everywhere else.
export default function SectionLabel({ children, tone = 'muted', style, rule = false }) {
  const { colors } = useTheme();
  const color = tone === 'cobalt' ? colors.primary : colors.textMuted;
  const textStyle = {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color,
  };

  if (!rule) return <Text style={[textStyle, style]}>{children}</Text>;

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>
      <Text style={textStyle}>{children}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}
