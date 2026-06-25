import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useState } from 'react';
import { save, KEYS } from '../../services/settingsService';
import { COLORS } from '../../constants/theme';

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
const CUISINES    = [
  'Italian', 'Mexican', 'Japanese', 'American', 'Thai', 'Indian',
  'Mediterranean', 'Korean', 'Vietnamese', 'BBQ', 'Seafood', 'Pizza',
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionLabel({ title }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

function PillRow({ options, selected, onSelect }) {
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.glowWrap}>
            <Text style={styles.emoji}>🎯</Text>
          </View>
          <Text style={styles.appName}>DECIDE</Text>
          <Text style={styles.tagline}>Ditch Stress. Ignite Daily Exploration.</Text>
        </View>

        {/* ── Travel Style ──────────────────────────────────────────────────── */}
        <SectionLabel title="TRAVEL STYLE" />
        <Text style={styles.question}>Who are you usually with?</Text>
        <PillRow options={GROUP_OPTS} selected={group} onSelect={setGroup} />

        <Text style={styles.question}>What's your typical budget?</Text>
        <PillRow options={BUDGET_OPTS} selected={budget} onSelect={setBudget} />

        <Text style={styles.question}>How do you like to move?</Text>
        <PillRow options={PACE_OPTS} selected={pace} onSelect={setPace} />

        {/* ── Your Day ──────────────────────────────────────────────────────── */}
        <SectionLabel title="YOUR DAY" />
        <Text style={styles.question}>When do you usually start?</Text>
        <PillRow options={START_TIMES} selected={startTime} onSelect={setStartTime} />

        <Text style={styles.question}>When do you usually wrap up?</Text>
        <PillRow options={END_TIMES} selected={endTime} onSelect={setEndTime} />

        {/* ── Food Favorites ────────────────────────────────────────────────── */}
        <SectionLabel title="FOOD FAVORITES" />
        <Text style={styles.question}>Pick any cuisines you love</Text>
        <ChipGrid options={CUISINES} selected={cuisines} onToggle={toggleCuisine} />

        {/* ── App Defaults ──────────────────────────────────────────────────── */}
        <SectionLabel title="APP DEFAULTS" />
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Push Notifications</Text>
            <Text style={styles.toggleSub}>Daily inspiration and reminders</Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: COLORS.border, true: COLORS.teal }}
            thumbColor={notifications ? COLORS.primaryText : COLORS.textMuted}
          />
        </View>
      </ScrollView>

      {/* ── Fixed bottom CTA ──────────────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.cta} onPress={complete} activeOpacity={0.7}>
          <Text style={styles.ctaText}>Let's Go →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={skip} style={styles.skipWrap} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  screen:   { flex: 1 },
  content:  { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },

  // Hero
  hero: { alignItems: 'center', gap: 8, marginBottom: 28 },
  glowWrap: {
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 24, elevation: 18,
  },
  emoji:   { fontSize: 80 },
  appName: { fontSize: 32, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: 8 },
  tagline: {
    fontSize: 14, color: COLORS.gold, textAlign: 'center',
    fontWeight: '600', lineHeight: 20, maxWidth: 280,
  },

  // Section labels
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.gold,
    letterSpacing: 2.5, marginTop: 20, marginBottom: 8,
    textTransform: 'uppercase',
  },

  // Question labels
  question: {
    fontSize: 15, fontWeight: '600', color: COLORS.textSecondary,
    marginBottom: 8,
  },

  // Single-select pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  pillActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText:       { fontSize: 14, color: COLORS.teal, fontWeight: '500' },
  pillTextActive: { color: COLORS.primaryText, fontWeight: '700' },

  // Multi-select cuisine chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive:     { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  chipText:       { fontSize: 13, color: COLORS.teal, fontWeight: '500' },
  chipTextActive: { color: COLORS.bg, fontWeight: '600' },

  // Notifications row
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  toggleInfo:  { flex: 1, marginRight: 16 },
  toggleLabel: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600', marginBottom: 2 },
  toggleSub:   { fontSize: 13, color: COLORS.teal },

  // Fixed bottom bar
  bottomBar: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20,
    gap: 10, backgroundColor: COLORS.bg,
    borderTopWidth: 0.5, borderTopColor: COLORS.border,
  },
  cta: {
    backgroundColor: COLORS.primary, borderRadius: 16,
    height: 56, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 14, elevation: 10,
  },
  ctaText:  { color: COLORS.primaryText, fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  skipWrap: { alignItems: 'center', paddingVertical: 4 },
  skipText: { color: COLORS.teal, fontSize: 14 },
});
