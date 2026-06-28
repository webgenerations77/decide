import { Text } from 'react-native';
import { COLORS, FONTS } from '../../constants/theme';

export default function SectionLabel({ children, tone = 'muted', style }) {
  const color = tone === 'cobalt' ? COLORS.primary : COLORS.textMuted;
  return (
    <Text style={[{ fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color }, style]}>
      {children}
    </Text>
  );
}
