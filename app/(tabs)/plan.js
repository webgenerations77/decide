import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Linking, Animated, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { generateItinerary, swapStop } from '../../services/itineraryService';
import { loadPlanDefaults, KEYS } from '../../services/settingsService';
import { isAtDecisionLimit, incrementDecisionCount, getRemainingDecisions, isPro, LIMITS } from '../../services/subscriptionService';
import { scheduleItineraryAlerts, cancelItineraryAlerts } from '../../services/notificationService';
import { COLORS, FONTS, RADII } from '../../constants/theme';
import ScreenBackground from '../../components/brand/ScreenBackground';
import Card from '../../components/brand/Card';
import CTAButton from '../../components/brand/CTAButton';
import SectionLabel from '../../components/brand/SectionLabel';
import BrandLogo from '../../components/brand/BrandLogo';
import LoadingAnimation from '../../components/LoadingAnimation';
import { getApiBase } from '../../services/apiBase';
import { timeToMinutes, isValidWindow, windowChanged, canRefresh } from '../../lib/refreshPolicy';
import PlaceDetailModal from '../../components/itinerary/PlaceDetailModal';
import WeatherPill from '../../components/itinerary/WeatherPill';
import StopCard from '../../components/itinerary/StopCard';
import ItineraryMeta from '../../components/itinerary/ItineraryMeta';

// ─── Date helpers ─────────────────────────────────────────────────────────────
function getNextSevenDays() {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const label =
      i === 0 ? 'Today' :
      i === 1 ? 'Tomorrow' :
      d.toLocaleDateString('en-US', { weekday: 'long' });
    const sub =
      i <= 1
        ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    days.push({ label, sub, isoDate: d.toISOString() });
  }
  return days;
}

function datePillLabel(isoDate) {
  const d       = isoDate ? new Date(isoDate) : new Date();
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const cmp     = new Date(d); cmp.setHours(0, 0, 0, 0);
  if (cmp.getTime() === today.getTime())    return 'Today';
  if (cmp.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// ─── Time options ─────────────────────────────────────────────────────────────
const START_TIMES = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM'];
const END_TIMES   = ['4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'];

// ─── Preference options ───────────────────────────────────────────────────────
const PACE_OPTIONS = [
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
const GROUP_OPTIONS = [
  { id: 'solo',    label: 'Solo',    emoji: '🧍' },
  { id: 'couple',  label: 'Couple',  emoji: '👫' },
  { id: 'family',  label: 'Family',  emoji: '👨‍👩‍👧' },
  { id: 'friends', label: 'Friends', emoji: '👥' },
];

// ─── TimePickerPill ───────────────────────────────────────────────────────────
function TimePickerPill({ label, value, options, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={[styles.timePill, disabled && { opacity: 0.5 }]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.timePillLabel}>{label}</Text>
        <View style={styles.timePillInner}>
          <Text style={styles.timePillValue}>{value}</Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textMuted} />
        </View>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{label} time</Text>
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
                  <Text style={[styles.modalOptionText, opt === value && styles.modalOptionTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── PillRow ──────────────────────────────────────────────────────────────────
function PillRow({ options, selected, onSelect, disabled }) {
  return (
    <View style={styles.pillsRow}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.id}
          style={[styles.prefPill, selected === o.id && styles.prefPillActive]}
          onPress={() => onSelect(o.id)}
          disabled={disabled}
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

// ─── PlanScreen ───────────────────────────────────────────────────────────────
export default function PlanScreen() {
  const router = useRouter();
  const [view, setView] = useState('landing');
  const [remainingDecisions, setRemainingDecisions] = useState(null);

  const [locationLabel, setLocationLabel] = useState('Locating…');
  const [isManual,      setIsManual]      = useState(false);
  const [displayName,   setDisplayName]   = useState('');
  const [sensitivities, setSensitivities] = useState([]);
  const gpsLoadedRef  = useRef(false);
  const gpsLabelRef   = useRef(null);
  const gpsCoordsRef  = useRef(null);

  const [showWeekPicker, setShowWeekPicker] = useState(false);

  const [pace,      setPace]      = useState('moderate');
  const [budget,    setBudget]    = useState('$$');
  const [groupType, setGroupType] = useState('couple');
  const [startTime, setStartTime] = useState('11:00 AM');
  const [endTime,   setEndTime]   = useState('8:00 PM');
  const [cuisines,  setCuisines]  = useState([]);
  const [tripNote,  setTripNote]  = useState('');

  const [itinerary,      setItinerary]      = useState(null);
  const [weather,        setWeather]        = useState(null);
  const [meta,           setMeta]           = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [swappingIndex,  setSwappingIndex]  = useState(null);
  const [error,          setError]          = useState(null);
  const [isFallback,     setIsFallback]     = useState(false);
  const [research,       setResearch]       = useState(null);
  const [coords,         setCoords]         = useState(null);
  const [planDate,       setPlanDate]       = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [generatedStart,     setGeneratedStart]     = useState(null);
  const [generatedEnd,       setGeneratedEnd]       = useState(null);
  const [refreshCount,       setRefreshCount]       = useState(0);
  const [currentItineraryId, setCurrentItineraryId] = useState(null);

  const [selectedStop,    setSelectedStop]    = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const pulseLoop   = useRef(null);
  const seenDateRef = useRef(null);

  // Landing entrance animations
  const logoAnim  = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const tagAnim   = useRef(new Animated.Value(0)).current;
  const tagSlide  = useRef(new Animated.Value(24)).current;
  const locAnim   = useRef(new Animated.Value(0)).current;
  const btn1Anim  = useRef(new Animated.Value(0)).current;
  const btn1Slide = useRef(new Animated.Value(28)).current;
  const btn2Anim  = useRef(new Animated.Value(0)).current;
  const btn2Slide = useRef(new Animated.Value(28)).current;
  const params      = useLocalSearchParams();

  const isValidTimeWindow = isValidWindow(startTime, endTime);

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const [modeRaw, locRaw, sensRaw] = await Promise.all([
          AsyncStorage.getItem('@decide/location_mode'),
          AsyncStorage.getItem('@decide/manual_location'),
          AsyncStorage.getItem('@decide/sensitivities'),
        ]);
        if (sensRaw) { try { setSensitivities(JSON.parse(sensRaw) ?? []); } catch {} }
        const mode = modeRaw ?? 'auto';
        if (mode === 'manual' && locRaw) {
          const loc = JSON.parse(locRaw);
          if (loc?.latitude && loc?.longitude) {
            setIsManual(true);
            setLocationLabel(loc.short ?? loc.label ?? 'Manual location');
            setCoords({ latitude: loc.latitude, longitude: loc.longitude });
            return;
          }
        }
        setIsManual(false);
      } catch {
        setIsManual(false);
      }

      if (gpsLoadedRef.current && gpsLabelRef.current) {
        setIsManual(false);
        setLocationLabel(gpsLabelRef.current);
        setCoords(gpsCoordsRef.current);
        return;
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLocationLabel('Location unavailable'); return; }

        let pos = await Location.getLastKnownPositionAsync({ maxAge: 300000 });
        if (!pos) {
          pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }
        const { latitude, longitude } = pos.coords;
        setCoords({ latitude, longitude });
        gpsCoordsRef.current = { latitude, longitude };
        AsyncStorage.setItem('lastKnownCoords', JSON.stringify({ latitude, longitude })).catch(() => {});

        let label = null;
        try {
          const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (geo) {
            const city  = geo.city || geo.district || geo.subregion;
            const state = geo.region;
            label = city && state ? `${city}, ${state}`
                  : city          ? city
                  : state         ? state
                  : null;
          }
        } catch (e) {
          console.warn('[location] reverseGeocodeAsync failed:', e?.message ?? e);
        }

        if (!label) {
          try {
            const res  = await fetch(`${getApiBase()}/api/geocode?lat=${latitude}&lng=${longitude}`);
            const data = await res.json();
            if (data.label) label = data.label;
          } catch (e) {
            console.warn('[location] geocode fetch failed:', e?.message ?? e);
          }
        }

        const finalLabel = label ?? 'Your location';
        gpsLoadedRef.current = true;
        gpsLabelRef.current = finalLabel;
        setLocationLabel(finalLabel);
      } catch (e) {
        console.warn('[location] GPS acquisition failed:', e?.message ?? e);
        setLocationLabel('Location unavailable');
      }
    })();
    getRemainingDecisions().then(setRemainingDecisions).catch(() => {});
  }, []));

  useEffect(() => {
    loadPlanDefaults().then((d) => {
      setPace(d.pace); setBudget(d.budget); setGroupType(d.group);
      setStartTime(d.startTime); setEndTime(d.endTime);
      setCuisines(d.cuisines ?? []);
    });
    AsyncStorage.getItem('@decide/display_name').then((n) => {
      if (n) setDisplayName(n);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!params.date || params.date === seenDateRef.current) return;
    seenDateRef.current = params.date;
    setPlanDate(params.date);
    setView('configuring');
  }, [params.date]);

  useEffect(() => {
    if (loading) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [loading]);

  // Run landing entrance animation whenever the landing view becomes active
  useEffect(() => {
    if (view !== 'landing') return;
    logoAnim.setValue(0); logoScale.setValue(0.85);
    tagAnim.setValue(0);  tagSlide.setValue(24);
    locAnim.setValue(0);
    btn1Anim.setValue(0); btn1Slide.setValue(28);
    btn2Anim.setValue(0); btn2Slide.setValue(28);

    const seq = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, tension: 75, friction: 9, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(tagAnim,  { toValue: 1, duration: 300, delay: 40, useNativeDriver: true }),
        Animated.timing(tagSlide, { toValue: 0, duration: 300, delay: 40, useNativeDriver: true }),
      ]),
      Animated.timing(locAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(btn1Anim,  { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(btn1Slide, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(btn2Anim,  { toValue: 1, duration: 210, delay: 60, useNativeDriver: true }),
        Animated.timing(btn2Slide, { toValue: 0, duration: 210, delay: 60, useNativeDriver: true }),
      ]),
    ]);
    seq.start();
    return () => seq.stop();
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToday = () => {
    setPlanDate(null);
    setView('configuring');
  };

  const handleDaySelect = (isoDate) => {
    setShowWeekPicker(false);
    setPlanDate(isoDate);
    setView('configuring');
  };

  const goToLanding = () => {
    setItinerary(null); setWeather(null); setMeta(null); setError(null); setIsFallback(false); setResearch(null);
    setTripNote('');
    setView('landing');
    cancelItineraryAlerts().catch(() => {});
  };

  const generate = async ({ asEdit = false } = {}) => {
    if (!coords) { setError("Still finding your location — give it a moment and try again."); return; }
    if (!isValidTimeWindow) return;
    if (asEdit) {
      const [pro, demoRaw] = await Promise.all([
        isPro(),
        AsyncStorage.getItem('@decide/demo_mode').catch(() => null),
      ]);
      if (!canRefresh({ isPro: pro, isDemo: demoRaw === 'true', refreshCount })) {
        router.push('/paywall'); return;
      }
    } else {
      if (await isAtDecisionLimit()) { router.push('/paywall'); return; }
    }
    setLoading(true); setError(null);
    try {
      let feedbackCtx = {};
      try {
        const [dRaw, iRaw] = await Promise.all([
          AsyncStorage.getItem('@decide/decisions'),
          AsyncStorage.getItem('@decide/itineraries'),
        ]);
        const decisions   = dRaw ? JSON.parse(dRaw) : [];
        const itineraries = iRaw ? JSON.parse(iRaw) : [];
        const dislikedPlaces  = decisions.filter((d) => d.feedback === 'down').map((d) => d.name).filter(Boolean);
        const likedPlaces     = decisions.filter((d) => d.feedback === 'up').map((d) => d.name).filter(Boolean);
        const allReasons      = [
          ...decisions.filter((d) => d.feedback === 'down' && d.feedbackReason).map((d) => d.feedbackReason),
          ...itineraries.filter((it) => it.feedback === 'down' && it.feedbackReason).map((it) => it.feedbackReason),
        ];
        const dislikedReasons = [...new Set(allReasons)];
        feedbackCtx = { dislikedPlaces: dislikedPlaces.slice(0, 20), likedPlaces: likedPlaces.slice(0, 10), dislikedReasons };
      } catch {}

      const maxDistRaw = await AsyncStorage.getItem('@decide/max_distance').catch(() => null);
      const maxDistanceMiles = maxDistRaw ? parseInt(maxDistRaw, 10) : 25;

      const [stylesRaw, dietRaw] = await Promise.all([
        AsyncStorage.getItem('@decide/activity_styles'),
        AsyncStorage.getItem('@decide/dietary'),
      ]);
      const activityStyles = stylesRaw ? JSON.parse(stylesRaw) : [];
      const dietary = dietRaw ? JSON.parse(dietRaw) : [];

      const data = await generateItinerary({
        latitude:  coords.latitude,
        longitude: coords.longitude,
        preferences: { pace, budget, group_type: groupType, cuisines, sensitivities },
        startTime, endTime, date: planDate,
        feedback: feedbackCtx,
        maxDistanceMiles,
        tripNote, activityStyles, dietary,
      });
      setItinerary(data.itinerary);
      setWeather(data.weather);
      setMeta(data.meta);
      setIsFallback(data.isFallback ?? false);
      setResearch(data.discovery ?? null);
      setView('itinerary');

      try {
        const raw      = await AsyncStorage.getItem('@decide/itineraries');
        const existing = raw ? JSON.parse(raw) : [];
        const summary  = (data.itinerary ?? []).map((s) => ({ name: s.name, category: s.category }));
        const idx      = asEdit && currentItineraryId
          ? existing.findIndex((e) => e.id === currentItineraryId)
          : -1;
        if (idx !== -1) {
          existing[idx] = {
            ...existing[idx],
            meta: data.meta, weather: data.weather,
            stops: summary, itinerary: data.itinerary ?? [], v: 2,
          };
          await AsyncStorage.setItem('@decide/itineraries', JSON.stringify(existing));
        } else {
          const id    = `itinerary_${Date.now()}`;
          const entry = {
            id, timestamp: Date.now(), meta: data.meta, weather: data.weather,
            stops: summary, itinerary: data.itinerary ?? [], v: 2,
            feedback: null, feedbackReason: null,
          };
          setCurrentItineraryId(id);
          await AsyncStorage.setItem('@decide/itineraries', JSON.stringify([entry, ...existing.slice(0, 49)]));
        }
      } catch (e) {
        console.warn('[history] save itinerary error', e);
      }
      if (asEdit) {
        setRefreshCount((c) => c + 1);
      } else {
        setRefreshCount(0);
        await incrementDecisionCount().catch(() => {});
        getRemainingDecisions().then(setRemainingDecisions).catch(() => {});
      }
      setGeneratedStart(startTime);
      setGeneratedEnd(endTime);
      const notifEnabled = await AsyncStorage.getItem(KEYS.NOTIFICATIONS).catch(() => null);
      if (notifEnabled === 'true' && data.itinerary) {
        scheduleItineraryAlerts(data.itinerary).catch(console.warn);
      }
    } catch (err) {
      console.error('[plan] generate error:', err);
      setError(err.message ?? "Hmm, something didn't go through. Try again?");
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async (index) => {
    if (!coords) return;
    setSwappingIndex(index);
    try {
      const updated = await swapStop({
        itinerary, stopIndex: index,
        latitude: coords.latitude, longitude: coords.longitude,
      });
      setItinerary(updated);
    } catch (err) {
      console.error('[plan] swap error:', err);
      setError(err.message ?? "Couldn't find a swap. Try again.");
    } finally {
      setSwappingIndex(null);
    }
  };

  const handleNavigateFullDay = () => {
    if (!itinerary?.length) return;
    const encode = (s) => s.lat && s.lng
      ? `${s.lat},${s.lng}`
      : encodeURIComponent(s.address || s.name);
    const stopStrs = itinerary.map(encode);
    const originStr = coords?.latitude && coords?.longitude
      ? `${coords.latitude},${coords.longitude}` : null;
    const points = originStr ? [originStr, ...stopStrs] : stopStrs;
    let url = `https://www.google.com/maps/dir/?api=1&origin=${points[0]}&destination=${points[points.length - 1]}&travelmode=driving`;
    if (points.length > 2) url += `&waypoints=${points.slice(1, -1).join('|')}`;
    Linking.openURL(url);
  };

  const resetToConfiguring = () => {
    setItinerary(null); setWeather(null); setMeta(null); setError(null); setIsFallback(false); setResearch(null);
    setTripNote('');
    setView('configuring');
  };

  const locationPillText = `${isManual ? '📌 ' : '📍 '}${locationLabel}`;
  const hasItinerary     = Array.isArray(itinerary) && itinerary.length > 0;

  const windowDidChange = windowChanged(generatedStart, generatedEnd, startTime, endTime);
  const timeEditor = (
    <View style={styles.resultsTimeEditor}>
      <View style={styles.timePickerRow}>
        <TimePickerPill label="Start" value={startTime} options={START_TIMES} onChange={setStartTime} disabled={loading} />
        <Text style={styles.timeArrow}>→</Text>
        <TimePickerPill label="End"   value={endTime}   options={END_TIMES}   onChange={setEndTime}   disabled={loading} />
      </View>
      {!isValidTimeWindow && (
        <Text style={styles.timeValidationHint}>Please allow at least 3 hours</Text>
      )}
      {windowDidChange && isValidTimeWindow && !loading && (
        <View style={{ marginTop: 10 }}>
          <CTAButton variant="cobalt" title="Refresh itinerary" onPress={() => generate({ asEdit: true })} />
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── LANDING ──────────────────────────────────────────────────────── */}
        {view === 'landing' && (
          <ScreenBackground variant="paper" style={styles.landingContainer}>
            {/* Hero — mirrors the sign-in screen (stacked logo + tagline) */}
            <Animated.View style={[styles.landingHero, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}>
              <BrandLogo variant="stacked" size={80} />
              <Text style={styles.landingHeroTag}>
                {displayName ? `Hey ${displayName} — your day, decided.` : 'Your day, decided.'}
              </Text>
            </Animated.View>

            {/* Content card — mirrors the sign-in form card */}
            <Card style={styles.landingCard}>
              <Animated.View style={[styles.locationPillRow, { opacity: locAnim }]}>
                <View style={styles.locationPill}>
                  <Ionicons name={isManual ? 'pin' : 'location'} size={13} color={COLORS.primary} />
                  <Text style={styles.locationText}>{locationLabel}</Text>
                </View>
              </Animated.View>

              <Animated.View style={{ opacity: btn1Anim, transform: [{ translateY: btn1Slide }], width: '100%' }}>
                <TouchableOpacity style={styles.landingBtnTouch} onPress={handleToday} activeOpacity={0.88}>
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.decideBtn, styles.decideBtnPrimary]}
                  >
                    <Text style={styles.decideBtnTitle}>Plan today</Text>
                    <Text style={styles.decideBtnSub}>Build my full-day itinerary</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ opacity: btn2Anim, transform: [{ translateY: btn2Slide }], width: '100%' }}>
                <TouchableOpacity style={styles.landingBtnTouch} onPress={() => setShowWeekPicker(true)} activeOpacity={0.75}>
                  <View style={[styles.decideBtn, styles.decideBtnSecondary]}>
                    <Text style={[styles.decideBtnTitle, { color: COLORS.primary }]}>Plan another day</Text>
                    <Text style={[styles.decideBtnSub, { color: COLORS.textMuted }]}>Choose a day this week</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </Card>

            <Text style={styles.landingSubtext}>Cheddar-curated, based on where you are</Text>
          </ScreenBackground>
        )}

        {/* ─── CONFIGURING ──────────────────────────────────────────────────── */}
        {view === 'configuring' && (
          <View style={styles.planContainer}>
            <View style={styles.header}>
              <TouchableOpacity onPress={goToLanding} activeOpacity={0.7} style={styles.backRow}>
                <Text style={styles.backText}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.appName}>Plan your day</Text>
              <View style={styles.headerPill}>
                <Text style={styles.headerPillText}>{locationPillText}</Text>
              </View>
            </View>

            <Card style={styles.prefsCard}>
              <SectionLabel tone="cobalt">Date</SectionLabel>
              <TouchableOpacity
                style={[styles.datePill, loading && { opacity: 0.5 }]}
                onPress={() => !loading && setShowDatePicker(true)}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Text style={styles.datePillValue}>📅  {datePillLabel(planDate)}</Text>
                <Ionicons name="chevron-down" size={13} color={COLORS.textMuted} />
              </TouchableOpacity>

              <SectionLabel tone="cobalt">Pace</SectionLabel>
              <PillRow options={PACE_OPTIONS}   selected={pace}      onSelect={setPace}      disabled={loading} />

              <SectionLabel tone="cobalt">Budget</SectionLabel>
              <PillRow options={BUDGET_OPTIONS} selected={budget}    onSelect={setBudget}    disabled={loading} />

              <SectionLabel tone="cobalt">Group</SectionLabel>
              <PillRow options={GROUP_OPTIONS}  selected={groupType} onSelect={setGroupType} disabled={loading} />

              <SectionLabel tone="cobalt">Time window</SectionLabel>
              <View style={styles.timePickerRow}>
                <TimePickerPill label="Start" value={startTime} options={START_TIMES} onChange={setStartTime} disabled={loading} />
                <Text style={styles.timeArrow}>→</Text>
                <TimePickerPill label="End"   value={endTime}   options={END_TIMES}   onChange={setEndTime}   disabled={loading} />
              </View>
              {!isValidTimeWindow && (
                <Text style={styles.timeValidationHint}>Please allow at least 3 hours</Text>
              )}

              <SectionLabel tone="cobalt">Into anything specific this trip?</SectionLabel>
              <TextInput
                style={styles.tripNoteInput}
                placeholder="e.g. pinball, vinyl, breweries, surf"
                placeholderTextColor={COLORS.textMuted}
                value={tripNote}
                onChangeText={setTripNote}
              />
            </Card>

            {error ? (
              <View style={styles.errorBlock}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => generate()} activeOpacity={0.7}>
                  <Text style={styles.retryBtnText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : null}

          </View>
        )}

        {/* ─── ITINERARY ────────────────────────────────────────────────────── */}
        {view === 'itinerary' && hasItinerary && (
          <View style={styles.planContainer}>
            <View style={styles.header}>
              <Text style={styles.appName}>Your day</Text>
              <WeatherPill weather={weather} timeWindow={meta?.time_window ?? `${startTime} – ${endTime}`} />
            </View>

            <View style={styles.itineraryContainer}>
              {isFallback && (
                <View style={styles.fallbackBanner}>
                  <Ionicons name="cloud-offline-outline" size={14} color={COLORS.gold} style={{ marginRight: 6 }} />
                  <Text style={styles.fallbackBannerTxt}>
                    Offline mode — showing top-rated nearby places.
                  </Text>
                </View>
              )}
              <ItineraryMeta meta={meta} stopCount={itinerary.length} research={research} timeEditor={timeEditor} />

              {itinerary.map((stop, i) => (
                <StopCard
                  key={`${stop.place_id}-${i}`}
                  stop={stop}
                  index={i}
                  isLast={i === itinerary.length - 1}
                  onSwap={() => handleSwap(i)}
                  isSwapping={swappingIndex === i}
                  onViewDetails={(s) => { setSelectedStop(s); setShowDetailModal(true); }}
                  weather={weather}
                  planDate={planDate}
                  sensitivities={sensitivities}
                />
              ))}

              <TouchableOpacity
                style={styles.resetBtn}
                onPress={resetToConfiguring}
                disabled={swappingIndex !== null}
                activeOpacity={0.7}
              >
                <Text style={styles.resetBtnText}>Change plan preferences</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: view === 'landing' ? 40 : 100 }} />
      </ScrollView>

      {/* Sticky generate button */}
      {view === 'configuring' && (
        <View style={styles.stickyNavContainer}>
          <Animated.View style={{ opacity: loading ? pulseAnim : 1 }}>
            <CTAButton
              variant="cobalt"
              title="Build my day →"
              onPress={() => generate()}
              disabled={!isValidTimeWindow}
              loading={loading}
            />
          </Animated.View>
          {!loading && <Text style={styles.generateSubtext}>Cheddar-curated, based on where you are</Text>}
          {!loading && remainingDecisions != null && remainingDecisions !== Infinity && (
            <Text style={styles.remainingText}>{remainingDecisions}/{LIMITS.FREE_DECISIONS_PER_DAY} decisions left today</Text>
          )}
        </View>
      )}

      {/* Sticky navigate button */}
      {view === 'itinerary' && hasItinerary && (
        <View style={styles.stickyNavContainer}>
          <TouchableOpacity onPress={handleNavigateFullDay} activeOpacity={0.88}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.stickyNavBtn}
            >
              <Ionicons name="navigate" size={18} color={COLORS.primaryText} style={{ marginRight: 8 }} />
              <Text style={styles.stickyNavTxt}>Navigate full day</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading overlay — centered, covers the form/buttons while Cheddar builds the day */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <LoadingAnimation />
        </View>
      )}

      {/* Week picker */}
      <Modal visible={showWeekPicker} transparent animationType="slide" onRequestClose={() => setShowWeekPicker(false)}>
        <TouchableOpacity style={styles.weekPickerOverlay} activeOpacity={1} onPress={() => setShowWeekPicker(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.weekPickerCard}>
              <View style={styles.weekPickerHeader}>
                <Text style={styles.weekPickerTitle}>Choose a day</Text>
                <TouchableOpacity style={styles.weekPickerClose} onPress={() => setShowWeekPicker(false)} activeOpacity={0.7}>
                  <Ionicons name="close" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              {getNextSevenDays().map((day, i) => (
                <TouchableOpacity
                  key={day.isoDate}
                  style={[styles.dayRow, i === 6 && styles.dayRowLast]}
                  onPress={() => handleDaySelect(i === 0 ? null : day.isoDate)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayLabel, i === 0 && styles.dayLabelToday]}>{day.label}</Text>
                  <Text style={styles.daySub}>{day.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Date picker */}
      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity style={styles.weekPickerOverlay} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.weekPickerCard}>
              <View style={styles.weekPickerHeader}>
                <Text style={styles.weekPickerTitle}>Choose a day</Text>
                <TouchableOpacity style={styles.weekPickerClose} onPress={() => setShowDatePicker(false)} activeOpacity={0.7}>
                  <Ionicons name="close" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              {getNextSevenDays().map((day, i) => (
                <TouchableOpacity
                  key={day.isoDate}
                  style={[styles.dayRow, i === 6 && styles.dayRowLast]}
                  onPress={() => { setPlanDate(i === 0 ? null : day.isoDate); setShowDatePicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayLabel, datePillLabel(planDate) === day.label && styles.dayLabelToday]}>
                    {day.label}
                  </Text>
                  <Text style={styles.daySub}>{day.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <PlaceDetailModal
        visible={showDetailModal}
        stop={selectedStop}
        onClose={() => setShowDetailModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: COLORS.bg },
  scroll:        { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // ── Landing ──────────────────────────────────────────────────────────────
  landingContainer: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 56, paddingBottom: 48,
    justifyContent: 'center',
  },
  landingHero: { alignItems: 'center', marginBottom: 32 },
  landingHeroTag: {
    fontSize: 16, color: COLORS.textSecondary, textAlign: 'center',
    fontFamily: FONTS.display, letterSpacing: 0.2, marginTop: 12,
  },
  landingCard: { width: '100%', gap: 14 },
  locationPillRow: { alignItems: 'center' },
  locationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 20, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  locationText: { fontSize: 13, color: COLORS.textSecondary, letterSpacing: 0.2 },
  landingBtnTouch: { width: '100%' },
  decideBtn: {
    width: '100%', paddingVertical: 20, paddingHorizontal: 24,
    borderRadius: 20, alignItems: 'center', gap: 5,
  },
  decideBtnPrimary: {
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 20, elevation: 18,
  },
  decideBtnSecondary: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  decideBtnTitle: { color: COLORS.primaryText, fontSize: 18, fontFamily: FONTS.displayHeavy },
  decideBtnSub:   { color: COLORS.sky200, fontSize: 12, letterSpacing: 0.2 },
  landingSubtext: { fontSize: 12, color: COLORS.textMuted, letterSpacing: 0.2, textAlign: 'center', marginTop: 20 },

  // ── Plan / Itinerary container ────────────────────────────────────────────
  planContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },

  // Header
  header:         { alignItems: 'center', marginBottom: 24 },
  backRow:        { marginBottom: 10 },
  backText:       { fontSize: 13, color: COLORS.primary, fontFamily: FONTS.bodySemiBold },
  appName: {
    fontSize: 26, color: COLORS.textPrimary,
    fontFamily: FONTS.displayHeavy,
  },
  headerPill: {
    marginTop: 10, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerPillText: { fontSize: 12, color: COLORS.textSecondary, letterSpacing: 0.2 },

  // Preferences card
  prefsCard: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 20, marginBottom: 16, gap: 12,
  },
  datePill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceAlt, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  datePillValue:   { fontSize: 14, fontFamily: FONTS.bodyBold, color: COLORS.primary },
  pillsRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prefPill: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 16, borderWidth: 1,
    backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border,
  },
  prefPillActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  prefPillText:       { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.textSecondary },
  prefPillTextActive: { color: COLORS.primaryText },
  timePickerRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeArrow:          { color: COLORS.textMuted, fontSize: 16, fontFamily: FONTS.body },
  timePill: {
    flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 10, gap: 3,
  },
  timePillLabel:   { fontSize: 10, fontFamily: FONTS.bodyBold, color: COLORS.textMuted, letterSpacing: 0.5 },
  timePillInner:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timePillValue:   { fontSize: 14, fontFamily: FONTS.bodyBold, color: COLORS.primary },
  timeValidationHint: { fontSize: 11, color: COLORS.error, marginTop: 2 },
  resultsTimeEditor: { marginTop: 4, marginBottom: 12 },
  tripNoteInput: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: RADII.md, color: COLORS.textPrimary, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontFamily: FONTS.body },

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
    fontSize: 11, fontFamily: FONTS.monoBold, color: COLORS.primary, letterSpacing: 1,
    textAlign: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    textTransform: 'capitalize',
  },
  modalOption:           { paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceAlt },
  modalOptionActive:     { backgroundColor: COLORS.surfaceAlt },
  modalOptionText:       { fontSize: 15, fontFamily: FONTS.bodyMedium, color: COLORS.textMuted, textAlign: 'center' },
  modalOptionTextActive: { color: COLORS.primary, fontFamily: FONTS.bodyBold },

  // Error block
  errorBlock: { alignItems: 'center', gap: 12, marginTop: 4 },
  errorText: {
    color: COLORS.error, fontSize: 14, textAlign: 'center',
    backgroundColor: COLORS.error + '12', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16,
    borderWidth: 1, borderColor: COLORS.error + '33',
    lineHeight: 20,
  },

  // Generate button
  generateSubtext: { textAlign: 'center', fontSize: 12, color: COLORS.textMuted, marginTop: 10 },
  remainingText:   { textAlign: 'center', fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  retryBtn: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 16, paddingHorizontal: 24, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  retryBtnText: { color: COLORS.primary, fontSize: 14, fontFamily: FONTS.bodyBold },

  // Itinerary
  fallbackBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 16, borderRadius: 12,
    backgroundColor: COLORS.warning + '12', borderWidth: 1, borderColor: COLORS.warning + '44',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  fallbackBannerTxt: { fontSize: 13, color: COLORS.warning, lineHeight: 18, flex: 1 },
  itineraryContainer: { gap: 0 },
  resetBtn: {
    marginTop: 12, borderRadius: 16, height: 52,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  resetBtnText: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.bodySemiBold },

  // Sticky footer
  stickyNavContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: 28, paddingTop: 14,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 50, elevation: 50,
  },
  stickyNavBtn: {
    borderRadius: 18, height: 58,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 12,
  },
  stickyNavTxt: { color: COLORS.primaryText, fontSize: 17, fontFamily: FONTS.bodyBold },

  // Week / Date picker
  weekPickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  weekPickerCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: COLORS.border,
    paddingBottom: 34, overflow: 'hidden',
  },
  weekPickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  weekPickerTitle: {
    fontSize: 16, color: COLORS.textPrimary,
    fontFamily: FONTS.display,
  },
  weekPickerClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: COLORS.surfaceAlt,
  },
  dayRowLast:    { borderBottomWidth: 0 },
  dayLabel:      { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.textPrimary },
  dayLabelToday: { color: COLORS.primary },
  daySub:        { fontSize: 13, color: COLORS.textMuted, fontFamily: FONTS.body },

});
