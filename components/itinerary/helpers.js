import { Platform, Linking } from 'react-native';

// Theme-aware highlight styling. Pass the active palette (from useTheme) so the
// left-border colors track light/dark. `buzz` uses textSecondary (not textMuted)
// so the news/buzz rule stays legible on dark surfaceAlt.
//
// `icon` is an Ionicons NAME, not an emoji. These were 🎵 / 🏷️ / ✨ / 📰 — the sparkle is
// banned outright by DESIGN.md as the generic-AI-chat anti-reference, and emoji-as-icon is a
// problem for the other three too: they can't take a theme colour, they sit outside the
// Ionicons set the rest of the app uses, and they render differently across Android launchers.
export function makeHighlightConfig(colors) {
  return {
    entertainment: { icon: 'musical-notes-outline', borderColor: colors.amber },
    special:       { icon: 'pricetag-outline',      borderColor: colors.primary },
    feature:       { icon: 'star-outline',          borderColor: colors.amber },
    buzz:          { icon: 'newspaper-outline',     borderColor: colors.textSecondary },
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
