import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

// Replace the ASCII space inside a clock time ("11:00 AM") with a non-breaking
// space so a time never wraps across lines mid-value.
const NBSP = '\u00A0';
function keepTimesWhole(s) {
  return s.replace(/(\d{1,2}:\d{2})\s+([AP]M)/gi, `$1${NBSP}$2`);
}

export function buildWeatherPillText(weather, timeWindow) {
  const tw = timeWindow ?? '';
  const tail = tw ? ` · ${tw}` : '';
  if (weather?.beyondForecast) {
    return keepTimesWhole(`🗓 Extended forecast not available — check back closer to your trip${tail}`);
  }
  if (weather) {
    const wind = weather.wind_speed_mph ? ` · 💨 ${weather.wind_speed_mph}mph` : '';
    return keepTimesWhole(`${weather.emoji ?? ''} ${weather.condition} · ${weather.temp_f}°F${wind}${tail}`);
  }
  return keepTimesWhole(tw);
}

export default function WeatherPill({ weather, timeWindow }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.headerPill}>
      <Text style={styles.headerPillText}>{buildWeatherPillText(weather, timeWindow)}</Text>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  headerPill: {
    marginTop: 10, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: c.surface,
    borderWidth: 1, borderColor: c.border,
  },
  headerPillText: { fontSize: 12, color: c.textSecondary, letterSpacing: 0.2 },
});
