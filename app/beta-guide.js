import { useMemo, useState, useEffect } from 'react';
import { ScrollView, Text, StyleSheet, Pressable, View } from 'react-native';
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

  // "Show this guide every time I log in" — defaults to checked (on). The guide reappears on
  // each login unless the tester unchecks this (persisted as @decide/beta_guide_always='false').
  const [alwaysShow, setAlwaysShow] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem('@decide/beta_guide_always')
      .then((raw) => { if (raw != null) setAlwaysShow(raw !== 'false'); })
      .catch(() => {});
  }, []);

  const done = async () => {
    await AsyncStorage.setItem('@decide/beta_guide_always', alwaysShow ? 'true' : 'false').catch(() => {});
    router.back();
  };

  return (
    <ScreenBackground variant="paper">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} bounces={false} overScrollMode="never">
          <GradientHeader style={styles.header}>
            <Text style={styles.eyebrow}>BETA GUIDE</Text>
            <Text style={styles.headerTitle}>Welcome to Decide 🧭</Text>
          </GradientHeader>

          <Text style={styles.lead}>
            You're one of the very first people inside Decide — thanks for that. Here's the deal:
            tell us roughly what you're in the mood for, and we'll plan the whole day — where to eat,
            what to do, in what order, drive times sorted. No more standing around asking "so what do
            you want to do?" We'll decide. You just go.{'\n\n'}
            This takes two minutes to read. Then go break things.
          </Text>

          <SectionLabel tone="cobalt" style={styles.section}>THREE WAYS TO DECIDE</SectionLabel>
          <Card style={styles.card}>
            <Text style={styles.h}>🗺️ Plan — the main event</Text>
            <Text style={styles.p}>
              Set your vibe — pace, budget, who's with you, and a quick note like "anniversary, we love
              seafood." If your note has real detail, we'll ask one quick follow-up to nail the day, then
              build it stop by stop, each with a reason for the pick. Don't like one? Swap it and we'll
              find another.
            </Text>
            <Text style={styles.h}>🎯 Quick Spin</Text>
            <Text style={styles.p}>
              Can't even commit to planning? Hit Spin and we'll throw you one solid pick on the spot —
              with a quick reason for why, plus one-tap Directions, Website, and Call.
              Perfect for "just tell me where to eat."
            </Text>
            <Text style={styles.h}>📜 History</Text>
            <Text style={styles.p}>
              Every day we've planned and every spin lands here — and it syncs across your devices — so
              you can pull up that great taco place from last week.
            </Text>
          </Card>

          <SectionLabel tone="cobalt" style={styles.section}>SET YOURSELF UP FIRST (2 MIN)</SectionLabel>
          <Card style={styles.card}>
            <Text style={styles.p}>
              The more we know, the better the day. In Settings, set your location, your default pace
              and budget, and — this one matters — your dietary needs and sensitivities. Tell us you're
              vegetarian or allergic to shellfish and we'll plan around it every single time. While
              you're there, pick a profile avatar and try light or dark mode.
            </Text>
          </Card>

          <SectionLabel tone="cobalt" style={styles.section}>WHAT WE'D LOVE YOU TO TEST</SectionLabel>
          <Card style={styles.card}>
            <Text style={styles.p}>• Plan a day in a few different places and dates — your hometown, then somewhere you're visiting.</Text>
            <Text style={styles.p}>• Add a detailed note (e.g. "first time here, love live music") — we may ask one follow-up question first. Does it make sense, and does your answer actually improve the plan?</Text>
            <Text style={styles.p}>• Try a weird combo on purpose (packed pace + tight budget + a picky note) and see if we hold up.</Text>
            <Text style={styles.p}>• Swap a stop or two — does the replacement actually make sense?</Text>
            <Text style={styles.p}>• Check each stop's details — the activity icon, the price for restaurants, and the day's weather up top. Flag anything that looks wrong.</Text>
            <Text style={styles.p}>• Hit Surprise Me a few times — does the "why this pick" line make sense, and do the Directions / Website / Call buttons work?</Text>
            <Text style={styles.p}>• Watch for the "what's happening right now" picks — events and specials tied to your real dates. Tell us when they land and when they're off.</Text>
            <Text style={styles.p}>• Push the edges. The stuff that breaks is exactly what we need to hear about.</Text>
          </Card>

          <SectionLabel tone="cobalt" style={styles.section}>FOUND SOMETHING? TELL US.</SectionLabel>
          <Card style={styles.card}>
            <Text style={styles.p}>
              See the 💬 Give Feedback button floating in the corner? Tap it anytime — it's on every
              screen. The most useful reports tell us three things: what screen you were on, what you
              expected, and what actually happened. Even "this just felt off" is genuinely useful —
              don't hold back.
            </Text>
            <Text style={[styles.p, styles.signoff]}>
              Thanks for helping shape this, {firstName(user)}. Now go plan something.{'\n'}— The Decide team
            </Text>
          </Card>

          <Pressable style={styles.checkRow} onPress={() => setAlwaysShow((v) => !v)} hitSlop={8}>
            <View style={[styles.checkbox, alwaysShow && styles.checkboxActive]}>
              {alwaysShow ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.checkLabel}>Show this guide every time I log in</Text>
          </Pressable>

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
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, paddingHorizontal: 2 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface,
  },
  checkboxActive: { backgroundColor: c.primary, borderColor: c.primary },
  checkmark: { fontSize: 13, color: c.white, fontFamily: FONTS.displayHeavy },
  checkLabel: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 14, color: c.textSecondary },
});
