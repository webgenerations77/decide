import { Text } from 'react-native';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

export default function SectionLabel({ children, tone = 'muted', style }) {
  const { colors } = useTheme();
  const color = tone === 'cobalt' ? colors.primary : colors.textMuted;
  return (
    <Text style={[{ fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color }, style]}>
      {children}
    </Text>
  );
}
