import { useState, useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../../../context/ThemeContext';
import { getUserHistory } from '../../../../../services/adminApi';
import ScreenBackground from '../../../../../components/brand/ScreenBackground';
import ItineraryDetailView from '../../../../../components/itinerary/ItineraryDetailView';

export default function AdminItineraryDetailScreen() {
  const router = useRouter();
  const { uid, id } = useLocalSearchParams();
  const { colors } = useTheme();
  const [entry, setEntry] = useState(undefined); // undefined=loading, null=not found

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { itineraries = [] } = await getUserHistory(uid);
        if (!alive) return;
        setEntry(itineraries.find((e) => e.id === id) || null);
      } catch {
        if (alive) setEntry(null);
      }
    })();
    return () => { alive = false; };
  }, [uid, id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/admin/user/${uid}`));

  if (entry === undefined) {
    return (
      <ScreenBackground variant="paper">
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return <ItineraryDetailView entry={entry} sensitivities={[]} onBack={back} />;
}
