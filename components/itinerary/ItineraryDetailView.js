import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import ScreenBackground from '../brand/ScreenBackground';
import WeatherArt from './WeatherArt';
import ItineraryMeta from './ItineraryMeta';
import StopCard from './StopCard';
import PlaceDetailModal from './PlaceDetailModal';

function Header({ onBack, children, weather }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backRow}>
        <Ionicons name="chevron-back" size={18} color={colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      {weather ? <WeatherArt weather={weather} height={84} style={styles.headerArt} /> : null}
      {children}
    </View>
  );
}

export default function ItineraryDetailView({ entry, sensitivities = [], onBack }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selectedStop, setSelectedStop] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const hasFull = entry && Array.isArray(entry.itinerary) && entry.itinerary.length > 0;

  if (!hasFull) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenBackground variant="paper" style={styles.fill}>
          <Header onBack={onBack} />
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>This plan is no longer available</Text>
            <Text style={styles.emptySub}>Full detail isn't saved for older itineraries.</Text>
          </View>
        </ScreenBackground>
      </SafeAreaView>
    );
  }

  const { itinerary, weather, meta } = entry;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenBackground variant="paper" style={styles.fill}>
        <ScrollView style={styles.fill} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Header onBack={onBack} weather={weather} />
          <View style={styles.body}>
            <ItineraryMeta meta={meta} stopCount={itinerary.length} research={null} weather={weather} />
            {itinerary.map((stop, i) => (
              <StopCard
                key={`${stop.place_id}-${i}`}
                stop={stop}
                index={i}
                isLast={i === itinerary.length - 1}
                onViewDetails={(s) => { setSelectedStop(s); setShowDetailModal(true); }}
                weather={weather}
                planDate={entry.timestamp}
                sensitivities={sensitivities}
              />
            ))}
          </View>
        </ScrollView>
        <PlaceDetailModal
          visible={showDetailModal}
          stop={selectedStop}
          onClose={() => setShowDetailModal(false)}
        />
      </ScreenBackground>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  screen:     { flex: 1, backgroundColor: c.bg },
  fill:       { flex: 1 },
  header:     { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
  headerArt:  { marginTop: 4, marginBottom: 8, borderRadius: 14, zIndex: 0 },
  backRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  backText:   { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: c.primary, marginLeft: 2 },
  body:       { paddingHorizontal: 20, zIndex: 1 },
  emptyWrap:  { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60 },
  emptyTitle: { fontFamily: FONTS.display, fontSize: 19, color: c.textPrimary, textAlign: 'center' },
  emptySub:   { fontFamily: FONTS.body, fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 8 },
});
