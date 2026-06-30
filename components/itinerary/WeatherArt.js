// WeatherArt — a flat, editorial weather illustration band for itinerary cards.
// The day's forecast picks a scene (sun / clouds / rain / storm / snow), drawn as
// hand-authored SVG over a weather-tinted sky gradient. Everything comes from theme
// tokens, so it themes itself for light/dark. Renders nothing when there's no usable
// forecast (older saved plans, beyondForecast) — the caller then shows a plain card.
//
// Bucketing + sky gradient live in lib/weatherWash.js (pure, tested). This file owns
// only the vector scenes.
import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, Line, Path, G } from 'react-native-svg';
import { weatherBucket, weatherWash } from '../../lib/weatherWash';
import { useTheme } from '../../context/ThemeContext';

// Illustration coordinate space; the band stretches to fill, cropping via slice.
const VB_W = 320;
const VB_H = 96;

// A soft flat cloud puff (base ellipse + overlapping lobes) centered at (cx, cy).
function Cloud({ cx, cy, s = 1, fill }) {
  return (
    <G>
      <Ellipse cx={cx} cy={cy} rx={40 * s} ry={18 * s} fill={fill} />
      <Circle cx={cx - 22 * s} cy={cy - 2 * s} r={15 * s} fill={fill} />
      <Circle cx={cx - 2 * s}  cy={cy - 15 * s} r={20 * s} fill={fill} />
      <Circle cx={cx + 22 * s} cy={cy - 5 * s} r={14 * s} fill={fill} />
    </G>
  );
}

// Sun disc with eight rays. `core` (optional) overlays a warmer center for "hot".
function Sun({ cx, cy, r, fill, core }) {
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    rays.push(
      <Line
        key={i}
        x1={cx + Math.cos(a) * (r + 7)}  y1={cy + Math.sin(a) * (r + 7)}
        x2={cx + Math.cos(a) * (r + 17)} y2={cy + Math.sin(a) * (r + 17)}
        stroke={fill} strokeWidth={5} strokeLinecap="round"
      />
    );
  }
  return (
    <G>
      {rays}
      <Circle cx={cx} cy={cy} r={r} fill={fill} />
      {core ? <Circle cx={cx} cy={cy} r={r * 0.5} fill={core} /> : null}
    </G>
  );
}

function Scene({ bucket, c }) {
  switch (bucket) {
    case 'clear':
      return <Sun cx={232} cy={44} r={24} fill={c.gold} />;

    case 'hot':
      return <Sun cx={232} cy={44} r={26} fill={c.gold} core={c.accent} />;

    case 'partly':
      return (
        <G>
          <Sun cx={196} cy={34} r={17} fill={c.gold} />
          <Cloud cx={244} cy={58} s={1} fill={c.surface} />
        </G>
      );

    case 'overcast':
    case 'fog':
      return (
        <G>
          <Cloud cx={206} cy={42} s={1.15} fill={c.sky200} />
          <Cloud cx={252} cy={60} s={0.95} fill={c.surface} />
        </G>
      );

    case 'rain':
      return (
        <G>
          <Cloud cx={228} cy={40} s={1.15} fill={c.sky300} />
          {[188, 214, 240, 266].map((x) => (
            <Line key={x} x1={x} y1={66} x2={x - 6} y2={86}
              stroke={c.primary} strokeWidth={4} strokeLinecap="round" />
          ))}
        </G>
      );

    case 'thunder':
      return (
        <G>
          <Cloud cx={224} cy={38} s={1.2} fill={c.primaryDark} />
          <Path d="M232 56 L220 74 L229 74 L216 94" fill="none"
            stroke={c.gold} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          {[260, 284].map((x) => (
            <Line key={x} x1={x} y1={64} x2={x - 6} y2={82}
              stroke={c.sky300} strokeWidth={4} strokeLinecap="round" />
          ))}
        </G>
      );

    case 'snow':
      return (
        <G>
          <Cloud cx={228} cy={40} s={1.15} fill={c.surface} />
          {[[190, 70], [214, 82], [240, 72], [264, 84], [202, 90]].map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={3.5} fill={c.sky300} />
          ))}
        </G>
      );

    default:
      return null;
  }
}

export default function WeatherArt({ weather, height = 72, style }) {
  const { colors } = useTheme();
  const bucket = useMemo(() => weatherBucket(weather), [weather]);
  const wash   = useMemo(() => weatherWash(weather, colors), [weather, colors]);
  if (!bucket) return null;

  return (
    <View style={[{ height, width: '100%', overflow: 'hidden' }, style]}>
      {wash && (
        <LinearGradient
          colors={wash.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
        <Scene bucket={bucket} c={colors} />
      </Svg>
    </View>
  );
}
