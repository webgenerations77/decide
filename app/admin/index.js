import { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getUsage, getUsers, setUserRole } from '../../services/adminApi';
import ScreenBackground from '../../components/brand/ScreenBackground';
import Card from '../../components/brand/Card';
import SectionLabel from '../../components/brand/SectionLabel';
import { FONTS, RADII } from '../../constants/theme';
import { PRICING } from '../../constants/pricing';
import { getAdminRole } from '../../utils/admin';

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
});
