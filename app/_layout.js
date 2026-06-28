import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';
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
      <Text style={styles.bannerText}>Demo Mode — Sample Data Only</Text>
      <TouchableOpacity style={styles.bannerSide} onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
        <Text style={styles.bannerX}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <Image
        source={require('../assets/logo-small.png')}
        style={styles.splashLogo}
        resizeMode="contain"
      />
      <View style={styles.splashDotRow}>
        <View style={[styles.splashDot, styles.splashDotActive]} />
        <View style={styles.splashDot} />
        <View style={styles.splashDot} />
      </View>
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
    if (!user) {
      router.replace('/auth/login');
      setReady(true);
      return;
    }
    AsyncStorage.getItem('@decide/onboardingComplete')
      .catch(() => null)
      .then((onboarded) => {
        router.replace(onboarded === 'true' ? '/(tabs)/plan' : '/onboarding');
        setReady(true);
      });
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
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <Image
          source={require('../assets/logo-small.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
      </View>
    );
  }

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
    backgroundColor: COLORS.amber,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12,
  },
  bannerSide: { width: 32, alignItems: 'flex-end', justifyContent: 'center' },
  bannerText: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.bg, textAlign: 'center' },
  bannerX:    { fontSize: 14, fontWeight: '700', color: COLORS.bg },
  splash: {
    flex: 1, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center',
    gap: 32,
  },
  splashLogo: { width: 180, height: 180 },
  splashDotRow: { flexDirection: 'row', gap: 8 },
  splashDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  splashDotActive: { backgroundColor: COLORS.amber },
});
