import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Linking, ActivityIndicator, Animated, Modal, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { generateItinerary, swapStop } from '../../services/itineraryService';
import { loadPlanDefaults } from '../../services/settingsService';

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

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

function timeToMinutes(timeStr) {
  const [time, period] = timeStr.split(' ');
  let [hours] = time.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60;
}

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

// ─── Category display maps ────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  food: '#00d2be', activity: '#00a896', shopping: '#7c3aed', outdoor: '#00D2BE',
};
const CATEGORY_EMOJIS = {
  food: '🍽️', activity: '🎭', shopping: '🛍️', outdoor: '🌿',
};

// ─── Feedback reasons ─────────────────────────────────────────────────────────
const FEEDBACK_REASONS = ['Closed', 'Too crowded', 'Not my style', 'Too far', 'Too expensive', 'Other'];

// ─── Highlight config ─────────────────────────────────────────────────────────
const highlightConfig = {
  entertainment: { icon: '🎵', borderColor: '#7c3aed' },
  special:       { icon: '🏷️', borderColor: '#00d2be' },
  feature:       { icon: '✨', borderColor: '#00a896' },
  buzz:          { icon: '📰', borderColor: '#4a6a6e' },
};

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

// ─── FeedbackModal ────────────────────────────────────────────────────────────
function FeedbackModal({ visible, placeName, onClose, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.fbOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.fbCard}>
            <Text style={styles.fbTitle}>WHAT WAS THE ISSUE?</Text>
            <Text style={styles.fbPlace} numberOfLines={1}>{placeName}</Text>
            {FEEDBACK_REASONS.map((reason, i) => (
              <TouchableOpacity
                key={reason}
                style={[styles.fbOption, i === FEEDBACK_REASONS.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => onSelect(reason)}
                activeOpacity={0.7}
              >
                <Text style={styles.fbOptionTxt}>{reason}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.fbCancel} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.fbCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── PlaceDetailModal ─────────────────────────────────────────────────────────
function PlaceDetailModal({ visible, stop, onClose }) {
  const [placeDetails,  setPlaceDetails]  = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    if (!visible || !stop) { setPlaceDetails(null); return; }
    const pid = stop.place_id ?? '';
    const isDemo     = pid.startsWith('demo_');
    const isExternal = pid.startsWith('nps_') || pid.startsWith('ridb_');
    if (isDemo || isExternal || !GOOGLE_KEY || !pid) {
      setPlaceDetails(null);
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    setPlaceDetails(null);
    const fields = 'name,rating,user_ratings_total,formatted_phone_number,website,opening_hours,price_level';
    const base = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pid}&fields=${encodeURIComponent(fields)}&key=${GOOGLE_KEY}`;
    const url  = Platform.OS === 'web' ? `https://corsproxy.io/?${encodeURIComponent(base)}` : base;
    fetch(url)
      .then((r) => r.json())
      .then((data) => { setPlaceDetails(data.result ?? null); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }, [visible, stop?.place_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stop) return null;

  const color    = CATEGORY_COLORS[stop.category] ?? '#00D2BE';
  const catEmoji = CATEGORY_EMOJIS[stop.category] ?? '⚡';
  const priceLvl = [null, '$', '$$', '$$$', '$$$$'];

  const rating    = stop.rating ?? placeDetails?.rating ?? 0;
  const priceStr  = placeDetails?.price_level != null ? (priceLvl[placeDetails.price_level] ?? null) : null;
  const openNow   = placeDetails?.opening_hours?.open_now;
  const todayIdx  = new Date().getDay();
  const todayHours = placeDetails?.opening_hours?.weekday_text
    ? placeDetails.opening_hours.weekday_text[(todayIdx + 6) % 7]?.split(': ').slice(1).join(': ') ?? null
    : null;
  const phone   = stop.phone   ?? placeDetails?.formatted_phone_number ?? null;
  const website = stop.website ?? placeDetails?.website ?? null;

  const handleNavigate = () => {
    const target = stop.lat && stop.lng
      ? `${stop.lat},${stop.lng}`
      : encodeURIComponent(stop.address || stop.name);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${target}`);
  };

  const hasInfoRow = rating > 0 || priceStr || openNow != null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.detailOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[styles.detailSheet, { height: screenHeight * 0.75 }]}>

            {/* Drag handle */}
            <View style={styles.dragHandle} />

            {/* Header: category pill + close */}
            <View style={styles.detailHeader}>
              <View style={[styles.detailCatPill, { backgroundColor: color + '22' }]}>
                <Text style={[styles.detailCatPillTxt, { color }]}>{catEmoji} {(stop.category ?? '').toUpperCase()}</Text>
              </View>
              <TouchableOpacity style={styles.detailCloseBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.detailCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.detailScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 32 }}
            >
              {/* Name + address */}
              <Text style={styles.detailName}>{stop.name}</Text>
              {stop.address ? <Text style={styles.detailAddr}>{stop.address}</Text> : null}

              {/* Info row: rating • price • open status */}
              {hasInfoRow && (
                <View style={styles.detailInfoRow}>
                  {rating > 0 && (
                    <Text style={styles.detailInfoTxt}>
                      ⭐ {typeof rating === 'number' ? rating.toFixed(1) : rating}
                    </Text>
                  )}
                  {priceStr && (
                    <><Text style={styles.detailInfoDot}>•</Text><Text style={styles.detailInfoTxt}>{priceStr}</Text></>
                  )}
                  {openNow != null && (
                    <>
                      <Text style={styles.detailInfoDot}>•</Text>
                      <Text style={[styles.detailInfoTxt, { color: openNow ? '#4ade80' : '#f87171' }]}>
                        {openNow ? '● Open' : '● Closed'}
                      </Text>
                    </>
                  )}
                  {todayHours && (
                    <><Text style={styles.detailInfoDot}>•</Text><Text style={styles.detailInfoTxt}>{todayHours}</Text></>
                  )}
                </View>
              )}

              {detailLoading && <ActivityIndicator color="#00D2BE" style={{ marginVertical: 20 }} />}

              {/* Source badge */}
              {stop.place_id?.startsWith('nps_')  && <View style={styles.detailSourceBadge}><Text style={styles.detailSourceTxt}>🌲 National Park Service</Text></View>}
              {stop.place_id?.startsWith('ridb_') && <View style={styles.detailSourceBadge}><Text style={styles.detailSourceTxt}>🏕️ Recreation.gov</Text></View>}

              {/* Why we picked this */}
              {stop.reason ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionLabel}>💬 WHY WE PICKED THIS</Text>
                  <Text style={styles.detailReasonText}>{stop.reason}</Text>
                </View>
              ) : null}

              {/* Highlights */}
              {stop.highlights?.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionLabel}>✨ HIGHLIGHTS</Text>
                  {stop.highlights.map((h, i) => {
                    const cfg = highlightConfig[h.type] ?? highlightConfig.feature;
                    return (
                      <View key={i} style={[styles.highlightRow, { borderLeftColor: cfg.borderColor }]}>
                        <Text style={styles.highlightIcon}>{cfg.icon}</Text>
                        <Text style={styles.highlightText}>{h.text}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Stats row */}
              {(stop.distance || stop.excitement_score > 0) && (
                <View style={styles.detailStatsRow}>
                  {stop.distance
                    ? <Text style={styles.detailStatTxt}>📍 {stop.distance} away</Text>
                    : <View />
                  }
                  {stop.excitement_score > 0 && (
                    <View style={styles.detailExciteBadge}>
                      <Text style={styles.detailExciteTxt}>⚡ Score: {stop.excitement_score}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Navigate button */}
              <TouchableOpacity style={styles.detailNavBtn} onPress={handleNavigate} activeOpacity={0.7}>
                <Text style={styles.detailNavBtnTxt}>NAVIGATE HERE →</Text>
              </TouchableOpacity>

              {/* Call + Website */}
              {(phone || website) && (
                <View style={styles.detailSecondaryBtns}>
                  {phone ? (
                    <TouchableOpacity
                      style={styles.detailSecBtn}
                      onPress={() => Linking.openURL(`tel:${phone}`)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.detailSecBtnTxt}>📞 Call</Text>
                    </TouchableOpacity>
                  ) : null}
                  {website ? (
                    <TouchableOpacity
                      style={styles.detailSecBtn}
                      onPress={() => Linking.openURL(website)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.detailSecBtnTxt}>🌐 Website</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── StopCard ─────────────────────────────────────────────────────────────────
function StopCard({ stop, isLast, onSwap, isSwapping, onViewDetails }) {
  const [feedback,          setFeedback]          = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const color = CATEGORY_COLORS[stop.category] ?? '#00D2BE';
  const emoji = CATEGORY_EMOJIS[stop.category] ?? '⚡';

  useEffect(() => {
    if (!stop.place_id) return;
    AsyncStorage.getItem(`@decide/feedback_${stop.place_id}`)
      .then((raw) => { if (raw) { try { setFeedback(JSON.parse(raw).feedback); } catch {} } })
      .catch(() => {});
  }, [stop.place_id]);

  const saveFeedback = (type, reason = null) => {
    if (!stop.place_id) return;
    const data = { placeId: stop.place_id, placeName: stop.name, feedback: type, reason, timestamp: Date.now() };
    AsyncStorage.setItem(`@decide/feedback_${stop.place_id}`, JSON.stringify(data)).catch(() => {});
    setFeedback(type);
  };

  return (
    <>
      <TouchableOpacity activeOpacity={0.7} onPress={() => onViewDetails(stop)} disabled={isSwapping} style={styles.stopRow}>
        <View style={styles.timelineCol}>
          <View style={[styles.timelineDot, { backgroundColor: color }]} />
          {!isLast && <View style={[styles.timelineLine, { backgroundColor: color + '33' }]} />}
        </View>
        <View style={[styles.stopCard, { borderLeftColor: color }, isSwapping && styles.stopCardSwapping]}>
          <View style={styles.stopHeaderRow}>
            <View style={[styles.timeChip, { backgroundColor: color + '22', borderColor: color + '55' }]}>
              <Text style={[styles.timeText, { color }]}>{stop.time}</Text>
            </View>
            <Text style={styles.durationText}>{stop.duration_mins} min</Text>
            <View style={[styles.catChip, { backgroundColor: color + '22' }]}>
              <Text style={styles.catEmoji}>{emoji}</Text>
              <Text style={[styles.catLabel, { color }]}>{stop.category}</Text>
            </View>
          </View>
          <Text style={styles.stopName} numberOfLines={1}>{stop.name}</Text>
          {stop.address ? <Text style={styles.stopAddress} numberOfLines={1}>{stop.address}</Text> : null}
          {stop.reason  ? <Text style={styles.stopReason}>💬 {stop.reason}</Text> : null}
          <View style={styles.cardActionsRow}>
            {stop.excitement_score > 0
              ? <View style={styles.exciteBadge}><Text style={styles.exciteText}>⚡{stop.excitement_score}</Text></View>
              : <View />
            }
            <TouchableOpacity style={styles.swapBtn} onPress={onSwap} disabled={isSwapping} activeOpacity={0.7}>
              {isSwapping
                ? <View style={styles.swapLoadingRow}><ActivityIndicator size="small" color="#555" style={{ marginRight: 5 }} /><Text style={styles.swapBtnText}>Finding...</Text></View>
                : <Text style={styles.swapBtnText}>🔄 Swap</Text>
              }
            </TouchableOpacity>
          </View>
          <View style={styles.thumbsRow}>
            <TouchableOpacity style={[styles.thumbBtn, feedback === 'up' && styles.thumbBtnUp]} onPress={() => saveFeedback('up')} activeOpacity={0.7}>
              <Text style={styles.thumbTxt}>👍</Text>
            </TouchableOpacity>
            <View style={styles.thumbDivider} />
            <TouchableOpacity style={[styles.thumbBtn, feedback === 'down' && styles.thumbBtnDown]} onPress={() => setShowFeedbackModal(true)} activeOpacity={0.7}>
              <Text style={styles.thumbTxt}>👎</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tapHint}>
            <Text style={styles.tapHintTxt}>Tap for details ›</Text>
          </View>
        </View>
      </TouchableOpacity>
      <FeedbackModal
        visible={showFeedbackModal}
        placeName={stop.name}
        onClose={() => setShowFeedbackModal(false)}
        onSelect={(reason) => { saveFeedback('down', reason); setShowFeedbackModal(false); }}
      />
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
  const [view, setView] = useState('landing');

  const [locationLabel, setLocationLabel] = useState('Locating...');
  const [isManual,      setIsManual]      = useState(false);
  const [displayName,   setDisplayName]   = useState('');
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

  const [itinerary,      setItinerary]      = useState(null);
  const [weather,        setWeather]        = useState(null);
  const [meta,           setMeta]           = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [swappingIndex,  setSwappingIndex]  = useState(null);
  const [error,          setError]          = useState(null);
  const [isFallback,     setIsFallback]     = useState(false);
  const [coords,         setCoords]         = useState(null);
  const [planDate,       setPlanDate]       = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [selectedStop,    setSelectedStop]    = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const pulseLoop   = useRef(null);
  const seenDateRef = useRef(null);
  const params      = useLocalSearchParams();

  const isValidTimeWindow = timeToMinutes(endTime) - timeToMinutes(startTime) >= 180;

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const [modeRaw, locRaw] = await Promise.all([
          AsyncStorage.getItem('@decide/location_mode'),
          AsyncStorage.getItem('@decide/manual_location'),
        ]);
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

      if (gpsLoadedRef.current) {
        if (gpsLabelRef.current) {
          setIsManual(false);
          setLocationLabel(gpsLabelRef.current);
          setCoords(gpsCoordsRef.current);
        }
        return;
      }
      gpsLoadedRef.current = true;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationLabel('Location unavailable'); return; }
      const pos = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = pos.coords;
      setCoords({ latitude, longitude });
      gpsCoordsRef.current = { latitude, longitude };
      AsyncStorage.setItem('lastKnownCoords', JSON.stringify({ latitude, longitude })).catch(() => {});

      const key = GOOGLE_KEY;
      if (key && key !== 'your_api_key_here') {
        const base = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${key}`;
        const url  = Platform.OS === 'web' ? `https://corsproxy.io/?${encodeURIComponent(base)}` : base;
        try {
          const geoRes  = await fetch(url);
          const geoData = await geoRes.json();
          if (geoData.results?.length > 0) {
            const parts = geoData.results[0].address_components;
            const get   = (t) => parts.find((c) => c.types.includes(t));
            const hood  = get('neighborhood')?.long_name || get('sublocality')?.long_name;
            const city  = get('locality')?.long_name;
            const state = get('administrative_area_level_1')?.short_name;
            const place = hood || city;
            const label = place && state ? `${place}, ${state}` :
                          place          ? place :
                          state          ? state :
                          `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
            gpsLabelRef.current = label;
            setLocationLabel(label);
          } else {
            const label = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
            gpsLabelRef.current = label;
            setLocationLabel(label);
          }
        } catch {
          const label = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
          gpsLabelRef.current = label;
          setLocationLabel(label);
        }
      } else {
        const label = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
        gpsLabelRef.current = label;
        setLocationLabel(label);
      }
    })();
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
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [loading]);

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
    setItinerary(null); setWeather(null); setMeta(null); setError(null); setIsFallback(false);
    setView('landing');
  };

  const generate = async () => {
    if (!coords) { setError('Location not available yet. Please wait a moment.'); return; }
    if (!isValidTimeWindow) return;
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

      const data = await generateItinerary({
        latitude:  coords.latitude,
        longitude: coords.longitude,
        preferences: { pace, budget, group_type: groupType, cuisines },
        startTime, endTime, date: planDate,
        feedback: feedbackCtx,
      });
      setItinerary(data.itinerary);
      setWeather(data.weather);
      setMeta(data.meta);
      setIsFallback(data.isFallback ?? false);
      setView('itinerary');

      try {
        const raw      = await AsyncStorage.getItem('@decide/itineraries');
        const existing = raw ? JSON.parse(raw) : [];
        const entry    = {
          id:        `itinerary_${Date.now()}`,
          timestamp: Date.now(),
          meta:      data.meta,
          weather:   data.weather,
          stops:     (data.itinerary ?? []).map((s) => ({ name: s.name, category: s.category })),
          feedback:  null, feedbackReason: null,
        };
        await AsyncStorage.setItem(
          '@decide/itineraries',
          JSON.stringify([entry, ...existing.slice(0, 49)])
        );
      } catch (e) {
        console.warn('[history] save itinerary error', e);
      }
    } catch (err) {
      console.error('[plan] generate error:', err);
      setError(err.message ?? 'Something went wrong. Try again.');
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
      setError(err.message ?? 'Could not swap stop. Try again.');
    } finally {
      setSwappingIndex(null);
    }
  };

  const handleNavigateFullDay = () => {
    if (!itinerary?.length) return;
    const encode = (s) => s.lat && s.lng
      ? `${s.lat},${s.lng}`
      : encodeURIComponent(s.address || s.name);
    const stops = itinerary.map(encode);
    let url = `https://www.google.com/maps/dir/?api=1&origin=${stops[0]}&destination=${stops[stops.length - 1]}&travelmode=driving`;
    if (stops.length > 2) url += `&waypoints=${stops.slice(1, -1).join('|')}`;
    Linking.openURL(url);
  };

  const resetToConfiguring = () => {
    setItinerary(null); setWeather(null); setMeta(null); setError(null); setIsFallback(false);
    setView('configuring');
  };

  const locationPillText = `${isManual ? '📌' : '📍'} ${locationLabel}`;
  const hasItinerary     = Array.isArray(itinerary) && itinerary.length > 0;
  const weatherPillText  = weather
    ? `${weather.emoji ?? ''} ${weather.condition} · ${weather.temp_f}°F${weather.wind_speed_mph ? ` · 🌬 ${weather.wind_speed_mph}mph` : ''} · ${meta?.time_window ?? `${startTime} – ${endTime}`}`
    : `${startTime} – ${endTime}`;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ─────────────────── LANDING VIEW ─────────────────────────────── */}
        {view === 'landing' && (
          <View style={styles.landingContainer}>
            <View style={styles.landingHeader}>
              {displayName ? (
                <Text style={styles.landingGreeting}>Hey, {displayName} 👋</Text>
              ) : null}
              <Text style={styles.landingTitle}>DECIDE</Text>
              <View style={styles.locationPill}>
                <Text style={styles.locationText}>{locationPillText}</Text>
              </View>
            </View>

            <View style={styles.landingButtons}>
              <TouchableOpacity
                style={[styles.decideBtn, styles.decideBtnPrimary]}
                activeOpacity={0.7}
                onPress={handleToday}
              >
                <Text style={styles.decideBtnTitle}>🎯  TODAY</Text>
                <Text style={styles.decideBtnSub}>Generate my full day itinerary</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.decideBtn, styles.decideBtnSecondary]}
                activeOpacity={0.7}
                onPress={() => setShowWeekPicker(true)}
              >
                <Text style={[styles.decideBtnTitle, { color: '#00D2BE' }]}>📅  THIS WEEK</Text>
                <Text style={[styles.decideBtnSub, { color: '#555' }]}>Plan a specific day</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.landingSubtext}>AI-planned itinerary based on your location</Text>
          </View>
        )}

        {/* ─────────────────── CONFIGURING VIEW ─────────────────────────── */}
        {view === 'configuring' && (
          <View style={styles.planContainer}>
            <View style={styles.header}>
              <TouchableOpacity onPress={goToLanding} activeOpacity={0.7} style={styles.backRow}>
                <Text style={styles.backText}>← DECIDE</Text>
              </TouchableOpacity>
              <Text style={styles.appName}>PLAN YOUR DAY</Text>
              <View style={styles.headerPill}>
                <Text style={styles.headerPillText}>{locationPillText}</Text>
              </View>
            </View>

            <View style={styles.prefsCard}>
              <Text style={styles.prefLabel}>DATE</Text>
              <TouchableOpacity
                style={[styles.datePill, loading && { opacity: 0.5 }]}
                onPress={() => !loading && setShowDatePicker(true)}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Text style={styles.datePillValue}>📅  {datePillLabel(planDate)}</Text>
                <Text style={styles.datePillChevron}>▾</Text>
              </TouchableOpacity>

              <Text style={styles.prefLabel}>PACE</Text>
              <PillRow options={PACE_OPTIONS}   selected={pace}      onSelect={setPace}      disabled={loading} />

              <Text style={styles.prefLabel}>BUDGET</Text>
              <PillRow options={BUDGET_OPTIONS} selected={budget}    onSelect={setBudget}    disabled={loading} />

              <Text style={styles.prefLabel}>GROUP</Text>
              <PillRow options={GROUP_OPTIONS}  selected={groupType} onSelect={setGroupType} disabled={loading} />

              <Text style={styles.prefLabel}>TIME WINDOW</Text>
              <View style={styles.timePickerRow}>
                <TimePickerPill label="Start" value={startTime} options={START_TIMES} onChange={setStartTime} disabled={loading} />
                <Text style={styles.timeArrow}>→</Text>
                <TimePickerPill label="End"   value={endTime}   options={END_TIMES}   onChange={setEndTime}   disabled={loading} />
              </View>
              {!isValidTimeWindow && (
                <Text style={styles.timeValidationHint}>⚠ Please allow at least 3 hours</Text>
              )}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        )}

        {/* ─────────────────── ITINERARY VIEW ────────────────────────────── */}
        {view === 'itinerary' && hasItinerary && (
          <View style={styles.planContainer}>
            <View style={styles.header}>
              <Text style={styles.appName}>PLAN YOUR DAY</Text>
              <View style={styles.headerPill}>
                <Text style={styles.headerPillText}>{weatherPillText}</Text>
              </View>
            </View>

            <View style={styles.itineraryContainer}>
              {isFallback && (
                <View style={styles.fallbackBanner}>
                  <Text style={styles.fallbackBannerTxt}>
                    ⚠ Offline mode — Claude unavailable. Showing top-rated nearby places.
                  </Text>
                </View>
              )}
              {meta && (
                <View style={styles.itineraryMeta}>
                  <Text style={styles.itineraryDay}>{meta.day_of_week}</Text>
                  <Text style={styles.itineraryDate}>{meta.date} · {itinerary.length} stops</Text>
                  {meta.city ? <Text style={styles.itineraryCity}>📍 {meta.city}</Text> : null}
                  <View style={styles.metaChips}>
                    {meta.time_window && (
                      <View style={[styles.metaChip, styles.metaChipTime]}>
                        <Text style={[styles.metaChipText, styles.metaChipTimeText]}>🕐 {meta.time_window}</Text>
                      </View>
                    )}
                    {[meta.preferences?.pace, meta.preferences?.budget, meta.preferences?.group_type]
                      .filter(Boolean)
                      .map((v) => (
                        <View key={v} style={styles.metaChip}>
                          <Text style={styles.metaChipText}>{v}</Text>
                        </View>
                      ))}
                  </View>
                </View>
              )}

              {itinerary.map((stop, i) => (
                <StopCard
                  key={`${stop.place_id}-${i}`}
                  stop={stop}
                  index={i}
                  isLast={i === itinerary.length - 1}
                  onSwap={() => handleSwap(i)}
                  isSwapping={swappingIndex === i}
                  onViewDetails={(s) => { setSelectedStop(s); setShowDetailModal(true); }}
                />
              ))}

              <TouchableOpacity
                style={styles.resetBtn}
                onPress={resetToConfiguring}
                disabled={swappingIndex !== null}
                activeOpacity={0.7}
              >
                <Text style={styles.resetBtnText}>🔄  Change Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: view === 'landing' ? 40 : 100 }} />
      </ScrollView>

      {/* Sticky generate button (configuring view) */}
      {view === 'configuring' && (
        <View style={styles.stickyNavContainer}>
          <Animated.View style={{ opacity: loading ? pulseAnim : 1 }}>
            <TouchableOpacity
              style={[styles.generateBtn, (loading || !isValidTimeWindow) && styles.generateBtnDisabled]}
              onPress={generate}
              disabled={loading || !isValidTimeWindow}
              activeOpacity={0.7}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#00191f" size="small" style={{ marginRight: 10 }} />
                  <Text style={styles.generateBtnText}>Building your day...</Text>
                </View>
              ) : (
                <Text style={styles.generateBtnText}>✨  GENERATE MY DAY</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
          {!loading && <Text style={styles.generateSubtext}>AI-curated itinerary based on your location</Text>}
        </View>
      )}

      {/* Sticky navigate button (itinerary view) */}
      {view === 'itinerary' && hasItinerary && (
        <View style={styles.stickyNavContainer}>
          <TouchableOpacity style={styles.stickyNavBtn} onPress={handleNavigateFullDay} activeOpacity={0.7}>
            <Text style={styles.stickyNavTxt}>🗺️  NAVIGATE FULL DAY</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Week picker */}
      <Modal visible={showWeekPicker} transparent animationType="slide" onRequestClose={() => setShowWeekPicker(false)}>
        <TouchableOpacity style={styles.weekPickerOverlay} activeOpacity={1} onPress={() => setShowWeekPicker(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.weekPickerCard}>
              <View style={styles.weekPickerHeader}>
                <Text style={styles.weekPickerTitle}>CHOOSE A DAY</Text>
                <TouchableOpacity style={styles.weekPickerClose} onPress={() => setShowWeekPicker(false)} activeOpacity={0.7}>
                  <Text style={styles.weekPickerCloseTxt}>✕</Text>
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
                <Text style={styles.weekPickerTitle}>CHOOSE A DAY</Text>
                <TouchableOpacity style={styles.weekPickerClose} onPress={() => setShowDatePicker(false)} activeOpacity={0.7}>
                  <Text style={styles.weekPickerCloseTxt}>✕</Text>
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
  screen:        { flex: 1, backgroundColor: '#00191f' },
  scroll:        { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // ── Landing ──────────────────────────────────────────────────────────────
  landingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 40, paddingBottom: 48,
  },
  landingHeader: { alignItems: 'center', marginBottom: 48 },
  landingGreeting: { fontSize: 13, color: '#00a896', fontWeight: '500', letterSpacing: 0.3 },
  landingTitle:  { fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: 6 },
  locationPill: {
    marginTop: 12, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#00262e',
    borderWidth: 0.5, borderColor: '#003040',
  },
  locationText:  { fontSize: 13, color: '#888', letterSpacing: 0.3 },
  landingButtons: { width: '100%', gap: 12, marginBottom: 28 },
  decideBtn: {
    width: '100%', height: 56, paddingHorizontal: 24,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  decideBtnPrimary: {
    backgroundColor: '#00d2be',
    shadowColor: '#00d2be', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 18, elevation: 18,
  },
  decideBtnSecondary: { backgroundColor: '#00262e', borderWidth: 1, borderColor: '#003040' },
  decideBtnTitle: { color: '#00191f', fontSize: 15, fontWeight: '800', letterSpacing: 3 },
  decideBtnSub:   { color: 'rgba(255,255,255,0.45)', fontSize: 11, letterSpacing: 0.4 },
  landingSubtext: { fontSize: 12, color: '#7c3aed', letterSpacing: 0.3, textAlign: 'center' },

  // ── Plan / Itinerary container ────────────────────────────────────────────
  planContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },

  // Header
  header:         { alignItems: 'center', marginBottom: 24 },
  backRow:        { marginBottom: 8 },
  backText:       { fontSize: 12, color: '#00D2BE', fontWeight: '600', letterSpacing: 1 },
  appName:        { fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: 5 },
  headerPill: {
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, backgroundColor: '#00262e',
    borderWidth: 1, borderColor: '#003040',
  },
  headerPillText: { fontSize: 13, color: '#888', letterSpacing: 0.3 },

  // Preferences card
  prefsCard: {
    backgroundColor: '#00262e', borderRadius: 18,
    borderWidth: 0.5, borderColor: '#003040',
    padding: 18, marginBottom: 16, gap: 10,
    overflow: 'hidden',
  },
  datePill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#00262e', borderRadius: 12,
    borderWidth: 1, borderColor: '#003040',
    paddingHorizontal: 14, paddingVertical: 11,
  },
  datePillValue:   { fontSize: 14, fontWeight: '700', color: '#00D2BE' },
  datePillChevron: { fontSize: 11, color: '#555' },
  prefLabel:       { fontSize: 11, fontWeight: '700', color: '#a855f7', letterSpacing: 2, marginTop: 4, textTransform: 'uppercase' },
  pillsRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prefPill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 16, borderWidth: 1,
    backgroundColor: '#00262e', borderColor: '#003040',
  },
  prefPillActive:     { backgroundColor: '#00d2be', borderColor: '#00d2be' },
  prefPillText:       { fontSize: 13, fontWeight: '600', color: '#00D2BE' },
  prefPillTextActive: { color: '#00191f' },
  timePickerRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeArrow:          { color: '#444', fontSize: 16, fontWeight: '300' },
  timePill: {
    flex: 1, backgroundColor: '#00262e', borderRadius: 12,
    borderWidth: 1, borderColor: '#003040',
    paddingHorizontal: 12, paddingVertical: 9, gap: 3,
  },
  timePillLabel:      { fontSize: 9, fontWeight: '700', color: '#00a896', letterSpacing: 1.5 },
  timePillInner:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timePillValue:      { fontSize: 14, fontWeight: '700', color: '#00D2BE' },
  timePillChevron:    { fontSize: 11, color: '#555' },
  timeValidationHint: { fontSize: 11, color: '#f87171', marginTop: 2, letterSpacing: 0.2 },

  // Time picker modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  modalCard: {
    backgroundColor: '#00262e', borderRadius: 18,
    borderWidth: 1, borderColor: '#003040',
    width: 240, overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 10, fontWeight: '700', color: '#00a896', letterSpacing: 2,
    textAlign: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#003040',
  },
  modalOption:           { paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#00262e' },
  modalOptionActive:     { backgroundColor: '#001419' },
  modalOptionText:       { fontSize: 15, fontWeight: '500', color: '#666', textAlign: 'center' },
  modalOptionTextActive: { color: '#00D2BE', fontWeight: '700' },

  // Error text
  errorText: {
    color: '#f87171', fontSize: 13, textAlign: 'center',
    backgroundColor: '#2d1515', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#5c1f1f',
    marginBottom: 8,
  },

  // Generate button (in sticky footer)
  loadingRow:      { flexDirection: 'row', alignItems: 'center' },
  generateBtn: {
    backgroundColor: '#00d2be', borderRadius: 16,
    height: 56, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#00d2be', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 16, elevation: 16,
  },
  generateBtnDisabled: { opacity: 0.45 },
  generateBtnText:     { color: '#00191f', fontSize: 15, fontWeight: '800', letterSpacing: 2.5 },
  generateSubtext:     { textAlign: 'center', fontSize: 12, color: '#444', letterSpacing: 0.3, marginTop: 8 },

  // Itinerary
  fallbackBanner: {
    marginBottom: 16, borderRadius: 12,
    backgroundColor: '#2d1b0022', borderWidth: 1, borderColor: '#78350f88',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  fallbackBannerTxt: { fontSize: 12, color: '#fbbf24', lineHeight: 17 },
  itineraryContainer: { gap: 0 },
  itineraryMeta: {
    alignItems: 'center', marginBottom: 24,
    paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#003040',
  },
  itineraryDay:  { fontSize: 26, fontWeight: '800', color: '#ffffff' },
  itineraryDate: { fontSize: 13, color: '#555', marginTop: 4 },
  itineraryCity: { fontSize: 12, color: '#a855f7', marginTop: 3 },
  metaChips:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
  metaChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: '#00262e',
    borderWidth: 1, borderColor: '#003040',
  },
  metaChipTime:     { borderColor: '#003040', backgroundColor: '#001419' },
  metaChipText:     { color: '#00D2BE', fontSize: 11, fontWeight: '600' },
  metaChipTimeText: { color: '#00f5e9' },

  // Stop card + timeline
  stopRow:      { flexDirection: 'row', marginBottom: 14 },
  timelineCol:  { width: 28, alignItems: 'center' },
  timelineDot:  { width: 10, height: 10, borderRadius: 5, marginTop: 16, zIndex: 1 },
  timelineLine: { flex: 1, width: 2, marginTop: 2 },
  stopCard: {
    flex: 1, backgroundColor: '#00262e', borderRadius: 16,
    borderWidth: 0.5, borderColor: '#003040', borderLeftWidth: 3,
    padding: 14, gap: 6, overflow: 'hidden',
  },
  stopCardSwapping: { opacity: 0.6 },
  stopHeaderRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  timeChip:         { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  timeText:         { fontSize: 12, fontWeight: '700' },
  durationText:     { fontSize: 11, color: '#555' },
  catChip:          { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  catEmoji:         { fontSize: 12 },
  catLabel:         { fontSize: 11, fontWeight: '600' },
  stopName:         { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  stopAddress:      { fontSize: 11, color: '#555', lineHeight: 16 },
  stopReason:       { fontSize: 13, color: '#777', lineHeight: 17, fontStyle: 'italic' },
  cardActionsRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  exciteBadge:      { backgroundColor: '#9333EA', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  exciteText:       { color: '#fff', fontSize: 10, fontWeight: '700' },
  swapBtn:          { paddingVertical: 4, paddingHorizontal: 6 },
  swapBtnText:      { color: '#555', fontSize: 11, fontWeight: '500' },
  swapLoadingRow:   { flexDirection: 'row', alignItems: 'center' },
  thumbsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    marginTop: 6, paddingTop: 8,
    borderTopWidth: 0.5, borderTopColor: '#003040',
  },
  thumbBtn:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  thumbBtnUp:   { backgroundColor: '#14532d33' },
  thumbBtnDown: { backgroundColor: '#7f1d1d33' },
  thumbTxt:     { fontSize: 14 },
  thumbDivider: { width: 1, height: 16, backgroundColor: '#003040', marginHorizontal: 4 },

  resetBtn: {
    marginTop: 10, borderRadius: 16, height: 56,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00262e', borderWidth: 1, borderColor: '#003040',
  },
  resetBtnText: { color: '#00D2BE', fontSize: 15, fontWeight: '700' },

  // Shared sticky footer
  stickyNavContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: 28, paddingTop: 12,
    backgroundColor: '#00191f',
    borderTopWidth: 1, borderTopColor: '#003040',
  },
  stickyNavBtn: {
    backgroundColor: '#00d2be', borderRadius: 16,
    height: 56, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#00d2be', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 20, elevation: 20,
  },
  stickyNavTxt: { color: '#00191f', fontSize: 15, fontWeight: '800', letterSpacing: 2.5 },

  // Week / Date picker
  weekPickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  weekPickerCard: {
    backgroundColor: '#00262e',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: '#003040',
    paddingBottom: 34, overflow: 'hidden',
  },
  weekPickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: '#003040',
  },
  weekPickerTitle:   { fontSize: 11, fontWeight: '700', color: '#a855f7', letterSpacing: 2 },
  weekPickerClose: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#00262e', alignItems: 'center', justifyContent: 'center',
  },
  weekPickerCloseTxt: { color: '#666', fontSize: 13, fontWeight: '600' },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 17,
    borderBottomWidth: 1, borderBottomColor: '#00262e',
  },
  dayRowLast:    { borderBottomWidth: 0 },
  dayLabel:      { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  dayLabelToday: { color: '#00D2BE' },
  daySub:        { fontSize: 13, color: '#555' },

  // Feedback modal
  fbOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  fbCard: {
    backgroundColor: '#00262e',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: '#003040',
    paddingBottom: 34, overflow: 'hidden',
  },
  fbTitle: {
    fontSize: 11, fontWeight: '700', color: '#a855f7', letterSpacing: 2,
    textAlign: 'center', paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: '#003040',
  },
  fbPlace:     { fontSize: 14, fontWeight: '600', color: '#fff', paddingHorizontal: 24, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#00262e' },
  fbOption:    { paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#00262e' },
  fbOptionTxt: { fontSize: 15, fontWeight: '500', color: '#C0DCD9' },
  fbCancel: {
    marginHorizontal: 20, marginTop: 14,
    borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00262e', borderWidth: 1, borderColor: '#003040',
  },
  fbCancelTxt: { color: '#666', fontSize: 14, fontWeight: '600' },

  // Tap-for-details hint
  tapHint:    { alignItems: 'center', paddingTop: 6, paddingBottom: 2 },
  tapHintTxt: { fontSize: 11, color: '#3a5a5e', fontWeight: '500' },

  // Place detail modal
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  detailSheet: {
    backgroundColor: '#00262e',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: '#003040',
    overflow: 'hidden',
  },
  dragHandle: {
    width: 32, height: 4, borderRadius: 2,
    backgroundColor: '#3a5a5e',
    alignSelf: 'center', marginTop: 10, marginBottom: 2,
  },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: '#003040',
  },
  detailCatPill:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  detailCatPillTxt: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  detailCloseBtn:   { width: 30, height: 30, borderRadius: 15, backgroundColor: '#001419', alignItems: 'center', justifyContent: 'center' },
  detailCloseTxt:   { color: '#888', fontSize: 14, fontWeight: '600' },
  detailScroll:     { paddingHorizontal: 20, paddingTop: 16 },
  detailName:       { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  detailAddr:       { fontSize: 13, color: '#555', marginBottom: 14, lineHeight: 18 },

  detailInfoRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 18 },
  detailInfoTxt:  { fontSize: 13, fontWeight: '600', color: '#00d2be' },
  detailInfoDot:  { fontSize: 13, color: '#3a5a5e' },

  detailSection:      { marginBottom: 18 },
  detailSectionLabel: { fontSize: 11, fontWeight: '700', color: '#00a896', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' },
  detailReasonText:   { fontSize: 15, color: '#ffffff', lineHeight: 22, fontStyle: 'italic' },

  highlightRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#001419', borderRadius: 8, padding: 10,
    borderLeftWidth: 3, marginBottom: 6,
  },
  highlightIcon: { fontSize: 16, lineHeight: 20 },
  highlightText: { flex: 1, fontSize: 14, color: '#ffffff', lineHeight: 20 },

  detailStatsRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  detailStatTxt:     { fontSize: 13, color: '#4a8a84' },
  detailExciteBadge: { backgroundColor: '#9333EA22', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#9333EA44' },
  detailExciteTxt:   { color: '#a855f7', fontSize: 12, fontWeight: '700' },

  detailNavBtn: {
    backgroundColor: '#00d2be', borderRadius: 16,
    height: 56, alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#00d2be', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
  },
  detailNavBtnTxt: { color: '#00191f', fontSize: 15, fontWeight: '800', letterSpacing: 2 },

  detailSecondaryBtns: { flexDirection: 'row', gap: 10 },
  detailSecBtn: {
    flex: 1, height: 48, borderRadius: 14,
    backgroundColor: '#001419', borderWidth: 1, borderColor: '#003040',
    alignItems: 'center', justifyContent: 'center',
  },
  detailSecBtnTxt: { fontSize: 14, fontWeight: '600', color: '#00a896' },

  detailSourceBadge: { backgroundColor: '#001419', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 14, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#003040' },
  detailSourceTxt:   { color: '#00f5e9', fontSize: 12, fontWeight: '600' },
});
