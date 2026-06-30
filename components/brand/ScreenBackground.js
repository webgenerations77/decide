import { View, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

// Whisper-faint vintage-map texture behind the app. Rendered in both schemes, but much
// fainter in dark — a warm map over dark navy turns to smudge above ~6%, so dark gets a
// low opacity that reads as subtle texture, not grime. Not shown on the cobalt 'brand'
// variant either (it would muddy the gradient).
const MAP_TEXTURE = require('../../assets/backgrounds/vintage-map.jpg');
const TEXTURE_OPACITY_LIGHT = 0.12;
const TEXTURE_OPACITY_DARK = 0.05;

function MapTexture({ scheme }) {
  const opacity = scheme === 'dark' ? TEXTURE_OPACITY_DARK : TEXTURE_OPACITY_LIGHT;
  return (
    <Image
      source={MAP_TEXTURE}
      resizeMode="cover"
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { opacity }]}
    />
  );
}

export default function ScreenBackground({ variant = 'paper', style, children }) {
  const { colors, scheme } = useTheme();
  const texture = <MapTexture scheme={scheme} />;

  if (variant === 'paper') {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
        {texture}
        {children}
      </View>
    );
  }
  if (variant === 'cream') {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.surfaceAlt }, style]}>
        {texture}
        {children}
      </View>
    );
  }
  const isBrand = variant === 'brand';
  const gradient = isBrand ? [colors.primary, colors.primaryDark] : [colors.bg, colors.sky100];
  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[{ flex: 1 }, style]}>
      {isBrand ? null : texture}
      {children}
    </LinearGradient>
  );
}
