import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

function DemoBanner({ onDismiss }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.banner, { top: insets.top }]} pointerEvents="box-none">
      <View style={styles.bannerSide} />
      <Text style={styles.bannerText}>🎭 Demo Mode — Sample Data Only</Text>
      <TouchableOpacity style={styles.bannerSide} onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
        <Text style={styles.bannerX}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function RootLayoutInner() {
  const router = useRouter();
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    router.replace('/onboarding');
  }, []);

  useEffect(() => {
    const checkDemo = async () => {
      const raw = await AsyncStorage.getItem('@decide/demo_mode').catch(() => null);
      setDemoMode(raw === 'true');
    };
    checkDemo();
    const sub = AppState.addEventListener('change', checkDemo);
    return () => sub.remove();
  }, []);

  const disableDemo = async () => {
    await AsyncStorage.setItem('@decide/demo_mode', 'false');
    await AsyncStorage.setItem('@decide/location_mode', 'auto');
    await AsyncStorage.removeItem('@decide/manual_location');
    setDemoMode(false);
  };

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
      {demoMode && <DemoBanner onDismiss={disableDemo} />}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootLayoutInner />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', left: 0, right: 0,
    height: 32, zIndex: 9999, elevation: 20,
    backgroundColor: '#00d2be',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12,
  },
  bannerSide: { width: 32, alignItems: 'flex-end', justifyContent: 'center' },
  bannerText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#00191f', textAlign: 'center' },
  bannerX:    { fontSize: 14, fontWeight: '700', color: '#00191f' },
});
