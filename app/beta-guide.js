import { useMemo } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ScreenBackground from '../components/brand/ScreenBackground';
import GradientHeader from '../components/brand/GradientHeader';
import Card from '../components/brand/Card';
import SectionLabel from '../components/brand/SectionLabel';
import CTAButton from '../components/brand/CTAButton';
import { FONTS } from '../constants/theme';

function firstName(user) {
  const n = user?.displayName?.trim().split(/\s+/)[0];
  return n || 'friend';
}

export default function BetaGuide() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const router = useRouter();
  const { user } = useAuth();

  const done = async () => {
    await AsyncStorage.setItem('@decide/beta_guide_seen', 'true').catch(() => {});
    router.back();
  };

  return (
    <ScreenBackground variant="paper">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <GradientHeader style={styles.header}>
            <Text style={styles.eyebrow}>BETA GUIDE</Text>
            <Text style={styles.headerTitle}>Welcome to Cheddar 🧀</Text>
          </GradientHeader>

          <Text style={styles.lead}>
            You're one of the very first people inside Decide — thanks for that. Here's the deal:
            tell me roughly what you're in the mood for, and I'll plan the whole day — where to eat,
            what to do, in what order, drive times sorted. No more standing around asking "so what do
            you want to do?" We'll decide. You just go.{'\n\n'}
            This takes two minutes to read. Then go break things.
          </Text>

          <SectionLabel tone="cobalt" style={styles.section}>THREE WAYS TO DECIDE</SectionLabel>
          <Card style={styles.card}>
            <Text style={styles.h}>🗺️ Plan — the main event</Text>
            <Text style={styles.p}>
              Set your vibe — pace, budget, who's with you, a quick note like "anniversary, we love
              seafood" — and I build a full day, stop by stop, with a reason for each pick. Don't like
              one? Swap it and I'll find another.
            </Text>
            <Text style={styles.h}>🎯 Quick Spin</Text>
            <Text style={styles.p}>
              Can't even commit to planning? Hit Spin and I'll throw you one solid pick on the spot.
              Perfect for "just tell me where to eat."
            </Text>
            <Text style={styles.h}>📜 History</Text>
            <Text style={styles.p}>
              Every day I've planned and every spin lands here, so you can pull up that great taco
              place from last week.
            </Text>
          </Card>

          <SectionLabel tone="cobalt" style={styles.section}>SET YOURSELF UP FIRST (2 MIN)</SectionLabel>
          <Card style={styles.card}>
            <Text style={styles.p}>
              The more I know, the better the day. In Settings, set your location, your default pace
              and budget, and — this one matters — your dietary needs and sensitivities. Tell me you're
              vegetarian or allergic to shellfish and I'll plan around it every single time.
            </Text>
          </Card>

          <SectionLabel tone="cobalt" style={styles.section}>WHAT I'D LOVE YOU TO TEST</SectionLabel>
          <Card style={styles.card}>
            <Text style={styles.p}>• Plan a day in a few different places and dates — your hometown, then somewhere you're visiting.</Text>
            <Text style={styles.p}>• Try a weird combo on purpose (packed pace + tight budget + a picky note) and see if I hold up.</Text>
            <Text style={styles.p}>• Swap a stop or two — does the replacement actually make sense?</Text>
            <Text style={styles.p}>• Watch for the "what's happening right now" picks — events and specials tied to your real dates. Tell me when they land and when they're off.</Text>
            <Text style={styles.p}>• Push the edges. The stuff that breaks is exactly what I need to hear about.</Text>
          </Card>

          <SectionLabel tone="cobalt" style={styles.section}>FOUND SOMETHING? TELL ME.</SectionLabel>
          <Card style={styles.card}>
            <Text style={styles.p}>
              See the 💬 Give Feedback button floating in the corner? Tap it anytime — it's on every
              screen. The most useful reports tell me three things: what screen you were on, what you
              expected, and what actually happened. Even "this just felt off" is genuinely useful —
              don't hold back.
            </Text>
            <Text style={[styles.p, styles.signoff]}>
              Thanks for helping shape this, {firstName(user)}. Now go plan something.{'\n'}— Cheddar
            </Text>
          </Card>

          <CTAButton title="Got it — let's go" variant="cobalt" onPress={done} style={{ marginTop: 8 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const makeStyles = (c) => StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 8 },
  header: { borderRadius: 18, marginBottom: 8 },
  eyebrow: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1.6, color: c.sky200 },
  headerTitle: { fontFamily: FONTS.displayHeavy, fontSize: 26, color: c.white, marginTop: 4 },
  lead: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22, color: c.textSecondary, marginBottom: 8 },
  section: { marginTop: 16, marginBottom: 8 },
  card: { gap: 6 },
  h: { fontFamily: FONTS.bodyBold, fontSize: 15, color: c.textPrimary, marginTop: 4 },
  p: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20, color: c.textSecondary },
  signoff: { marginTop: 10, fontStyle: 'italic', color: c.textPrimary },
});
