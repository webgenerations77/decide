import { useRef, useMemo } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import { FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import SectionLabel from './brand/SectionLabel';

// Shared "MAX TRAVEL DISTANCE" slider — range 1–50 mi, integer.
// Mirrors the DistanceSlider UX in screens/SettingsScreen.js: a cobalt-fill
// track with a draggable thumb, a "Within N mi" header value, and 1/25/50 ticks.
const MAX_DISTANCE_MILES = 50;

export default function DistanceSlider({ value, onChange, label = 'Max travel distance' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const widthRef = useRef(1);
  const cbRef    = useRef(onChange);
  cbRef.current  = onChange;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const r = Math.max(0, Math.min(1, e.nativeEvent.locationX / widthRef.current));
        cbRef.current(Math.round(1 + r * (MAX_DISTANCE_MILES - 1)));
      },
      onPanResponderMove: (e) => {
        const r = Math.max(0, Math.min(1, e.nativeEvent.locationX / widthRef.current));
        cbRef.current(Math.round(1 + r * (MAX_DISTANCE_MILES - 1)));
      },
    })
  ).current;

  const pct = `${((value - 1) / (MAX_DISTANCE_MILES - 1)) * 100}%`;

  return (
    <View>
      <View style={styles.header}>
        <SectionLabel tone="cobalt">{label}</SectionLabel>
        <Text style={styles.value}>Within {value} mi</Text>
      </View>
      <View
        style={styles.track}
        onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }}
        {...pan.panHandlers}
      >
        <View style={[styles.fill, { width: pct }]} />
        <View
          style={[styles.thumb, { left: pct, transform: [{ translateX: -14 }] }]}
          pointerEvents="none"
        />
      </View>
      <View style={styles.ticks}>
        <Text style={styles.tick}>1 mi</Text>
        <Text style={styles.tick}>25 mi</Text>
        <Text style={styles.tick}>50 mi</Text>
      </View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value:  { fontSize: 13, fontFamily: FONTS.bodyBold, color: c.textPrimary },
  track: {
    height: 4, borderRadius: 2, backgroundColor: c.border,
    marginTop: 18, marginBottom: 18, position: 'relative',
  },
  fill: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    backgroundColor: c.primary, borderRadius: 2,
  },
  thumb: {
    position: 'absolute', top: -12,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: c.primary, borderWidth: 2, borderColor: c.surface,
  },
  ticks: { flexDirection: 'row', justifyContent: 'space-between' },
  tick:  { fontSize: 10, color: c.textMuted },
});
