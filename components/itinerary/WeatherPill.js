import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII } from '../../constants/theme';

export function buildWeatherPillText(weather, timeWindow) {
  const tw = timeWindow ?? '';
  if (weather?.beyondForecast) {
    return `🗓 Extended forecast not available — check back closer to your trip · ${tw}`;
  }
  if (weather) {
    const wind = weather.wind_speed_mph ? ` · 💨 ${weather.wind_speed_mph}mph` : '';
    return `${weather.emoji ?? ''} ${weather.condition} · ${weather.temp_f}°F${wind} · ${tw}`;
  }
  return tw;
}

export default function WeatherPill({ weather, timeWindow }) {
  return (
    <View style={styles.headerPill}>
      <Text style={styles.headerPillText}>{buildWeatherPillText(weather, timeWindow)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerPill: {
    marginTop: 10, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerPillText: { fontSize: 12, color: COLORS.textSecondary, letterSpacing: 0.2 },
});
