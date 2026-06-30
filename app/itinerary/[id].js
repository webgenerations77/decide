import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, FONTS, RADII } from '../../constants/theme';
import ScreenBackground from '../../components/brand/ScreenBackground';
import WeatherPill from '../../components/itinerary/WeatherPill';
import ItineraryMeta from '../../components/itinerary/ItineraryMeta';
import StopCard from '../../components/itinerary/StopCard';
import PlaceDetailModal from '../../components/itinerary/PlaceDetailModal';

export default function ItineraryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [entry,         setEntry]         = useState(undefined); // undefined=loading, null=not found
  const [sensitivities, setSensitivities] = useState([]);
  const [selectedStop,    setSelectedStop]    = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [raw, sensRaw] = await Promise.all([
          AsyncStorage.getItem('@decide/itineraries'),
          AsyncStorage.getItem('@decide/sensitivities'),
        ]);
        const list  = raw ? JSON.parse(raw) : [];
        const found = list.find((e) => e.id === id);
        setSensitivities(sensRaw ? JSON.parse(sensRaw) : []);
        setEntry(found && Array.isArray(found.itinerary) && found.itinerary.length ? found : null);
      } catch {
        setEntry(null);
      }
    })();
  }, [id]);

  const Header = ({ children }) => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backRow}>
        <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      {children}
    </View>
  );

  if (entry === undefined) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenBackground variant="paper" style={styles.fill}>
          <Header />
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        </ScreenBackground>
      </SafeAreaView>
    );
  }

  if (entry === null) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenBackground variant="paper" style={styles.fill}>
          <Header />
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
      <ScrollView style={styles.fill} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Header>
          <Text style={styles.title}>Your day</Text>
          <WeatherPill weather={weather} timeWindow={meta?.time_window ?? ''} />
        </Header>

        <View style={styles.body}>
          <ItineraryMeta meta={meta} stopCount={itinerary.length} research={null} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: COLORS.bg },
  fill:       { flex: 1 },
  header:     { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  backRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backText:   { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: COLORS.primary, marginLeft: 2 },
  title:      { fontFamily: FONTS.display, fontSize: 26, color: COLORS.textPrimary, marginBottom: 8 },
  body:       { paddingHorizontal: 20 },
  emptyWrap:  { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60 },
  emptyTitle: { fontFamily: FONTS.display, fontSize: 19, color: COLORS.textPrimary, textAlign: 'center' },
  emptySub:   { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 8 },
});
