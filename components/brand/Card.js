import { View } from 'react-native';
import { COLORS, RADII, SHADOWS } from '../../constants/theme';

export default function Card({ style, children }) {
  return (
    <View style={[{ backgroundColor: COLORS.surface, borderRadius: RADII.md, padding: 16, ...SHADOWS.card }, style]}>
      {children}
    </View>
  );
}
