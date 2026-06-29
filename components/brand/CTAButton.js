import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADII, FONTS } from '../../constants/theme';

export default function CTAButton({ title, onPress, variant = 'go', disabled = false, loading = false, style, leftIcon = null }) {
  const isDisabled = disabled || loading;
  const isSecondary = variant === 'secondary';
  const colors = variant === 'cobalt'
    ? [COLORS.primary, COLORS.primaryDark]
    : [COLORS.accent, COLORS.accentDark];    // orange "go"
  const labelColor = isSecondary ? COLORS.primary : COLORS.white;

  const inner = loading
    ? <ActivityIndicator color={labelColor} size="small" />
    : leftIcon
      ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{leftIcon}<Text style={{ fontFamily: FONTS.displayHeavy, fontSize: 17, color: labelColor, letterSpacing: 0.2 }}>{title}</Text></View>
      : <Text style={{ fontFamily: FONTS.displayHeavy, fontSize: 17, color: labelColor, letterSpacing: 0.2 }}>{title}</Text>;

  const body = isSecondary ? (
    <TouchableOpacity
      onPress={onPress} disabled={isDisabled} accessibilityRole="button"
      style={[{ height: 56, borderRadius: RADII.pill, alignItems: 'center', justifyContent: 'center',
                backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.primary, opacity: isDisabled ? 0.5 : 1 }, style]}>
      {inner}
    </TouchableOpacity>
  ) : (
    <TouchableOpacity onPress={onPress} disabled={isDisabled} accessibilityRole="button" activeOpacity={0.9} style={[{ opacity: isDisabled ? 0.5 : 1 }, style]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ height: 56, borderRadius: RADII.pill, alignItems: 'center', justifyContent: 'center' }}>
        {inner}
      </LinearGradient>
    </TouchableOpacity>
  );
  return body;
}
