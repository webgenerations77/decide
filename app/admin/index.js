import { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getUsage, getUsers, setUserRole } from '../../services/adminApi';
import ScreenBackground from '../../components/brand/ScreenBackground';
import Card from '../../components/brand/Card';
import SectionLabel from '../../components/brand/SectionLabel';
import LoadingAnimation from '../../components/LoadingAnimation';
import { FONTS, RADII } from '../../constants/theme';
import { PRICING } from '../../constants/pricing';
import { getAdminRole } from '../../utils/admin';

// Berlin, MD — fallback coords so the loading-screen preview's weather card always
// has somewhere to forecast even if no location preference is set.
const PREVIEW_FALLBACK_COORDS = { latitude: 38.3226, longitude: -75.2179 };

const RANGES = ['day', 'week', 'month'];
const money = (n) => `$${(n || 0).toFixed(2)}`;

export default function AdminScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  const [range, setRange] = useState('day');
  const [usage, setUsage] = useState(null);
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewCoords, setPreviewCoords] = useState(PREVIEW_FALLBACK_COORDS);

  const emailByUid = useMemo(() => {
    const m = {};
    (users || []).forEach((u) => { m[u.uid] = u.email; });
    return m;
  }, [users]);

  const userLabel = (uid) => (uid === 'anonymous' ? 'Anonymous' : (emailByUid[uid] || 'Anonymous'));

  async function openLoadingPreview() {
    let coords = PREVIEW_FALLBACK_COORDS;
    try {
      const raw = await AsyncStorage.getItem('@decide/manual_location');
      const loc = raw ? JSON.parse(raw) : null;
      if (loc?.latitude && loc?.longitude) coords = { latitude: loc.latitude, longitude: loc.longitude };
    } catch {}
    setPreviewCoords(coords);
    setLoadingPreview(true);
  }

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.replace('/');
  }, [loading, user, isAdmin]);

  useEffect(() => {
    if (loading || !isAdmin) return;
    getUsage(range).then(setUsage).catch((e) => setErr(e.message));
  }, [range, loading, isAdmin]);

  useEffect(() => {
    if (loading || !isAdmin) return;
    getUsers().then(setUsers).catch((e) => setErr(e.message));
  }, [loading, isAdmin]);

  if (loading || !isAdmin) {
    return <ScreenBackground variant="paper"><View style={styles.center}><ActivityIndicator color={colors.primary} /></View></ScreenBackground>;
  }

  async function toggleBeta(u) {
    const prev = u.role;
    const next = u.role === 'beta_tester' ? null : 'beta_tester';
    setUsers((list) => list.map((x) => (x.uid === u.uid ? { ...x, role: next } : x)));
    try { await setUserRole(u.uid, next); } catch (e) {
      setUsers((list) => list.map((x) => (x.uid === u.uid ? { ...x, role: prev } : x)));
      setErr(e.message);
    }
  }

  return (
    <ScreenBackground variant="paper">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/settings'))}
              style={styles.backBtn}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.title}>Admin</Text>
          </View>
          {err ? <Text style={styles.err}>{err}</Text> : null}

        <SectionLabel tone="cobalt">TOOLS</SectionLabel>
        <Card>
          <Pressable style={styles.toolRow} onPress={openLoadingPreview}>
            <Ionicons name="play-circle-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.toolLabel}>Test loading screen</Text>
              <Text style={styles.toolSub}>Preview the animation + rotating info cards</Text>
            </View>
            <Text style={styles.toolChevron}>›</Text>
          </Pressable>
        </Card>

        <SectionLabel tone="cobalt">API USAGE</SectionLabel>
        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <Pressable key={r} onPress={() => setRange(r)} style={[styles.chip, range === r && styles.chipActive]}>
              <Text style={[styles.chipText, range === r && styles.chipTextActive]}>{r}</Text>
            </Pressable>
          ))}
        </View>
        <Card>
          {!usage ? <ActivityIndicator color={colors.primary} /> : (
            <View>
              <Row label="Requests" value={String(usage.totals.requests)} />
              <Row label="Input tokens" value={usage.totals.inputTokens.toLocaleString()} />
              <Row label="Output tokens" value={usage.totals.outputTokens.toLocaleString()} />
              <Row label="Est. cost" value={money(usage.totals.estCost)} />
              <Text style={styles.pricingNote}>Estimates based on pricing effective {PRICING.effectiveDate}</Text>
              <Text style={styles.subhead}>By model</Text>
              {Object.entries(usage.byModel).map(([m, b]) => <Row key={m} label={m} value={money(b.estCost)} />)}
              <Text style={styles.subhead}>By route</Text>
              {Object.entries(usage.byRoute).map(([r, b]) => <Row key={r} label={r} value={`${b.requests || (b.inputTokens + b.outputTokens > 0 ? '—' : 0)}`} />)}
              <Text style={styles.subhead}>By user</Text>
              {Object.entries(usage.byUser || {})
                .sort((a, b) => (b[1].estCost || 0) - (a[1].estCost || 0))
                .map(([uid, b]) => (
                  <Row key={uid} label={userLabel(uid)} value={`${b.requests} req · ${money(b.estCost)}`} />
                ))}
            </View>
          )}
        </Card>

        <SectionLabel tone="cobalt">USER ADMINISTRATION</SectionLabel>
        <Card>
          {!users ? <ActivityIndicator color={colors.primary} /> : users.map((u) => {
            const rowIsAdmin = getAdminRole({ email: u.email }) === 'admin';
            return (
              <View key={u.uid} style={styles.userRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userEmail}>{u.email}</Text>
                  <Text style={styles.userMeta}>{u.role || 'user'} · {u.status}</Text>
                </View>
                {rowIsAdmin ? (
                  <Text style={styles.adminLabel}>Admin</Text>
                ) : (
                  <Pressable onPress={() => toggleBeta(u)} style={[styles.betaBtn, u.role === 'beta_tester' && styles.betaBtnOn]}>
                    <Text style={[styles.betaBtnText, u.role === 'beta_tester' && styles.betaBtnTextOn]}>
                      {u.role === 'beta_tester' ? 'Beta ✓' : 'Grant beta'}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </Card>
        </ScrollView>

        <Modal visible={loadingPreview} animationType="fade" onRequestClose={() => setLoadingPreview(false)}>
          <ScreenBackground variant="paper">
            <Pressable style={styles.previewOverlay} onPress={() => setLoadingPreview(false)}>
              <LoadingAnimation coords={previewCoords} />
              <Text style={styles.previewHint}>Preview · tap anywhere to close</Text>
            </Pressable>
          </ScreenBackground>
        </Modal>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function Row({ label, value }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { padding: 20, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, marginLeft: -6,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
  },
  title: { fontFamily: FONTS.display, fontSize: 28, color: c.textPrimary },
  err: { color: c.error, fontFamily: FONTS.bodyMedium },
  rangeRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: RADII.pill, backgroundColor: c.surfaceAlt },
  chipActive: { backgroundColor: c.primary },
  chipText: { fontFamily: FONTS.bodySemiBold, color: c.textSecondary, textTransform: 'capitalize' },
  chipTextActive: { color: c.primaryText },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontFamily: FONTS.bodyMedium, color: c.textSecondary },
  rowValue: { fontFamily: FONTS.bodyBold, color: c.textPrimary },
  subhead: { fontFamily: FONTS.bodyBold, color: c.textPrimary, marginTop: 12, marginBottom: 4 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  userEmail: { fontFamily: FONTS.bodySemiBold, color: c.textPrimary },
  userMeta: { fontFamily: FONTS.body, color: c.textMuted, fontSize: 12 },
  betaBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADII.pill, backgroundColor: c.surfaceAlt },
  betaBtnOn: { backgroundColor: c.primary },
  betaBtnText: { fontFamily: FONTS.bodySemiBold, color: c.textSecondary, fontSize: 13 },
  betaBtnTextOn: { color: c.primaryText },
  pricingNote: { fontFamily: FONTS.body, color: c.textMuted, fontSize: 11, marginTop: 4 },
  adminLabel: { fontFamily: FONTS.bodySemiBold, color: c.textMuted, fontSize: 13 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  toolLabel: { fontFamily: FONTS.bodySemiBold, color: c.textPrimary, fontSize: 15 },
  toolSub: { fontFamily: FONTS.body, color: c.textMuted, fontSize: 12, marginTop: 1 },
  toolChevron: { fontFamily: FONTS.body, color: c.textMuted, fontSize: 22 },
  previewOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  previewHint: { fontFamily: FONTS.mono, color: c.textMuted, fontSize: 11, letterSpacing: 0.5 },
});
