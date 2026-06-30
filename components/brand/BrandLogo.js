import { View, Text } from 'react-native';
import Svg, { Circle, Line, G, Path } from 'react-native-svg';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

// The compass mark from the brand kit, drawn on a 120x120 viewBox.
function Mark({ size, ring, needleLo, hub, accent }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Circle cx="60" cy="60" r="46" stroke={ring} strokeWidth="3.5" />
      <G stroke={ring} strokeWidth="3" strokeLinecap="round">
        <Line x1="60" y1="9" x2="60" y2="19" />
        <Line x1="60" y1="101" x2="60" y2="111" />
        <Line x1="9" y1="60" x2="19" y2="60" />
        <Line x1="101" y1="60" x2="111" y2="60" />
      </G>
      <G transform="rotate(20 60 60)">
        <Path d="M60 18 L50 62 L70 62 Z" fill={accent} />
        <Path d="M60 102 L50 62 L70 62 Z" fill={needleLo} />
        <Circle cx="60" cy="62" r="5" fill={hub} />
      </G>
    </Svg>
  );
}

export default function BrandLogo({ variant = 'full', size = 80 }) {
  const { colors, scheme } = useTheme();
  const onDark = scheme === 'dark';
  const reversed = variant === 'reversed';
  const light = reversed || onDark;          // use light ink on dark surfaces
  const ring = light ? colors.white : colors.navy;
  const needleLo = light ? colors.white : colors.primary;
  const hub = light ? colors.white : colors.navy;
  const wordColor = light ? colors.white : colors.navy;
  const wordSize = size * 0.82;

  const mark = <Mark size={size} ring={ring} needleLo={needleLo} hub={hub} accent={colors.accent} />;
  if (variant === 'mark') return mark;

  const Wordmark = (
    <Text style={{ fontFamily: FONTS.displayHeavy, fontSize: wordSize, color: wordColor, letterSpacing: -0.5, lineHeight: wordSize * 1.05 }}>
      Decide<Text style={{ color: colors.accent }}>.</Text>
    </Text>
  );

  if (variant === 'stacked') {
    return (
      <View style={{ alignItems: 'center', gap: 12 }}>
        {mark}
        {Wordmark}
      </View>
    );
  }
  // full (horizontal)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.28 }}>
      {mark}
      {Wordmark}
    </View>
  );
}
