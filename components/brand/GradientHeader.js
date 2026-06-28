import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/theme';

export default function GradientHeader({ children, style }) {
  return (
    <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }, style]}>
      {children}
    </LinearGradient>
  );
}
