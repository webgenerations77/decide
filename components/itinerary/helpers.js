import { Platform, Linking } from 'react-native';

// Theme-aware highlight styling. Pass the active palette (from useTheme) so the
// left-border colors track light/dark. `buzz` uses textSecondary (not textMuted)
// so the news/buzz rule stays legible on dark surfaceAlt.
export function makeHighlightConfig(colors) {
  return {
    entertainment: { icon: '🎵', borderColor: colors.amber },
    special:       { icon: '🏷️', borderColor: colors.primary },
    feature:       { icon: '✨', borderColor: colors.amber },
    buzz:          { icon: '📰', borderColor: colors.textSecondary },
  };
}

export function openMaps(stop) {
  const target = stop.lat && stop.lng
    ? `${stop.lat},${stop.lng}`
    : encodeURIComponent(stop.address || stop.name);
  const url = Platform.OS === 'ios'
    ? `maps://?daddr=${target}`
    : `https://maps.google.com/?daddr=${target}`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${target}`);
  });
}
