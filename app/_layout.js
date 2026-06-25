import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../context/AuthContext';
import OfflineBanner from '../components/OfflineBanner';
import { COLORS } from '../constants/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashEmoji}>🧭</Text>
      <Text style={styles.splashTitle}>Decide</Text>
      <ActivityIndicator color={COLORS.teal} size="large" style={{ marginTop: 24 }} />
    </View>
  );
}

function RootLayoutInner() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [demoMode, setDemoMode] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    const route = async () => {
      if (!user) {
        router.replace('/auth/login');
      } else {
        const onboarded = await AsyncStorage.getItem('@decide/onboardingComplete').catch(() => null);
        if (onboarded === 'true') {
          router.replace('/(tabs)/plan');
        } else {
          router.replace('/onboarding');
        }
      }
      setReady(true);
    };
    route();
  }, [authLoading, user]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data?.screen;
      if (screen) router.push(screen);
    });
    return () => sub.remove();
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

  if (authLoading || !ready) {
    return <SplashScreen />;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
      {demoMode && <DemoBanner onDismiss={disableDemo} />}
      <OfflineBanner />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutInner />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', left: 0, right: 0,
    height: 32, zIndex: 9999, elevation: 20,
    backgroundColor: COLORS.teal,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12,
  },
  bannerSide: { width: 32, alignItems: 'flex-end', justifyContent: 'center' },
  bannerText: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.bg, textAlign: 'center' },
  bannerX:    { fontSize: 14, fontWeight: '700', color: COLORS.bg },
  splash: {
    flex: 1, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  splashEmoji: { fontSize: 64, marginBottom: 12 },
  splashTitle: { fontSize: 36, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: 1 },
});
