import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
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
import BetaBanner from '../components/BetaBanner';
import BetaFeedback from '../components/BetaFeedback';
import { isPublicRoute } from '../utils/betaRoutes';
import { COLORS, FONTS } from '../constants/theme';
import ScreenBackground from '../components/brand/ScreenBackground';
import BrandLogo from '../components/brand/BrandLogo';
import SectionLabel from '../components/brand/SectionLabel';

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
    <ScreenBackground variant="paper" style={{ alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <BrandLogo variant="stacked" size={80} />
      <SectionLabel>Tap · Pack · Go</SectionLabel>
    </ScreenBackground>
  );
}

function RootLayoutInner() {
  const router = useRouter();
  const { user, loading: authLoading, isBetaTester } = useAuth();
  const pathname = usePathname();
  const [betaBannerDismissed, setBetaBannerDismissed] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [ready, setReady] = useState(false);
  const guideCheckedRef = useRef(false);

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
    if (!ready || !isBetaTester || guideCheckedRef.current) return;
    guideCheckedRef.current = true;
    (async () => {
      const seen = await AsyncStorage.getItem('@decide/beta_guide_seen').catch(() => null);
      if (seen === 'true') return;
      const onboarded = await AsyncStorage.getItem('@decide/onboardingComplete').catch(() => null);
      if (onboarded === 'true') router.push('/beta-guide');
    })();
  }, [ready, isBetaTester]);

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

  const showBeta = isBetaTester && !isPublicRoute(pathname);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
      {demoMode && <DemoBanner onDismiss={disableDemo} />}
      {showBeta && pathname !== '/beta-guide' && !betaBannerDismissed && (
        <BetaBanner onDismiss={() => setBetaBannerDismissed(true)} topOffset={demoMode ? 32 : 0} />
      )}
      {showBeta && pathname !== '/beta-guide' && (
        <BetaFeedback
          topOffset={
            (demoMode ? 32 : 0) +
            (showBeta && pathname !== '/beta-guide' && !betaBannerDismissed ? 40 : 0)
          }
        />
      )}
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
      <ScreenBackground variant="paper" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <BrandLogo variant="mark" size={80} />
      </ScreenBackground>
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
  bannerText: { flex: 1, fontSize: 12, fontFamily: FONTS.bodyBold, color: COLORS.navy, textAlign: 'center' },
  bannerX:    { fontSize: 14, fontFamily: FONTS.bodyBold, color: COLORS.navy },
});
