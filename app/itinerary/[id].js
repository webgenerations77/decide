import { useState, useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { loadHistory } from '../../services/historyService';
import { useTheme } from '../../context/ThemeContext';
import ScreenBackground from '../../components/brand/ScreenBackground';
import ItineraryDetailView from '../../components/itinerary/ItineraryDetailView';

export default function ItineraryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const [entry, setEntry] = useState(undefined); // undefined=loading, null=not found
  const [sensitivities, setSensitivities] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [{ itineraries }, sensRaw] = await Promise.all([
          loadHistory(),
          AsyncStorage.getItem('@decide/sensitivities'),
        ]);
        setSensitivities(sensRaw ? JSON.parse(sensRaw) : []);
        setEntry(itineraries.find((e) => e.id === id) || null);
      } catch {
        setEntry(null);
      }
    })();
  }, [id]);

  if (entry === undefined) {
    return (
      <ScreenBackground variant="paper">
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ItineraryDetailView
      entry={entry}
      sensitivities={sensitivities}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/history'))}
    />
  );
}
