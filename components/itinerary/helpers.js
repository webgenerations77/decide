import { Platform, Linking } from 'react-native';
import { COLORS } from '../../constants/theme';

export const highlightConfig = {
  entertainment: { icon: '🎵', borderColor: COLORS.amber },
  special:       { icon: '🏷️', borderColor: COLORS.primary },
  feature:       { icon: '✨', borderColor: COLORS.amber },
  buzz:          { icon: '📰', borderColor: COLORS.textMuted },
};

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
