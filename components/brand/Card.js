import { View, StyleSheet } from 'react-native';
import { RADII, SHADOWS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

export default function Card({ style, children }) {
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: colors.surface, borderRadius: RADII.md, padding: 16, ...SHADOWS.card },
        scheme === 'dark' && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}
