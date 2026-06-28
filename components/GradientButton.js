import { useRef } from 'react';
import { TouchableOpacity, Animated, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../constants/theme';

export default function GradientButton({
  onPress,
  children,
  loading = false,
  disabled = false,
  secondary = false,
  danger = false,
  colors,
  style,
  textStyle,
  height = 58,
  radius = 18,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      damping: 20,
      stiffness: 300,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 14,
      stiffness: 250,
    }).start();
  };

  const gradientColors = danger
    ? [COLORS.error, '#8F2020']
    : secondary
    ? [COLORS.surface, COLORS.surfaceAlt]
    : colors
    ? colors
    : [COLORS.primary, COLORS.primaryDark];

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      activeOpacity={1}
      accessibilityRole="button"
    >
      <Animated.View style={[{ transform: [{ scale }] }, isDisabled && styles.disabled, style]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradient,
            { height, borderRadius: radius },
            secondary && styles.secondary,
            !secondary && !danger && styles.primaryShadow,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={secondary ? COLORS.amber : COLORS.primaryText} size="small" />
          ) : (
            children
          )}
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

export function GradientButtonText({ children, secondary, style }) {
  return (
    <Text style={[styles.text, secondary && styles.textSecondary, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    flexDirection: 'row',
    gap: 8,
  },
  secondary: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  primaryShadow: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontFamily: FONTS.displayHeavy,
    color: COLORS.primaryText,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  textSecondary: {
    color: COLORS.amber,
  },
});
