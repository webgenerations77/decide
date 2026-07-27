import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useState, useMemo, useRef, useEffect } from 'react';
import { save, KEYS } from '../../services/settingsService';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import ScreenBackground from '../../components/brand/ScreenBackground';
import CTAButton from '../../components/brand/CTAButton';
import SectionLabel from '../../components/brand/SectionLabel';
import BrandLogo from '../../components/brand/BrandLogo';

// ─── Constants ────────────────────────────────────────────────────────────────
// Avatar seeds mirror the picker in screens/SettingsScreen.js — same DiceBear style,
// same seeds, so a choice made here renders identically in Settings.
const AVATAR_STYLE   = 'adventurer';
const AVATAR_OPTIONS = [
  { seed: 'Explorer', skinColor: 'ffdbb4', hairColor: 'cb6820' },
  { seed: 'Nova',     skinColor: 'f2d3b1', hairColor: 'b9a05f' },
  { seed: 'Pepper',   skinColor: 'edb98a', hairColor: '6a4e35' },
  { seed: 'Maverick', skinColor: 'ecad80', hairColor: '0e0e0e' },
  { seed: 'Juniper',  skinColor: '9e5622', hairColor: '796a45' },
  { seed: 'Cocoa',    skinColor: '763900', hairColor: '562306' },
  { seed: 'Sunny',    skinColor: 'f2d3b1', hairColor: '85c2c6' },
  { seed: 'Ziggy',    skinColor: 'edb98a', hairColor: 'afafaf' },
];
const AVATAR_BY_SEED = Object.fromEntries(AVATAR_OPTIONS.map((o) => [o.seed, o]));
const avatarUrl = (seed) => {
  const o = AVATAR_BY_SEED[seed];
  const extra = o ? `&skinColor=${o.skinColor}&hairColor=${o.hairColor}` : '';
  return `https://api.dicebear.com/9.x/${AVATAR_STYLE}/png?seed=${encodeURIComponent(seed)}${extra}&size=96`;
};

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
// Presets rather than the Settings drag-slider — faster on a first-run flow.
// Stores the same plain number (1–50) the slider writes, so both stay compatible.
const DISTANCE_OPTS = [
  { id: 5,  label: '5 mi'  },
  { id: 10, label: '10 mi' },
  { id: 15, label: '15 mi' },
  { id: 25, label: '25 mi' },
  { id: 50, label: '50 mi' },
];
const START_TIMES = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM'];
const END_TIMES   = ['4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'];
const CUISINES = [
  'Italian', 'Mexican', 'Japanese', 'Chinese', 'American', 'Thai', 'Indian',
  'Mediterranean', 'Korean', 'Vietnamese', 'BBQ', 'Seafood', 'Pizza',
];
const DIETARY         = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Halal', 'Kosher', 'Nut-Free'];
const ACTIVITY_STYLES = ['Outdoor', 'Indoor', 'Cultural', 'Nightlife', 'Shopping', 'Sports', 'Wellness', 'Family-Friendly', 'Live Music', 'Arcades', 'Theme Parks', 'Mini-Golf'];
// Both lists persist into the SAME flat KEYS.SENSITIVITIES array, matching Settings.
const FOOD_SENSITIVITIES = ['Peanuts', 'Shellfish', 'Gluten', 'Dairy', 'Eggs', 'Soy', 'Tree Nuts', 'Fish'];
const ENV_SENSITIVITIES  = ['Bees/Stinging Insects', 'Pollen', 'Cut Grass', 'Pet Dander', 'Mold', 'Strong Fragrances'];

const NEURODIVERGENT_CHIP = 'Neurodivergent-friendly';
const TOTAL_STEPS = 5;
const MIN_WINDOW_MINUTES = 180;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeToMinutes(str) {
  const [time, period] = str.split(' ');
  let [hours] = time.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60;
}

const INTERESTS = [
  'Live Music', 'Arcades', 'Hiking', 'Coffee', 'Vinyl Records', 'Thrifting',
  'Tide Pools', 'Breweries', 'Art Galleries', 'Farmers Markets', 'Kayaking',
  'Bookstores', 'Street Food', 'Scenic Drives', 'Museums',
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function Question({ children, style }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={[styles.question, style]}>{children}</Text>;
}

function ProgressDots({ step, total }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressDots}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
        ))}
      </View>
      <Text style={styles.progressText}>Step {step + 1} of {total}</Text>
    </View>
  );
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

  const [step, setStep] = useState(0);
  const scrollRef = useRef(null);

  // Profile
  const [displayName,    setDisplayName]    = useState('');
  const [avatar,         setAvatar]         = useState('Explorer');
  // Terms — onboarding is the only screen every signed-in user must pass through
  // (app/_layout.js routes on @decide/onboardingComplete), so consent is captured here.
  const [tosAccepted,    setTosAccepted]    = useState(false);
  const [tosOnFile,      setTosOnFile]      = useState(false);
  // Travel style
  const [group,          setGroup]          = useState('couple');
  const [budget,         setBudget]         = useState('$$');
  const [pace,           setPace]           = useState('moderate');
  // The day
  const [startTime,      setStartTime]      = useState('11:00 AM');
  const [endTime,        setEndTime]        = useState('8:00 PM');
  const [maxDistance,    setMaxDistance]    = useState(10);
  // Taste — `interests` feeds the discovery scout's taste profile (KEYS.INTERESTS).
  const [cuisines,       setCuisines]       = useState([]);
  const [interests,      setInterests]      = useState([]);
  const [dietary,        setDietary]        = useState([]);
  const [activityStyles, setActivityStyles] = useState([]);
  // Heads-up
  const [sensitivities,  setSensitivities]  = useState([]);
  const [neurodivergent, setNeurodivergent] = useState(false);
  const [notifications,  setNotifications]  = useState(false);

  // Email signups already agreed at registration (app/auth/signup.js). Don't ask twice —
  // and never overwrite the original acceptance timestamp.
  useEffect(() => {
    AsyncStorage.getItem(KEYS.TOS_ACCEPTED)
      .then((existing) => {
        if (existing) { setTosOnFile(true); setTosAccepted(true); }
      })
      .catch(() => {});
  }, []);

  // Written on every exit path out of onboarding, including "Skip for now".
  const persistTos = () =>
    tosOnFile
      ? Promise.resolve()
      : AsyncStorage.setItem(KEYS.TOS_ACCEPTED, new Date().toISOString());

  const toggleIn = (setter) => (value) =>
    setter((prev) => prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]);

  const toggleCuisine     = toggleIn(setCuisines);
  const toggleInterest    = toggleIn(setInterests);
  const toggleDietary     = toggleIn(setDietary);
  const toggleActivity    = toggleIn(setActivityStyles);
  const toggleSensitivity = toggleIn(setSensitivities);

  const validWindow = timeToMinutes(endTime) - timeToMinutes(startTime) >= MIN_WINDOW_MINUTES;
  // Two gates: Terms must be accepted before leaving step 1, and the time window
  // needs at least 3 hours. Every other answer has a usable default.
  const canAdvance = (step !== 0 || tosAccepted) && (step !== 2 || validWindow);
  // Skipping skips the *preferences*, never the Terms.
  const canSkip = tosAccepted;

  const complete = async () => {
    Location.requestForegroundPermissionsAsync().catch(() => {});
    let notifGranted = false;
    if (notifications) {
      const { status } = await Notifications.requestPermissionsAsync().catch(() => ({ status: 'denied' }));
      notifGranted = status === 'granted';
    }
    await persistTos();
    await Promise.all([
      save(KEYS.DISPLAY_NAME,       displayName.trim()),
      save(KEYS.AVATAR,             avatar),
      save(KEYS.DEFAULT_GROUP,      group),
      save(KEYS.DEFAULT_BUDGET,     budget),
      save(KEYS.DEFAULT_PACE,       pace),
      save(KEYS.DEFAULT_START_TIME, startTime),
      save(KEYS.DEFAULT_END_TIME,   endTime),
      save(KEYS.MAX_DISTANCE,       maxDistance),
      save(KEYS.CUISINES,           cuisines),
      save(KEYS.INTERESTS,          interests),
      save(KEYS.DIETARY,            dietary),
      save(KEYS.ACTIVITY_STYLES,    activityStyles),
      save(KEYS.SENSITIVITIES,      sensitivities),
      save(KEYS.NEURODIVERGENT,     neurodivergent),
      save(KEYS.NOTIFICATIONS,      notifGranted),
      AsyncStorage.setItem('@decide/onboardingComplete', 'true'),
    ]);
    router.replace('/(tabs)/plan');
  };

  // Each step reuses one ScrollView, so the previous step's scroll offset carries over.
  // Reset to the top on every transition or the next step opens mid-page.
  const goTo = (updater) => {
    setStep(updater);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const next = () => (step === TOTAL_STEPS - 1 ? complete() : goTo((s) => s + 1));
  const back = () => goTo((s) => Math.max(0, s - 1));

  const skip = async () => {
    if (!canSkip) return;
    await persistTos();
    await AsyncStorage.setItem('@decide/onboardingComplete', 'true');
    router.replace('/(tabs)/plan');
  };

  return (
    <ScreenBackground variant="paper">
      <SafeAreaView style={styles.safeArea}>
        <ProgressDots step={step} total={TOTAL_STEPS} />

        <ScrollView
          ref={scrollRef}
          style={styles.screen}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Step 1 · Welcome + profile ─────────────────────────────────── */}
          {step === 0 && (
            <>
              <View style={styles.hero}>
                <BrandLogo variant="stacked" size={80} />
                <Text style={styles.heroTitle}>Welcome to Decide.</Text>
                <Text style={styles.heroSub}>
                  Your well-traveled friend who always knows the good spots.
                  Tell me a bit about yourself and I'll take care of the rest.
                </Text>
              </View>

              <SectionLabel tone="cobalt" style={styles.sectionSpacing}>Who you are</SectionLabel>
              <Question>What should I call you?</Question>
              <TextInput
                style={styles.textInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
              />

              <Question>Pick an avatar</Question>
              <View style={styles.avatarRow}>
                {AVATAR_OPTIONS.map((o) => (
                  <TouchableOpacity
                    key={o.seed}
                    style={[styles.avatarPill, avatar === o.seed && styles.avatarPillActive]}
                    onPress={() => setAvatar(o.seed)}
                    activeOpacity={0.7}
                  >
                    <Image source={{ uri: avatarUrl(o.seed) }} style={styles.avatarImg} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Terms gate — required before Continue or Skip will move. Hidden only when
                  acceptance is already on file (an email signup that agreed at registration). */}
              {!tosOnFile && (
                <TouchableOpacity
                  style={styles.tosRow}
                  onPress={() => setTosAccepted((v) => !v)}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: tosAccepted }}
                >
                  <View style={[styles.checkbox, tosAccepted && styles.checkboxActive]}>
                    {tosAccepted && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.tosText}>
                    I've read and agree to the{' '}
                    <Text
                      style={styles.tosLink}
                      onPress={(e) => { e.stopPropagation?.(); router.push('/terms'); }}
                    >
                      Terms of Service
                    </Text>
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* ── Step 2 · Travel style ──────────────────────────────────────── */}
          {step === 1 && (
            <>
              <Text style={styles.stepTitle}>Your travel style</Text>
              <SectionLabel tone="cobalt" style={styles.sectionSpacing}>The basics</SectionLabel>

              <Question>Who are you usually with?</Question>
              <PillRow options={GROUP_OPTS} selected={group} onSelect={setGroup} />

              <Question>What's your usual budget range?</Question>
              <PillRow options={BUDGET_OPTS} selected={budget} onSelect={setBudget} />

              <Question>How do you like to move through a day?</Question>
              <PillRow options={PACE_OPTS} selected={pace} onSelect={setPace} />
            </>
          )}

          {/* ── Step 3 · The day ───────────────────────────────────────────── */}
          {step === 2 && (
            <>
              <Text style={styles.stepTitle}>Your ideal day</Text>
              <SectionLabel tone="cobalt" style={styles.sectionSpacing}>Timing & range</SectionLabel>

              <Question>When do you usually get going?</Question>
              <PillRow options={START_TIMES} selected={startTime} onSelect={setStartTime} />

              <Question>When do you usually wrap up?</Question>
              <PillRow options={END_TIMES} selected={endTime} onSelect={setEndTime} />
              {!validWindow && (
                <Text style={styles.validationHint}>⚠ Please allow at least 3 hours</Text>
              )}

              <Question>How far are you willing to travel?</Question>
              <PillRow options={DISTANCE_OPTS} selected={maxDistance} onSelect={setMaxDistance} />
            </>
          )}

          {/* ── Step 4 · Taste ─────────────────────────────────────────────── */}
          {step === 3 && (
            <>
              <Text style={styles.stepTitle}>What you're into</Text>
              <SectionLabel tone="cobalt" style={styles.sectionSpacing}>Food favorites</SectionLabel>
              <Question>Pick any cuisines you love (I'll lean into them)</Question>
              <ChipGrid options={CUISINES} selected={cuisines} onToggle={toggleCuisine} />

              <Question style={styles.spacedQuestion}>Anything you don't eat?</Question>
              <ChipGrid options={DIETARY} selected={dietary} onToggle={toggleDietary} />

              <SectionLabel tone="cobalt" style={styles.sectionSpacing}>How you like to spend a day</SectionLabel>
              <Question>Pick the kinds of places worth your time</Question>
              <ChipGrid options={ACTIVITY_STYLES} selected={activityStyles} onToggle={toggleActivity} />

              {/* Feeds the discovery scout's taste profile — keep in step with the
                  Taste Profile card in Settings. */}
              <SectionLabel tone="cobalt" style={styles.sectionSpacing}>What lights you up?</SectionLabel>
              <Question>Pick anything you're into — I'll hunt for it (add more later in Settings)</Question>
              <ChipGrid options={INTERESTS} selected={interests} onToggle={toggleInterest} />
            </>
          )}

          {/* ── Step 5 · Heads-up + notifications ──────────────────────────── */}
          {step === 4 && (
            <>
              <Text style={styles.stepTitle}>Anything to watch for?</Text>
              <Text style={styles.note}>
                Decide will flag relevant risks on cards — food allergens at restaurants,
                environmental triggers at outdoor spots. Skip anything that doesn't apply.
              </Text>

              <SectionLabel tone="cobalt" style={styles.sectionSpacing}>Food allergens</SectionLabel>
              <ChipGrid options={FOOD_SENSITIVITIES} selected={sensitivities} onToggle={toggleSensitivity} />

              <SectionLabel tone="cobalt" style={styles.sectionSpacing}>Environmental</SectionLabel>
              <ChipGrid options={ENV_SENSITIVITIES} selected={sensitivities} onToggle={toggleSensitivity} />

              <View style={styles.ndSpacing}>
                <ChipGrid
                  options={[NEURODIVERGENT_CHIP]}
                  selected={neurodivergent ? [NEURODIVERGENT_CHIP] : []}
                  onToggle={() => setNeurodivergent((v) => !v)}
                />
              </View>

              <Text style={styles.disclaimer}>
                ⚠ These alerts are informational only. Always verify allergen information
                directly with the venue.
              </Text>

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
            </>
          )}
        </ScrollView>

        {/* ── Fixed bottom CTA ──────────────────────────────────────────────── */}
        <View style={styles.bottomBar}>
          <View style={styles.navRow}>
            {step > 0 && (
              <TouchableOpacity onPress={back} style={styles.backBtn} activeOpacity={0.7}>
                <Text style={styles.backText}>← Back</Text>
              </TouchableOpacity>
            )}
            <View style={styles.navCta}>
              <CTAButton
                variant="cobalt"
                title={step === TOTAL_STEPS - 1 ? "Let's go →" : 'Continue →'}
                onPress={next}
                disabled={!canAdvance}
              />
            </View>
          </View>
          <TouchableOpacity
            onPress={skip}
            style={styles.skipWrap}
            activeOpacity={0.7}
            disabled={!canSkip}
          >
            <Text style={[styles.skipText, !canSkip && styles.skipTextDisabled]}>Skip for now</Text>
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
  content:  { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },

  // Progress
  progressRow: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  progressDots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: {
    width: 24, height: 4, borderRadius: 2, backgroundColor: c.border,
  },
  dotActive: { backgroundColor: c.primary },
  progressText: { fontSize: 12, color: c.textMuted, fontFamily: FONTS.body },

  // Hero (step 1 only)
  hero: { alignItems: 'center', gap: 12, marginBottom: 24 },
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

  // Per-step heading
  stepTitle: {
    fontSize: 24, color: c.textPrimary,
    fontFamily: FONTS.displayHeavy,
    marginTop: 12, marginBottom: 4,
  },

  // Section label spacing (brand SectionLabel handles typography)
  sectionSpacing: { marginTop: 24, marginBottom: 8 },

  // Question labels
  question: {
    fontSize: 15, fontFamily: FONTS.bodySemiBold, color: c.textSecondary,
    marginBottom: 10, lineHeight: 21,
  },
  spacedQuestion: { marginTop: 16 },

  // Name input
  textInput: {
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: c.textPrimary, fontFamily: FONTS.body,
    marginBottom: 20,
  },

  // Avatar picker
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  avatarPill: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: c.surface, borderWidth: 2, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarPillActive: { borderColor: c.primary },
  avatarImg: { width: 52, height: 52, borderRadius: 26 },

  // Single-select pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 16,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  pillActive:     { backgroundColor: c.primary, borderColor: c.primary },
  pillText:       { fontSize: 14, color: c.textSecondary, fontFamily: FONTS.bodyMedium },
  pillTextActive: { color: c.primaryText, fontFamily: FONTS.bodyBold },

  // Multi-select chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  chipActive:     { backgroundColor: c.primary, borderColor: c.primary },
  chipText:       { fontSize: 13, color: c.textSecondary, fontFamily: FONTS.bodyMedium },
  chipTextActive: { color: c.primaryText, fontFamily: FONTS.bodySemiBold },

  // Sensitivities copy
  note: {
    fontSize: 14, color: c.textSecondary, fontFamily: FONTS.body,
    lineHeight: 20, marginTop: 8,
  },
  ndSpacing: { marginTop: 16 },
  disclaimer: {
    fontSize: 12, color: c.textMuted, fontFamily: FONTS.body,
    lineHeight: 17, marginTop: 14,
  },
  validationHint: {
    fontSize: 13, color: c.error, fontFamily: FONTS.bodyMedium, marginBottom: 16, marginTop: -12,
  },

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
  navRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navCta:  { flex: 1 },
  backBtn: {
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16,
    borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
  },
  backText:  { fontSize: 14, color: c.textSecondary, fontFamily: FONTS.bodyMedium },
  skipWrap:  { alignItems: 'center', paddingVertical: 4 },
  skipText:  { color: c.textMuted, fontSize: 14, fontFamily: FONTS.body },
  skipTextDisabled: { opacity: 0.4 },

  // Terms gate
  tosRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginTop: 24, paddingRight: 4,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: c.border, backgroundColor: c.surface,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxActive: { backgroundColor: c.primary, borderColor: c.primary },
  checkmark: { color: c.primaryText, fontSize: 13, fontFamily: FONTS.bodyBold, lineHeight: 16 },
  tosText: {
    flex: 1, fontSize: 14, color: c.textSecondary,
    fontFamily: FONTS.body, lineHeight: 20,
  },
  tosLink: { color: c.primary, fontFamily: FONTS.bodySemiBold },
});
