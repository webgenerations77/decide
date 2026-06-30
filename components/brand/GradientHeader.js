import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

export default function GradientHeader({ children, style }) {
  const { colors } = useTheme();
  return (
    <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }, style]}>
      {children}
    </LinearGradient>
  );
}
