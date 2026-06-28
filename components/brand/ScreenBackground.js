import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/theme';

export default function ScreenBackground({ variant = 'paper', style, children }) {
  if (variant === 'paper') {
    return <View style={[{ flex: 1, backgroundColor: COLORS.bg }, style]}>{children}</View>;
  }
  if (variant === 'cream') {
    return <View style={[{ flex: 1, backgroundColor: COLORS.surfaceAlt }, style]}>{children}</View>;
  }
  const colors = variant === 'brand'
    ? [COLORS.primary, COLORS.primaryDark]      // cobalt brand wash
    : [COLORS.bg, COLORS.sky100];               // 'sky' wash
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[{ flex: 1 }, style]}>
      {children}
    </LinearGradient>
  );
}
