import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Switch, ActivityIndicator, Modal, PanResponder, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { loadAllSettings, save, KEYS } from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { isPro, getDecisionCount, getSpinCount, LIMITS } from '../services/subscriptionService';
import { scheduleDailyReminder, cancelDailyReminder, loadReminderTime } from '../services/notificationService';
import { COLORS } from '../constants/theme';

function getApiBase() {
  if (Platform.OS === 'web') return '';
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri.split(':')[0]}:8081`;
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
}

// ─── Constants ────────────────────────────────────────────────────────────────
const AVATARS         = ['🧭', '🎯', '🎲', '🌮', '🎭', '🏄', '🎸', '🌟'];
const CUISINES        = ['Italian', 'Mexican', 'Japanese', 'American', 'Thai', 'Indian', 'Mediterranean', 'Korean', 'Vietnamese', 'BBQ', 'Seafood', 'Pizza'];
const DIETARY         = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Halal', 'Kosher', 'Nut-Free'];
const ACTIVITY_STYLES = ['Outdoor', 'Indoor', 'Cultural', 'Nightlife', 'Shopping', 'Sports', 'Wellness', 'Family-Friendly'];

const FOOD_SENSITIVITIES = ['Peanuts', 'Shellfish', 'Gluten', 'Dairy', 'Eggs', 'Soy', 'Tree Nuts', 'Fish'];
const ENV_SENSITIVITIES  = ['Bees/Stinging Insects', 'Pollen', 'Cut Grass', 'Pet Dander', 'Mold', 'Strong Fragrances'];

const PACE_OPTIONS   = [
  { id: 'relaxed',  label: 'Relaxed',  emoji: '🌿' },
  { id: 'moderate', label: 'Moderate', emoji: '⚡' },
  { id: 'packed',   label: 'Packed',   emoji: '🔥' },
];
const BUDGET_OPTIONS = [
  { id: '$',    label: '$'    },
  { id: '$$',   label: '$$'   },
  { id: '$$$',  label: '$$$'  },
  { id: '$$$$', label: '$$$$' },
];
const GROUP_OPTIONS  = [
  { id: 'solo',    label: 'Solo',    emoji: '🧍' },
  { id: 'couple',  label: 'Couple',  emoji: '👫' },
  { id: 'family',  label: 'Family',  emoji: '👨‍👩‍👧' },
  { id: 'friends', label: 'Friends', emoji: '👥' },
];
const START_TIMES = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM'];
const END_TIMES   = ['4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'];

const MAX_DISTANCE_MILES = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeToMinutes(str) {
  const [time, period] = str.split(' ');
  let [hours] = time.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60;
}

// Proxies through server-side route — avoids CORS issues and keeps key server-side
async function searchLocation(text) {
  if (!text || text.length < 3) return null;
  const base = getApiBase();
  try {
    const res  = await fetch(`${base}/api/geocode?q=${encodeURIComponent(text)}`);
    const data = await res.json();
    if (data.error === 'api_key' || data.error === 'api_key_missing') return { error: 'api_key' };
    if (!data.results?.length) return { error: 'not_found' };
    return data.results;
  } catch {
    return { error: 'network' };
  }
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
function SectionHeader({ title }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── ChipGrid ─────────────────────────────────────────────────────────────────
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

// ─── PillRow ──────────────────────────────────────────────────────────────────
function PillRow({ options, selected, onSelect }) {
  return (
    <View style={styles.pillsRow}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.id}
          style={[styles.prefPill, selected === o.id && styles.prefPillActive]}
          onPress={() => onSelect(o.id)}
          activeOpacity={0.7}
        >
          <Text style={[styles.prefPillText, selected === o.id && styles.prefPillTextActive]}>
            {o.emoji ? `${o.emoji} ` : ''}{o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── TimePickerPill ───────────────────────────────────────────────────────────
function TimePickerPill({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.timePill} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={styles.timePillLabel}>{label.toUpperCase()}</Text>
        <View style={styles.timePillInner}>
          <Text style={styles.timePillValue}>{value}</Text>
          <Text style={styles.timePillChevron}>▾</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{label.toUpperCase()} TIME</Text>
              {options.map((opt, i) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.modalOption,
                    opt === value && styles.modalOptionActive,
                    i === options.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => { onChange(opt); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalOptionText, opt === value && styles.modalOptionTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── DistanceSlider — range 1–50 mi ──────────────────────────────────────────
function DistanceSlider({ value, onChange }) {
  const widthRef = useRef(1);
  const cbRef    = useRef(onChange);
  cbRef.current  = onChange;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const r = Math.max(0, Math.min(1, e.nativeEvent.locationX / widthRef.current));
        cbRef.current(Math.round(1 + r * (MAX_DISTANCE_MILES - 1)));
      },
      onPanResponderMove: (e) => {
        const r = Math.max(0, Math.min(1, e.nativeEvent.locationX / widthRef.current));
        cbRef.current(Math.round(1 + r * (MAX_DISTANCE_MILES - 1)));
      },
    })
  ).current;

  const pct = `${((value - 1) / (MAX_DISTANCE_MILES - 1)) * 100}%`;

  return (
    <View
      style={styles.sliderTrack}
      onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}
    >
      <View style={[styles.sliderFill, { width: pct }]} />
      <View
        style={[styles.sliderThumb, { left: pct, transform: [{ translateX: -14 }] }]}
        pointerEvents="none"
      />
    </View>
  );
}

// ─── SettingsScreen ───────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [loaded,         setLoaded]         = useState(false);
  const [displayName,    setDisplayName]    = useState('');
  const [avatar,         setAvatar]         = useState('🎯');
  const [locationMode,   setLocationMode]   = useState('auto');
  const [manualText,     setManualText]     = useState('');
  const [geocodedLoc,    setGeocodedLoc]    = useState(null);
  const [geocoding,         setGeocoding]         = useState(false);
  const [geocodeErr,        setGeocodeErr]        = useState(null);
  const [geocodeSuggestions,setGeocodeSuggestions] = useState([]);
  const [cuisines,       setCuisines]       = useState([]);
  const [dietary,        setDietary]        = useState([]);
  const [activityStyles, setActivityStyles] = useState([]);
  const [sensitivities,  setSensitivities]  = useState([]);
  const [maxDistance,    setMaxDistance]    = useState(10);
  const [pace,           setPace]           = useState('moderate');
  const [budget,         setBudget]         = useState('$$');
  const [group,          setGroup]          = useState('couple');
  const [startTime,      setStartTime]      = useState('11:00 AM');
  const [endTime,        setEndTime]        = useState('8:00 PM');
  const [notifications,  setNotifications]  = useState(false);
  const [demoMode,       setDemoMode]       = useState(false);
  const [toastMsg,       setToastMsg]       = useState(null);
  const [proStatus,        setProStatus]        = useState(false);
  const [usageDecisions,   setUsageDecisions]   = useState(0);
  const [usageSpins,       setUsageSpins]       = useState(0);
  const [reminderHour,     setReminderHour]     = useState(9);
  const [reminderMinute,   setReminderMinute]   = useState(0);
  const [showSignOutModal,    setShowSignOutModal]    = useState(false);
  const [showClearHistModal,  setShowClearHistModal]  = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  const geocodeTimer = useRef(null);

  useEffect(() => {
    (async () => {
      const s = await loadAllSettings();
      setDisplayName(s.displayName);
      setAvatar(s.avatar);
      setLocationMode(s.locationMode);
      if (s.manualLocation) {
        setManualText(s.manualLocation.text ?? s.manualLocation.label ?? '');
        setGeocodedLoc(s.manualLocation);
      }
      setCuisines(s.cuisines);
      setDietary(s.dietary);
      setActivityStyles(s.activityStyles);
      setSensitivities(s.sensitivities ?? []);
      setMaxDistance(s.maxDistance);
      setPace(s.pace);
      setBudget(s.budget);
      setGroup(s.group);
      setStartTime(s.startTime);
      setEndTime(s.endTime);
      setNotifications(s.notifications);
      const demoRaw = await AsyncStorage.getItem('@decide/demo_mode').catch(() => null);
      setDemoMode(demoRaw === 'true');
      setLoaded(true);
      isPro().then(setProStatus).catch(() => {});
      getDecisionCount().then(setUsageDecisions).catch(() => {});
      getSpinCount().then(setUsageSpins).catch(() => {});
      loadReminderTime().then((t) => {
        if (t) { setReminderHour(t.hour); setReminderMinute(t.minute); }
      }).catch(() => {});
    })();
  }, []);

  useEffect(() => {
    if (demoMode) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [demoMode]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDisplayName  = (v) => { setDisplayName(v);  save(KEYS.DISPLAY_NAME, v); };
  const handleAvatar       = (v) => { setAvatar(v);        save(KEYS.AVATAR, v); };
  const handleLocationMode = (v) => { setLocationMode(v);  save(KEYS.LOCATION_MODE, v); };

  const handleManualText = (text) => {
    setManualText(text);
    setGeocodedLoc(null);
    setGeocodeSuggestions([]);
    setGeocodeErr(null);
    clearTimeout(geocodeTimer.current);
    if (text.length < 3) return;
    geocodeTimer.current = setTimeout(async () => {
      setGeocoding(true);
      const result = await searchLocation(text);
      setGeocoding(false);
      if (Array.isArray(result)) {
        setGeocodeSuggestions(result);
        setGeocodeErr(null);
      } else if (result === null) {
        setGeocodeErr('Location search not available — try again');
      } else if (result?.error === 'not_found') {
        setGeocodeErr('Location not found — try being more specific');
      } else if (result?.error === 'api_key') {
        setGeocodeErr('Location search not configured — contact support');
      } else if (result?.error === 'network') {
        setGeocodeErr('Connection error — check your internet');
      } else {
        setGeocodeErr('Could not find location — try again');
      }
    }, 600);
  };

  const handleSelectSuggestion = (suggestion) => {
    const loc = { text: manualText, ...suggestion };
    setGeocodedLoc(loc);
    setGeocodeSuggestions([]);
    setGeocodeErr(null);
    save(KEYS.MANUAL_LOCATION, loc);
  };

  const handleClearManualLocation = () => {
    setManualText('');
    setGeocodedLoc(null);
    setGeocodeSuggestions([]);
    setGeocodeErr(null);
    clearTimeout(geocodeTimer.current);
    AsyncStorage.removeItem(KEYS.MANUAL_LOCATION).catch(() => {});
    handleLocationMode('auto');
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleDemoToggle = async (val) => {
    setDemoMode(val);
    await AsyncStorage.setItem('@decide/demo_mode', val ? 'true' : 'false');
    if (val) {
      const berlinLoc = { latitude: 38.3226, longitude: -75.2179, short: 'Berlin, MD', label: 'Berlin, MD', text: 'Berlin, MD' };
      await AsyncStorage.setItem('@decide/manual_location', JSON.stringify(berlinLoc));
      await AsyncStorage.setItem('@decide/location_mode', 'manual');
      setLocationMode('manual');
      setManualText('Berlin, MD');
      setGeocodedLoc(berlinLoc);
      showToast('Demo mode on — using Berlin, MD sample data');
    } else {
      await AsyncStorage.setItem('@decide/location_mode', 'auto');
      await AsyncStorage.removeItem('@decide/manual_location');
      setLocationMode('auto');
      setManualText('');
      setGeocodedLoc(null);
      showToast('Demo mode off — using real data');
    }
  };

  const toggleCuisine      = (id) => { const next = cuisines.includes(id) ? cuisines.filter((x) => x !== id) : [...cuisines, id]; setCuisines(next); save(KEYS.CUISINES, next); };
  const toggleDietary      = (id) => { const next = dietary.includes(id) ? dietary.filter((x) => x !== id) : [...dietary, id]; setDietary(next); save(KEYS.DIETARY, next); };
  const toggleActivity     = (id) => { const next = activityStyles.includes(id) ? activityStyles.filter((x) => x !== id) : [...activityStyles, id]; setActivityStyles(next); save(KEYS.ACTIVITY_STYLES, next); };
  const toggleSensitivity  = (id) => { const next = sensitivities.includes(id) ? sensitivities.filter((x) => x !== id) : [...sensitivities, id]; setSensitivities(next); save(KEYS.SENSITIVITIES, next); };

  const handleDistance = (v) => { setMaxDistance(v); save(KEYS.MAX_DISTANCE, v); };
  const handlePace     = (v) => { setPace(v);        save(KEYS.DEFAULT_PACE, v); };
  const handleBudget   = (v) => { setBudget(v);      save(KEYS.DEFAULT_BUDGET, v); };
  const handleGroup    = (v) => { setGroup(v);       save(KEYS.DEFAULT_GROUP, v); };
  const handleStart    = (v) => { setStartTime(v);   save(KEYS.DEFAULT_START_TIME, v); };
  const handleEnd      = (v) => { setEndTime(v);     save(KEYS.DEFAULT_END_TIME, v); };
  const handleNotif = async (v) => {
    if (v) {
      const { status } = await Notifications.requestPermissionsAsync().catch(() => ({ status: 'denied' }));
      const granted = status === 'granted';
      setNotifications(granted);
      save(KEYS.NOTIFICATIONS, granted);
      if (granted) {
        scheduleDailyReminder(reminderHour, reminderMinute).catch(() => {});
      } else {
        Alert.alert('Notifications blocked', 'Enable notifications in your device Settings to allow this.');
      }
    } else {
      setNotifications(false);
      save(KEYS.NOTIFICATIONS, false);
      cancelDailyReminder().catch(() => {});
    }
  };

  const handleReminderTime = (hour, minute) => {
    setReminderHour(hour);
    setReminderMinute(minute);
    if (notifications) {
      scheduleDailyReminder(hour, minute).catch(() => {});
    }
  };

  const validWindow = timeToMinutes(endTime) - timeToMinutes(startTime) >= 180;

  if (!loaded) {
    return (
      <SafeAreaView style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator color={COLORS.amber} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>Settings</Text>

        {/* ── Demo Mode ──────────────────────────────────────────────────── */}
        <View style={styles.demoCard}>
          <View style={styles.demoToggleRow}>
            <View style={styles.demoLabelGroup}>
              <View style={styles.demoLabelRow}>
                {demoMode && (
                  <Animated.View style={[styles.demoDot, { opacity: pulseAnim }]} />
                )}
                <Text style={styles.demoLabel}>Demo Mode</Text>
              </View>
              <Text style={styles.demoSub}>Simulates a full day in Berlin, MD — no API calls</Text>
            </View>
            <Switch
              value={demoMode}
              onValueChange={handleDemoToggle}
              trackColor={{ false: COLORS.border, true: COLORS.amber }}
              thumbColor={demoMode ? COLORS.amber : COLORS.textMuted}
            />
          </View>
          {demoMode && (
            <View style={styles.demoInfoCard}>
              <Text style={styles.demoInfoText}>
                🎭 All results are hardcoded sample data from the Eastern Shore of Maryland. Spin, plan, and explore the full app experience without spending any API credits.
              </Text>
            </View>
          )}
        </View>

        {/* ── Profile ─────────────────────────────────────────────────────── */}
        <SectionHeader title="PROFILE" />
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
          <TextInput
            style={styles.textInput}
            value={displayName}
            onChangeText={handleDisplayName}
            placeholder="Your name"
            placeholderTextColor={COLORS.textMuted}
            returnKeyType="done"
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>AVATAR</Text>
          <View style={styles.avatarRow}>
            {AVATARS.map((e) => (
              <TouchableOpacity
                key={e}
                style={[styles.avatarPill, avatar === e && styles.avatarPillActive]}
                onPress={() => handleAvatar(e)}
                activeOpacity={0.7}
              >
                <Text style={styles.avatarEmoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Subscription ─────────────────────────────────────────────── */}
        <SectionHeader title="SUBSCRIPTION" />
        <View style={styles.card}>
          <View style={styles.appRow}>
            <Text style={styles.appRowLabel}>Plan</Text>
            <Text style={[styles.appRowValue, proStatus && { color: COLORS.amber }]}>
              {proStatus ? '👑 Decide Pro' : 'Free'}
            </Text>
          </View>
          {!proStatus && (
            <>
              <View style={[styles.appRow, styles.appRowBorder]}>
                <Text style={styles.appRowLabel}>Decisions today</Text>
                <Text style={styles.appRowValue}>{usageDecisions}/{LIMITS.FREE_DECISIONS_PER_DAY}</Text>
              </View>
              <View style={[styles.appRow, styles.appRowBorder]}>
                <Text style={styles.appRowLabel}>Spins today</Text>
                <Text style={styles.appRowValue}>{usageSpins}/{LIMITS.FREE_SPINS_PER_DAY}</Text>
              </View>
              <TouchableOpacity
                style={[styles.appRow, styles.appRowBorder]}
                activeOpacity={0.7}
                onPress={() => router.push('/paywall')}
              >
                <Text style={[styles.appRowLabel, { color: COLORS.amber }]}>Upgrade to Pro</Text>
                <Text style={styles.appRowChevron}>›</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── Location ───────────────────────────────────────────────────── */}
        <SectionHeader title="LOCATION" />
        <View style={styles.locationCard}>
          <View style={styles.modeRow}>
            {[
              { id: 'auto',   label: '📍 Auto-Detect' },
              { id: 'manual', label: '📌 Manual' },
            ].map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.modePill, locationMode === m.id && styles.modePillActive]}
                onPress={() => handleLocationMode(m.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modePillText, locationMode === m.id && styles.modePillTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {locationMode === 'manual' && (
            <View style={styles.manualBlock}>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  value={manualText}
                  onChangeText={handleManualText}
                  placeholder="City, address, or zip code"
                  placeholderTextColor={COLORS.textMuted}
                  returnKeyType="search"
                />
                {(manualText.length > 0 || geocodedLoc) && (
                  <TouchableOpacity style={styles.clearBtn} onPress={handleClearManualLocation} activeOpacity={0.7}>
                    <Text style={styles.clearBtnTxt}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              {geocoding && (
                <View style={styles.geocodeRow}>
                  <ActivityIndicator size="small" color={COLORS.textMuted} />
                  <Text style={styles.geocodeStatus}>Finding location…</Text>
                </View>
              )}
              {!geocoding && geocodeSuggestions.length > 0 && (
                <View style={styles.suggestionsOverlay}>
                  {geocodeSuggestions.map((s, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.suggestionRow, i < geocodeSuggestions.length - 1 && styles.suggestionRowBorder]}
                      onPress={() => handleSelectSuggestion(s)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestionText}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {!geocoding && geocodeSuggestions.length === 0 && geocodedLoc && (
                <Text style={styles.geocodeSuccess}>📍 {geocodedLoc.short ?? geocodedLoc.label}</Text>
              )}
              {!geocoding && geocodeErr && (
                <Text style={styles.geocodeError}>⚠ {geocodeErr}</Text>
              )}
            </View>
          )}
        </View>

        {/* ── Food Preferences ──────────────────────────────────────────── */}
        <SectionHeader title="FOOD PREFERENCES" />
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>CUISINES</Text>
          <ChipGrid options={CUISINES} selected={cuisines} onToggle={toggleCuisine} />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>DIETARY RESTRICTIONS</Text>
          <ChipGrid options={DIETARY} selected={dietary} onToggle={toggleDietary} />
        </View>

        {/* ── Sensitivities & Allergies ─────────────────────────────────── */}
        <SectionHeader title="SENSITIVITIES & ALLERGIES" />
        <View style={styles.card}>
          <Text style={styles.sensitivityNote}>
            Cheddar will flag relevant risks on cards — food allergens at restaurants, environmental triggers at outdoor spots.
          </Text>
          <Text style={styles.fieldLabel}>FOOD ALLERGENS</Text>
          <ChipGrid options={FOOD_SENSITIVITIES} selected={sensitivities} onToggle={toggleSensitivity} />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>ENVIRONMENTAL</Text>
          <ChipGrid options={ENV_SENSITIVITIES} selected={sensitivities} onToggle={toggleSensitivity} />

          <Text style={styles.sensitivityDisclaimer}>
            ⚠ These alerts are informational only. Always verify allergen information directly with the venue.
          </Text>
        </View>

        {/* ── Activity Preferences ──────────────────────────────────────── */}
        <SectionHeader title="ACTIVITY PREFERENCES" />
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>ACTIVITY STYLE</Text>
          <ChipGrid options={ACTIVITY_STYLES} selected={activityStyles} onToggle={toggleActivity} />

          <View style={styles.distanceHeader}>
            <Text style={[styles.fieldLabel, { marginTop: 0, marginBottom: 0 }]}>MAX TRAVEL DISTANCE</Text>
            <Text style={styles.distanceValue}>Within {maxDistance} mi</Text>
          </View>
          <DistanceSlider value={maxDistance} onChange={handleDistance} />
          <View style={styles.distanceTicks}>
            <Text style={styles.distanceTick}>1 mi</Text>
            <Text style={styles.distanceTick}>25 mi</Text>
            <Text style={styles.distanceTick}>50 mi</Text>
          </View>
        </View>

        {/* ── Default Plan Preferences ───────────────────────────────────── */}
        <SectionHeader title="DEFAULT PLAN PREFERENCES" />
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>PACE</Text>
          <PillRow options={PACE_OPTIONS} selected={pace} onSelect={handlePace} />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>BUDGET</Text>
          <PillRow options={BUDGET_OPTIONS} selected={budget} onSelect={handleBudget} />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>GROUP</Text>
          <PillRow options={GROUP_OPTIONS} selected={group} onSelect={handleGroup} />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>TIME WINDOW</Text>
          <View style={styles.timePickerRow}>
            <TimePickerPill label="Start" value={startTime} options={START_TIMES} onChange={handleStart} />
            <Text style={styles.timeArrow}>→</Text>
            <TimePickerPill label="End"   value={endTime}   options={END_TIMES}   onChange={handleEnd} />
          </View>
          {!validWindow && (
            <Text style={styles.timeValidationHint}>⚠ Please allow at least 3 hours</Text>
          )}
        </View>

        {/* ── App ───────────────────────────────────────────────────────── */}
        <SectionHeader title="APP" />
        <View style={styles.card}>
          <View style={styles.appRow}>
            <Text style={styles.appRowLabel}>Notifications</Text>
            <Switch
              value={notifications}
              onValueChange={handleNotif}
              trackColor={{ false: COLORS.border, true: COLORS.amber }}
              thumbColor={notifications ? COLORS.amber : COLORS.textMuted}
            />
          </View>
          {notifications && (
            <View style={[styles.appRow, styles.appRowBorder]}>
              <Text style={styles.appRowLabel}>Daily reminder</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[
                  { h: 7, m: 0, label: '7 AM' },
                  { h: 8, m: 0, label: '8 AM' },
                  { h: 9, m: 0, label: '9 AM' },
                  { h: 10, m: 0, label: '10 AM' },
                  { h: 12, m: 0, label: '12 PM' },
                ].map((t) => (
                  <TouchableOpacity
                    key={t.label}
                    style={[
                      styles.modePill,
                      { flex: 0, paddingHorizontal: 10, paddingVertical: 6 },
                      reminderHour === t.h && reminderMinute === t.m && styles.modePillActive,
                    ]}
                    onPress={() => handleReminderTime(t.h, t.m)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.modePillText,
                      { fontSize: 11 },
                      reminderHour === t.h && reminderMinute === t.m && styles.modePillTextActive,
                    ]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.appRow, styles.appRowBorder]}
            activeOpacity={0.7}
            onPress={() => setShowClearHistModal(true)}
          >
            <Text style={[styles.appRowLabel, { color: COLORS.error }]}>Clear History</Text>
            <Text style={styles.appRowChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.appRow, styles.appRowBorder]}
            activeOpacity={0.7}
            onPress={async () => {
              await AsyncStorage.removeItem('@decide/onboardingComplete');
              router.replace('/onboarding');
            }}
          >
            <Text style={[styles.appRowLabel, { color: COLORS.primary }]}>Reset Onboarding</Text>
            <Text style={styles.appRowChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.appRow, styles.appRowBorder]}
            activeOpacity={0.7}
            onPress={() => router.push('/terms')}
          >
            <Text style={styles.appRowLabel}>Terms of Service</Text>
            <Text style={styles.appRowChevron}>›</Text>
          </TouchableOpacity>

          <View style={[styles.appRow, styles.appRowBorder]}>
            <Text style={styles.appRowLabel}>Version</Text>
            <Text style={styles.appRowValue}>Decide v1.0.0</Text>
          </View>
        </View>

        {/* ── Account ─────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.card}>
          {user?.email && (
            <View style={styles.appRow}>
              <Text style={styles.appRowLabel}>Email</Text>
              <Text style={styles.appRowValue}>{user.email}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.appRow, user?.email ? styles.appRowBorder : null]}
            activeOpacity={0.7}
            onPress={() => setShowSignOutModal(true)}
          >
            <Text style={[styles.appRowLabel, { color: COLORS.error }]}>Sign Out</Text>
            <Text style={styles.appRowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>

      {toastMsg && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}

      {/* Sign Out confirmation modal */}
      <Modal visible={showSignOutModal} transparent animationType="fade" onRequestClose={() => setShowSignOutModal(false)}>
        <TouchableOpacity style={styles.confirmOverlay} activeOpacity={1} onPress={() => setShowSignOutModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Sign Out?</Text>
              <Text style={styles.confirmBody}>You'll need to sign in again to use the app.</Text>
              <TouchableOpacity
                style={styles.confirmDestructive}
                activeOpacity={0.7}
                onPress={async () => {
                  setShowSignOutModal(false);
                  try { await signOut(); } catch { showToast('Sign out failed — try again'); }
                }}
              >
                <Text style={styles.confirmDestructiveTxt}>Sign Out</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmCancel}
                activeOpacity={0.7}
                onPress={() => setShowSignOutModal(false)}
              >
                <Text style={styles.confirmCancelTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Clear History confirmation modal */}
      <Modal visible={showClearHistModal} transparent animationType="fade" onRequestClose={() => setShowClearHistModal(false)}>
        <TouchableOpacity style={styles.confirmOverlay} activeOpacity={1} onPress={() => setShowClearHistModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Clear History?</Text>
              <Text style={styles.confirmBody}>This permanently deletes all your decisions and itineraries. Cannot be undone.</Text>
              <TouchableOpacity
                style={styles.confirmDestructive}
                activeOpacity={0.7}
                onPress={async () => {
                  setShowClearHistModal(false);
                  await Promise.all([
                    AsyncStorage.removeItem('@decide/decisions'),
                    AsyncStorage.removeItem('@decide/itineraries'),
                  ]);
                  showToast('History cleared');
                }}
              >
                <Text style={styles.confirmDestructiveTxt}>Clear History</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmCancel}
                activeOpacity={0.7}
                onPress={() => setShowClearHistModal(false)}
              >
                <Text style={styles.confirmCancelTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  screenTitle:   { fontSize: 28, color: COLORS.textPrimary, fontFamily: 'PlayfairDisplay_800ExtraBold', textAlign: 'center', marginBottom: 28 },

  sectionHeader: {
    fontSize: 11, fontWeight: '700', color: COLORS.amber,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginTop: 24, marginBottom: 10, paddingHorizontal: 4,
  },

  card:         { backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 0.5, borderColor: COLORS.border, padding: 18, overflow: 'hidden' },
  locationCard: { backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 0.5, borderColor: COLORS.border, padding: 18, zIndex: 10 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.amber, letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },

  textInput: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15, color: COLORS.textPrimary,
  },

  // Profile
  avatarRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatarPill: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarPillActive: { backgroundColor: COLORS.amber, borderColor: COLORS.amber },
  avatarEmoji:      { fontSize: 22 },

  // Location
  modeRow:            { flexDirection: 'row', gap: 10 },
  modePill: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center',
  },
  modePillActive:     { backgroundColor: COLORS.amber, borderColor: COLORS.amber },
  modePillText:       { fontSize: 13, fontWeight: '600', color: COLORS.amber },
  modePillTextActive: { color: COLORS.bg },
  manualBlock:        { marginTop: 14, gap: 10, position: 'relative', zIndex: 10 },
  inputRow:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearBtn:           { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  clearBtnTxt:        { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  geocodeRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  geocodeStatus:      { fontSize: 13, color: COLORS.textMuted },
  geocodeSuccess:     { fontSize: 13, fontWeight: '600', color: COLORS.amber },
  geocodeError:       { fontSize: 13, color: COLORS.error },
  suggestionsOverlay: {
    position: 'absolute', top: 54, left: 0, right: 0,
    zIndex: 999, elevation: 10,
    backgroundColor: COLORS.surfaceAlt, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  suggestionRow:      { height: 48, justifyContent: 'center', paddingHorizontal: 14 },
  suggestionRowBorder:{ borderBottomWidth: 1, borderBottomColor: COLORS.border },
  suggestionText:     { fontSize: 13, fontWeight: '500', color: COLORS.amber },

  // Chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
    backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border,
  },
  chipActive:     { backgroundColor: COLORS.amber, borderColor: COLORS.amber },
  chipText:       { fontSize: 13, fontWeight: '500', color: COLORS.textMuted },
  chipTextActive: { color: COLORS.bg, fontWeight: '600' },

  // Sensitivity notes
  sensitivityNote: {
    fontSize: 13, color: COLORS.textSecondary, lineHeight: 18,
    marginBottom: 14, fontStyle: 'italic',
  },
  sensitivityDisclaimer: {
    fontSize: 11, color: COLORS.textMuted, lineHeight: 15,
    marginTop: 14, borderTopWidth: 0.5, borderTopColor: COLORS.border, paddingTop: 10,
  },

  // Preference pills
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prefPill: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 16, borderWidth: 1,
    backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border,
  },
  prefPillActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  prefPillText:       { fontSize: 13, fontWeight: '600', color: COLORS.amber },
  prefPillTextActive: { color: COLORS.primaryText },

  // Time picker
  timePickerRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeArrow:          { color: COLORS.textMuted, fontSize: 16, fontWeight: '300' },
  timePill: {
    flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 9, gap: 3,
  },
  timePillLabel:      { fontSize: 9, fontWeight: '700', color: COLORS.amber, letterSpacing: 1.5 },
  timePillInner:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timePillValue:      { fontSize: 14, fontWeight: '700', color: COLORS.amber },
  timePillChevron:    { fontSize: 11, color: COLORS.textMuted },
  timeValidationHint: { fontSize: 11, color: COLORS.error, marginTop: 8, letterSpacing: 0.2 },

  // Time picker modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  modalCard: {
    backgroundColor: COLORS.surface, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.border,
    width: 240, overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 10, fontWeight: '700', color: COLORS.amber, letterSpacing: 2,
    textAlign: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalOption:           { paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceAlt },
  modalOptionActive:     { backgroundColor: COLORS.surfaceAlt },
  modalOptionText:       { fontSize: 15, fontWeight: '500', color: COLORS.textMuted, textAlign: 'center' },
  modalOptionTextActive: { color: COLORS.amber, fontWeight: '700' },

  // Distance slider — 50 mile max
  distanceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  distanceValue:  { fontSize: 13, fontWeight: '700', color: COLORS.amber },
  sliderTrack: {
    height: 4, borderRadius: 2, backgroundColor: COLORS.border,
    marginVertical: 20, position: 'relative',
  },
  sliderFill: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    backgroundColor: COLORS.amber, borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute', top: -12,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.amber, borderWidth: 2, borderColor: COLORS.surface,
  },
  distanceTicks: { flexDirection: 'row', justifyContent: 'space-between' },
  distanceTick:  { fontSize: 10, color: COLORS.textMuted },

  // Demo mode
  demoCard: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: 18,
    borderWidth: 1.5, borderColor: COLORS.amber + '44',
    padding: 18, marginBottom: 8,
  },
  demoToggleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  demoLabelGroup: { flex: 1, marginRight: 12 },
  demoLabelRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  demoLabel:      { fontSize: 15, fontWeight: '700', color: COLORS.amber },
  demoDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.amber,
  },
  demoSub:        { fontSize: 12, color: COLORS.textMuted, lineHeight: 16 },
  demoInfoCard: {
    marginTop: 14, backgroundColor: COLORS.surface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.amber + '33', padding: 12,
  },
  demoInfoText: { fontSize: 13, color: COLORS.amber, lineHeight: 18 },

  // Toast
  toast: {
    position: 'absolute', bottom: 32, left: 20, right: 20,
    backgroundColor: COLORS.surfaceAlt, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.amber + '55',
    paddingVertical: 12, paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: COLORS.amber, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
  toastText: { fontSize: 13, fontWeight: '600', color: COLORS.amber },

  // App section
  appRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  appRowBorder:  { borderTopWidth: 0.5, borderTopColor: COLORS.border },
  appRowLabel:   { fontSize: 15, color: COLORS.textSecondary, fontWeight: '500' },
  appRowChevron: { fontSize: 20, color: COLORS.textMuted },
  appRowValue:   { fontSize: 13, color: COLORS.textMuted },

  // Confirmation modals
  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  confirmCard: {
    width: '100%', backgroundColor: COLORS.surface, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 24, gap: 12,
  },
  confirmTitle:         { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  confirmBody:          { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  confirmDestructive: {
    backgroundColor: COLORS.error + '22', borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.error + '55', marginTop: 4,
  },
  confirmDestructiveTxt: { fontSize: 15, fontWeight: '700', color: COLORS.error },
  confirmCancel: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  confirmCancelTxt: { fontSize: 15, fontWeight: '600', color: COLORS.textMuted },
});
