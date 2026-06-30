import { Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

// Single source of truth for the displayed app version — read from app.json
// (expo config) so it never drifts from a hardcoded string.
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

// Subtle muted version label for main screens. Pass `style` to add spacing.
export default function VersionTag({ style }) {
  const { colors } = useTheme();
  return <Text style={[styles.txt, { color: colors.textMuted }, style]}>v{APP_VERSION}</Text>;
}

const styles = StyleSheet.create({
  txt: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.5, textAlign: 'center' },
});
