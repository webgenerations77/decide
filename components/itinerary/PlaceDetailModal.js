import { useState, useEffect } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, ActivityIndicator,
  Linking, Dimensions, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, CATEGORY_COLORS, CATEGORY_EMOJIS, FONTS } from '../../constants/theme';
import { placeDetails as fetchPlaceDetails } from '../../services/placesService';
import SectionLabel from '../brand/SectionLabel';
import { openMaps, highlightConfig } from './helpers';
import PriceLegendModal from './PriceLegendModal';

// ─── PlaceDetailModal ─────────────────────────────────────────────────────────
function PlaceDetailModal({ visible, stop, onClose }) {
  const [placeDetails,  setPlaceDetails]  = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showLegend,    setShowLegend]    = useState(false);
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    if (!visible || !stop) { setPlaceDetails(null); return; }
    const pid = stop.place_id ?? '';
    const isDemo     = pid.startsWith('demo_');
    const isExternal = pid.startsWith('nps_') || pid.startsWith('ridb_');
    if (isDemo || isExternal || !pid) {
      setPlaceDetails(null);
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    setPlaceDetails(null);
    const fields = 'name,rating,user_ratings_total,formatted_phone_number,website,opening_hours,price_level';
    fetchPlaceDetails(pid, fields)
      .then((data) => { setPlaceDetails(data.result ?? null); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }, [visible, stop?.place_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stop) return null;

  const color    = CATEGORY_COLORS[stop.category] ?? COLORS.amber;
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

  const hasInfoRow = rating > 0 || priceStr || openNow != null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.detailOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[styles.detailSheet, { height: screenHeight * 0.75 }]}>
            <View style={styles.dragHandle} />

            <View style={styles.detailHeader}>
              <View style={[styles.detailCatPill, { backgroundColor: color + '22' }]}>
                <Text style={[styles.detailCatPillTxt, { color }]}>{catEmoji} {(stop.category ?? '').toUpperCase()}</Text>
              </View>
              <TouchableOpacity style={styles.detailCloseBtn} onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.detailScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 32 }}
            >
              <Text style={styles.detailName}>{stop.name}</Text>
              {stop.address ? <Text style={styles.detailAddr}>{stop.address}</Text> : null}

              {hasInfoRow && (
                <View style={styles.detailInfoRow}>
                  {rating > 0 && (
                    <Text style={styles.detailInfoTxt}>
                      ⭐ {typeof rating === 'number' ? rating.toFixed(1) : rating}
                    </Text>
                  )}
                  {priceStr && (
                    <>
                      <Text style={styles.detailInfoDot}>·</Text>
                      <TouchableOpacity onPress={() => setShowLegend(true)} activeOpacity={0.7}>
                        <Text style={[styles.detailInfoTxt, { color: COLORS.goldText }]}>{priceStr} ⓘ</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {openNow != null && (
                    <>
                      <Text style={styles.detailInfoDot}>·</Text>
                      <Text style={[styles.detailInfoTxt, { color: openNow ? COLORS.success : COLORS.error }]}>
                        {openNow ? '● Open' : '● Closed'}
                      </Text>
                    </>
                  )}
                  {todayHours && (
                    <><Text style={styles.detailInfoDot}>·</Text><Text style={styles.detailInfoTxt}>{todayHours}</Text></>
                  )}
                </View>
              )}

              {stop.admission_cost && (
                <View style={styles.admissionRow}>
                  <Ionicons name="ticket-outline" size={14} color={COLORS.gold} />
                  <Text style={styles.admissionLabel}>Admission</Text>
                  <Text style={styles.admissionValue}>{stop.admission_cost}</Text>
                </View>
              )}

              {stop.live_music?.note ? (
                <View style={styles.admissionRow}>
                  <Ionicons name="musical-notes-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.admissionLabel}>Live music</Text>
                  <Text style={styles.admissionValue}>{stop.live_music.note}</Text>
                </View>
              ) : null}

              {detailLoading && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />}

              {stop.place_id?.startsWith('nps_')  && <View style={styles.detailSourceBadge}><Text style={styles.detailSourceTxt}>🌲 National Park Service</Text></View>}
              {stop.place_id?.startsWith('ridb_') && <View style={styles.detailSourceBadge}><Text style={styles.detailSourceTxt}>🏕️ Recreation.gov</Text></View>}

              {stop.reason ? (
                <View style={styles.detailSection}>
                  <SectionLabel tone="cobalt" style={{ marginBottom: 10 }}>Cheddar's take</SectionLabel>
                  <Text style={styles.detailReasonText}>{stop.reason}</Text>
                </View>
              ) : null}

              {stop.highlights?.length > 0 && (
                <View style={styles.detailSection}>
                  <SectionLabel tone="cobalt" style={{ marginBottom: 10 }}>Highlights</SectionLabel>
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

              {(stop.distance || stop.excitement_score > 0) && (
                <View style={styles.detailStatsRow}>
                  {stop.distance ? (
                    <TouchableOpacity onPress={() => openMaps(stop)} activeOpacity={0.7} style={styles.distanceLink}>
                      <Ionicons name="location-outline" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
                      <Text style={styles.distanceLinkTxt}>{stop.distance}</Text>
                    </TouchableOpacity>
                  ) : <View />}
                  {stop.excitement_score > 0 && (
                    <View style={styles.detailExciteBadge}>
                      <Text style={styles.detailExciteTxt}>⚡ {stop.excitement_score}</Text>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity style={styles.detailNavBtn} onPress={() => openMaps(stop)} activeOpacity={0.7}>
                <Ionicons name="navigate" size={18} color={COLORS.primaryText} style={{ marginRight: 8 }} />
                <Text style={styles.detailNavBtnTxt}>Navigate here</Text>
              </TouchableOpacity>

              {(phone || website) && (
                <View style={styles.detailSecondaryBtns}>
                  {phone ? (
                    <TouchableOpacity
                      style={styles.detailSecBtn}
                      onPress={() => Linking.openURL(`tel:${phone}`)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="call-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.detailSecBtnTxt}>Call</Text>
                    </TouchableOpacity>
                  ) : null}
                  {website ? (
                    <TouchableOpacity
                      style={styles.detailSecBtn}
                      onPress={() => Linking.openURL(website)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="globe-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.detailSecBtnTxt}>Website</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>

      <PriceLegendModal visible={showLegend} onClose={() => setShowLegend(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Place detail modal
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  detailSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 2,
  },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  detailCatPill:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  detailCatPillTxt: { fontSize: 11, fontFamily: FONTS.bodyBold, letterSpacing: 1 },
  detailCloseBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  detailScroll:     { paddingHorizontal: 20, paddingTop: 18 },
  detailName:       {
    fontSize: 22, color: COLORS.textPrimary,
    fontFamily: FONTS.display,
    marginBottom: 4,
  },
  detailAddr:       { fontSize: 13, color: COLORS.textMuted, marginBottom: 14, lineHeight: 18 },

  detailInfoRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 18 },
  detailInfoTxt:  { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.goldText },
  detailInfoDot:  { fontSize: 13, color: COLORS.textMuted },

  admissionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.gold + '22', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.gold + '33',
  },
  admissionLabel: { fontSize: 12, fontFamily: FONTS.bodyBold, color: COLORS.primary, letterSpacing: 0.5 },
  admissionValue: { fontSize: 13, color: COLORS.textPrimary, fontFamily: FONTS.bodyMedium, flex: 1 },

  detailSection:      { marginBottom: 18 },
  detailReasonText:   { fontSize: 15, color: COLORS.textPrimary, lineHeight: 23, fontStyle: 'italic', fontFamily: FONTS.body },

  highlightRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: COLORS.surfaceAlt, borderRadius: 8, padding: 10,
    borderLeftWidth: 3, marginBottom: 6,
  },
  highlightIcon: { fontSize: 16, lineHeight: 20 },
  highlightText: { flex: 1, fontSize: 14, color: COLORS.textPrimary, lineHeight: 20, fontFamily: FONTS.body },

  detailStatsRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  distanceLink:    { flexDirection: 'row', alignItems: 'center' },
  distanceLinkTxt: { fontSize: 13, color: COLORS.primary, fontFamily: FONTS.bodySemiBold },
  detailExciteBadge: { backgroundColor: COLORS.gold + '22', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.gold + '44' },
  detailExciteTxt:   { color: COLORS.goldText, fontSize: 12, fontFamily: FONTS.bodyBold },

  detailNavBtn: {
    backgroundColor: COLORS.primary, borderRadius: 16,
    height: 56, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 10,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  detailNavBtnTxt: { color: COLORS.primaryText, fontSize: 16, fontFamily: FONTS.bodyBold },

  detailSecondaryBtns: { flexDirection: 'row', gap: 10 },
  detailSecBtn: {
    flex: 1, height: 48, borderRadius: 14, flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  detailSecBtnTxt: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.primary },

  detailSourceBadge: { backgroundColor: COLORS.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 14, alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.border },
  detailSourceTxt:   { color: COLORS.textSecondary, fontSize: 12, fontFamily: FONTS.bodySemiBold },
});

export default PlaceDetailModal;
