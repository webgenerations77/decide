import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getUsage, getUsers, setUserRole } from '../../services/adminApi';
import ScreenBackground from '../../components/brand/ScreenBackground';
import Card from '../../components/brand/Card';
import SectionLabel from '../../components/brand/SectionLabel';
import { COLORS, FONTS, RADII } from '../../constants/theme';

const RANGES = ['day', 'week', 'month'];
const money = (n) => `$${(n || 0).toFixed(2)}`;

export default function AdminScreen() {
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
    return <ScreenBackground variant="paper"><View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View></ScreenBackground>;
  }

  async function toggleBeta(u) {
    const next = u.role === 'beta_tester' ? null : 'beta_tester';
    setUsers((list) => list.map((x) => (x.uid === u.uid ? { ...x, role: next } : x)));
    try { await setUserRole(u.uid, next); } catch (e) { setErr(e.message); }
  }

  return (
    <ScreenBackground variant="paper">
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Admin</Text>
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
          {!usage ? <ActivityIndicator color={COLORS.primary} /> : (
            <View>
              <Row label="Requests" value={String(usage.totals.requests)} />
              <Row label="Input tokens" value={usage.totals.inputTokens.toLocaleString()} />
              <Row label="Output tokens" value={usage.totals.outputTokens.toLocaleString()} />
              <Row label="Est. cost" value={money(usage.totals.estCost)} />
              <Text style={styles.subhead}>By model</Text>
              {Object.entries(usage.byModel).map(([m, b]) => <Row key={m} label={m} value={money(b.estCost)} />)}
              <Text style={styles.subhead}>By route</Text>
              {Object.entries(usage.byRoute).map(([r, b]) => <Row key={r} label={r} value={`${b.requests || (b.inputTokens + b.outputTokens > 0 ? '—' : 0)}`} />)}
            </View>
          )}
        </Card>

        <SectionLabel tone="cobalt">USER ADMINISTRATION</SectionLabel>
        <Card>
          {!users ? <ActivityIndicator color={COLORS.primary} /> : users.map((u) => (
            <View key={u.uid} style={styles.userRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userEmail}>{u.email}</Text>
                <Text style={styles.userMeta}>{u.role || 'user'} · {u.status}</Text>
              </View>
              <Pressable onPress={() => toggleBeta(u)} style={[styles.betaBtn, u.role === 'beta_tester' && styles.betaBtnOn]}>
                <Text style={[styles.betaBtnText, u.role === 'beta_tester' && styles.betaBtnTextOn]}>
                  {u.role === 'beta_tester' ? 'Beta ✓' : 'Grant beta'}
                </Text>
              </Pressable>
            </View>
          ))}
        </Card>
      </ScrollView>
    </ScreenBackground>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.display, fontSize: 28, color: COLORS.textPrimary, marginBottom: 4 },
  err: { color: COLORS.error, fontFamily: FONTS.bodyMedium },
  rangeRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: RADII.pill, backgroundColor: COLORS.surfaceAlt },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontFamily: FONTS.bodySemiBold, color: COLORS.textSecondary, textTransform: 'capitalize' },
  chipTextActive: { color: COLORS.primaryText },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontFamily: FONTS.bodyMedium, color: COLORS.textSecondary },
  rowValue: { fontFamily: FONTS.bodyBold, color: COLORS.textPrimary },
  subhead: { fontFamily: FONTS.bodyBold, color: COLORS.textPrimary, marginTop: 12, marginBottom: 4 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  userEmail: { fontFamily: FONTS.bodySemiBold, color: COLORS.textPrimary },
  userMeta: { fontFamily: FONTS.body, color: COLORS.textMuted, fontSize: 12 },
  betaBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADII.pill, backgroundColor: COLORS.surfaceAlt },
  betaBtnOn: { backgroundColor: COLORS.primary },
  betaBtnText: { fontFamily: FONTS.bodySemiBold, color: COLORS.textSecondary, fontSize: 13 },
  betaBtnTextOn: { color: COLORS.primaryText },
});
