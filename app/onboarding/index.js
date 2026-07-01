import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useState, useMemo } from 'react';
import { save, KEYS } from '../../services/settingsService';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import ScreenBackground from '../../components/brand/ScreenBackground';
import CTAButton from '../../components/brand/CTAButton';
import SectionLabel from '../../components/brand/SectionLabel';
import BrandLogo from '../../components/brand/BrandLogo';

// ─── Constants ────────────────────────────────────────────────────────────────
const GROUP_OPTS = [
  { id: 'solo',    label: 'Solo',    emoji: '🧍' },
  { id: 'couple',  label: 'Couple',  emoji: '👫' },
  { id: 'family',  label: 'Family',  emoji: '👨‍👩‍👧' },
  { id: 'friends', label: 'Friends', emoji: '👥' },
];
const BUDGET_OPTS = [
  { id: '$',    label: '$'    },
  { id: '$$',   label: '$$'   },
  { id: '$$$',  label: '$$$'  },
  { id: '$$$$', label: '$$$$' },
];
const PACE_OPTS = [
  { id: 'relaxed',  label: 'Relaxed',  emoji: '🌿' },
  { id: 'moderate', label: 'Moderate', emoji: '⚡' },
  { id: 'packed',   label: 'Packed',   emoji: '🔥' },
];
const START_TIMES = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM'];
const END_TIMES   = ['4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'];
const CUISINES = [
  'Italian', 'Mexican', 'Japanese', 'Chinese', 'American', 'Thai', 'Indian',
  'Mediterranean', 'Korean', 'Vietnamese', 'BBQ', 'Seafood', 'Pizza',
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function Question({ children }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={styles.question}>{children}</Text>;
}

function PillRow({ options, selected, onSelect }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.pillRow}>
      {options.map((opt) => {
        const val  = opt.id    ?? opt;
        const text = opt.emoji ? `${opt.emoji} ${opt.label}` : (opt.label ?? opt);
        const active = selected === val;
        return (
          <TouchableOpacity
            key={val}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onSelect(val)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{text}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ChipGrid({ options, selected, onToggle }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.chipGrid}>
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onToggle(opt)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [group,         setGroup]         = useState('couple');
  const [budget,        setBudget]        = useState('$$');
  const [pace,          setPace]          = useState('moderate');
  const [startTime,     setStartTime]     = useState('11:00 AM');
  const [endTime,       setEndTime]       = useState('8:00 PM');
  const [cuisines,      setCuisines]      = useState([]);
  const [notifications, setNotifications] = useState(false);

  const toggleCuisine = (c) =>
    setCuisines((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const complete = async () => {
    Location.requestForegroundPermissionsAsync().catch(() => {});
    let notifGranted = false;
    if (notifications) {
      const { status } = await Notifications.requestPermissionsAsync().catch(() => ({ status: 'denied' }));
      notifGranted = status === 'granted';
    }
    await Promise.all([
      save(KEYS.DEFAULT_GROUP,      group),
      save(KEYS.DEFAULT_BUDGET,     budget),
      save(KEYS.DEFAULT_PACE,       pace),
      save(KEYS.DEFAULT_START_TIME, startTime),
      save(KEYS.DEFAULT_END_TIME,   endTime),
      save(KEYS.CUISINES,           cuisines),
      save(KEYS.NOTIFICATIONS,      notifGranted),
      AsyncStorage.setItem('@decide/onboardingComplete', 'true'),
    ]);
    router.replace('/(tabs)/plan');
  };

  const skip = async () => {
    await AsyncStorage.setItem('@decide/onboardingComplete', 'true');
    router.replace('/(tabs)/plan');
  };

  return (
    <ScreenBackground variant="paper">
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Hero ──────────────────────────────────────────────────────────── */}
          <View style={styles.hero}>
            <BrandLogo variant="stacked" size={80} />
            <Text style={styles.heroTitle}>Welcome to Decide.</Text>
            <Text style={styles.heroSub}>
              Your well-traveled friend who always knows the good spots.
              Tell me a bit about yourself and I'll take care of the rest.
            </Text>
          </View>

          {/* ── Travel Style ──────────────────────────────────────────────────── */}
          <SectionLabel tone="cobalt" style={styles.sectionSpacing}>Your travel style</SectionLabel>
          <Question>Who are you usually with?</Question>
          <PillRow options={GROUP_OPTS} selected={group} onSelect={setGroup} />

          <Question>What's your usual budget range?</Question>
          <PillRow options={BUDGET_OPTS} selected={budget} onSelect={setBudget} />

          <Question>How do you like to move through a day?</Question>
          <PillRow options={PACE_OPTS} selected={pace} onSelect={setPace} />

          {/* ── Your Day ──────────────────────────────────────────────────────── */}
          <SectionLabel tone="cobalt" style={styles.sectionSpacing}>Your ideal day</SectionLabel>
          <Question>When do you usually get going?</Question>
          <PillRow options={START_TIMES} selected={startTime} onSelect={setStartTime} />

          <Question>When do you usually wrap up?</Question>
          <PillRow options={END_TIMES} selected={endTime} onSelect={setEndTime} />

          {/* ── Food Favorites ────────────────────────────────────────────────── */}
          <SectionLabel tone="cobalt" style={styles.sectionSpacing}>Food favorites</SectionLabel>
          <Question>Pick any cuisines you love (I'll lean into them)</Question>
          <ChipGrid options={CUISINES} selected={cuisines} onToggle={toggleCuisine} />

          {/* ── Notifications ─────────────────────────────────────────────────── */}
          <SectionLabel tone="cobalt" style={styles.sectionSpacing}>Stay in the know</SectionLabel>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Morning inspiration</Text>
              <Text style={styles.toggleSub}>Decide can send you a daily nudge to plan your day</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={notifications ? colors.surface : colors.textMuted}
            />
          </View>
        </ScrollView>

        {/* ── Fixed bottom CTA ──────────────────────────────────────────────── */}
        <View style={styles.bottomBar}>
          <CTAButton variant="cobalt" title="Let's go →" onPress={complete} />
          <TouchableOpacity onPress={skip} style={styles.skipWrap} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (c) => StyleSheet.create({
  safeArea: { flex: 1 },
  screen:   { flex: 1 },
  content:  { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },

  // Hero
  hero: { alignItems: 'center', gap: 12, marginBottom: 32 },
  heroTitle: {
    fontSize: 28, color: c.textPrimary,
    fontFamily: FONTS.displayHeavy,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 15, color: c.textSecondary,
    fontFamily: FONTS.body,
    textAlign: 'center', lineHeight: 22, maxWidth: 300,
  },

  // Section label spacing (brand SectionLabel handles typography)
  sectionSpacing: { marginTop: 24, marginBottom: 8 },

  // Question labels
  question: {
    fontSize: 15, fontFamily: FONTS.bodySemiBold, color: c.textSecondary,
    marginBottom: 10, lineHeight: 21,
  },

  // Single-select pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 16,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  pillActive:     { backgroundColor: c.primary, borderColor: c.primary },
  pillText:       { fontSize: 14, color: c.textSecondary, fontFamily: FONTS.bodyMedium },
  pillTextActive: { color: c.primaryText, fontFamily: FONTS.bodyBold },

  // Multi-select cuisine chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  chipActive:     { backgroundColor: c.primary, borderColor: c.primary },
  chipText:       { fontSize: 13, color: c.textSecondary, fontFamily: FONTS.bodyMedium },
  chipTextActive: { color: c.primaryText, fontFamily: FONTS.bodySemiBold },

  // Notifications row
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.surface, borderRadius: 16,
    borderWidth: 1, borderColor: c.border,
    paddingHorizontal: 16, paddingVertical: 16,
    marginBottom: 8,
  },
  toggleInfo:  { flex: 1, marginRight: 16 },
  toggleLabel: { fontSize: 15, color: c.textPrimary, fontFamily: FONTS.bodySemiBold, marginBottom: 3 },
  toggleSub:   { fontSize: 13, color: c.textMuted, fontFamily: FONTS.body, lineHeight: 18 },

  // Fixed bottom bar
  bottomBar: {
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24,
    gap: 10, backgroundColor: c.bg,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  skipWrap: { alignItems: 'center', paddingVertical: 4 },
  skipText: { color: c.textMuted, fontSize: 14, fontFamily: FONTS.body },
});
