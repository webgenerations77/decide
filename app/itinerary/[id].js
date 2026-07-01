import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { loadHistory } from '../../services/historyService';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import ScreenBackground from '../../components/brand/ScreenBackground';
import WeatherArt from '../../components/itinerary/WeatherArt';
import ItineraryMeta from '../../components/itinerary/ItineraryMeta';
import StopCard from '../../components/itinerary/StopCard';
import PlaceDetailModal from '../../components/itinerary/PlaceDetailModal';

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

export default function ItineraryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [entry,         setEntry]         = useState(undefined); // undefined=loading, null=not found
  const [sensitivities, setSensitivities] = useState([]);
  const [selectedStop,    setSelectedStop]    = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    (async () => {
      try {
        const [{ itineraries }, sensRaw] = await Promise.all([
          loadHistory(),
          AsyncStorage.getItem('@decide/sensitivities'),
        ]);
        const found = itineraries.find((e) => e.id === id);
        setSensitivities(sensRaw ? JSON.parse(sensRaw) : []);
        setEntry(found && Array.isArray(found.itinerary) && found.itinerary.length ? found : null);
      } catch {
        setEntry(null);
      }
    })();
  }, [id]);

  if (entry === undefined) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenBackground variant="paper" style={styles.fill}>
          <Header onBack={() => router.back()} />
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        </ScreenBackground>
      </SafeAreaView>
    );
  }

  if (entry === null) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenBackground variant="paper" style={styles.fill}>
          <Header onBack={() => router.back()} />
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
          <Header onBack={() => router.back()} weather={weather} />

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
  // Rounded weather illustration hero, inset by the header's horizontal padding.
  // zIndex 0: an explicit background layer so it never stacks above the metadata
  // below, even if this band's layout changes to overlap in the future.
  headerArt:  { marginTop: 4, marginBottom: 8, borderRadius: 14, zIndex: 0 },
  backRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  backText:   { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: c.primary, marginLeft: 2 },
  // zIndex 1: keeps the day/date/stops/city/weather/tags metadata as the foreground
  // stacking context relative to the weather banner above.
  body:       { paddingHorizontal: 20, zIndex: 1 },
  emptyWrap:  { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60 },
  emptyTitle: { fontFamily: FONTS.display, fontSize: 19, color: c.textPrimary, textAlign: 'center' },
  emptySub:   { fontFamily: FONTS.body, fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 8 },
});
