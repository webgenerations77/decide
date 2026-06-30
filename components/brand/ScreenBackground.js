import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

export default function ScreenBackground({ variant = 'paper', style, children }) {
  const { colors } = useTheme();
  if (variant === 'paper') {
    return <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{children}</View>;
  }
  if (variant === 'cream') {
    return <View style={[{ flex: 1, backgroundColor: colors.surfaceAlt }, style]}>{children}</View>;
  }
  const gradient = variant === 'brand'
    ? [colors.primary, colors.primaryDark]
    : [colors.bg, colors.sky100];
  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[{ flex: 1 }, style]}>
      {children}
    </LinearGradient>
  );
}
