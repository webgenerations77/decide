import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { getUsage, getUserStats, getUsers } from '../../../services/adminApi';
import ScreenBackground from '../../../components/brand/ScreenBackground';
import Card from '../../../components/brand/Card';
import SectionLabel from '../../../components/brand/SectionLabel';
import { FONTS, RADII } from '../../../constants/theme';

const money = (n) => `$${(n || 0).toFixed(2)}`;
const formatDate = (v, fallback = 'Unknown') => {
  if (!v) return fallback;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? fallback : d.toLocaleDateString();
};

export default function AdminUserDetailScreen() {
  const router = useRouter();
  const { uid, range: rangeParam } = useLocalSearchParams();
  const range = typeof rangeParam === 'string' && rangeParam ? rangeParam : 'day';

  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [user, setUser] = useState(undefined); // undefined=loading, null=not found
  const [usageRow, setUsageRow] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsErr, setStatsErr] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [users, usage] = await Promise.all([getUsers(), getUsage(range)]);
        if (!alive) return;
        const found = (users || []).find((u) => u.uid === uid) || null;
        setUser(found);
        setUsageRow(usage?.byUser?.[uid] || null);
      } catch (e) {
        if (alive) { setUser(null); setErr(e.message); }
      }
    })();
    return () => { alive = false; };
  }, [uid, range]);

  useEffect(() => {
    let alive = true;
    setStatsLoading(true);
    setStatsErr(null);
    getUserStats(uid)
      .then((s) => { if (alive) setStats(s); })
      .catch((e) => { if (alive) setStatsErr(e.message); })
      .finally(() => { if (alive) setStatsLoading(false); });
    return () => { alive = false; };
  }, [uid]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/admin'));

  if (user === undefined) {
    return (
      <ScreenBackground variant="paper">
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <Header onBack={back} styles={styles} colors={colors} />
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  if (user === null) {
    return (
      <ScreenBackground variant="paper">
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <Header onBack={back} styles={styles} colors={colors} />
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>User not found</Text>
            {err ? <Text style={styles.emptySub}>{err}</Text> : null}
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground variant="paper">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.container}>
          <Header onBack={back} styles={styles} colors={colors} />

          <Text style={styles.email}>{user.email}</Text>
          <Text style={styles.meta}>{user.role || 'user'} · {user.status}</Text>

          <SectionLabel tone="cobalt">ACCOUNT</SectionLabel>
          <Card>
            <Row label="Created" value={formatDate(user.createdAt)} styles={styles} />
            <Row label="Last login" value={formatDate(user.lastSignIn, 'Never')} styles={styles} />
          </Card>

          <SectionLabel tone="cobalt">API USAGE ({range})</SectionLabel>
          <Card>
            {usageRow ? (
              <>
                <Row label="Requests" value={String(usageRow.requests || 0)} styles={styles} />
                <Row label="Input tokens" value={(usageRow.inputTokens || 0).toLocaleString()} styles={styles} />
                <Row label="Output tokens" value={(usageRow.outputTokens || 0).toLocaleString()} styles={styles} />
                <Row label="Est. cost" value={money(usageRow.estCost)} styles={styles} />
              </>
            ) : (
              <Text style={styles.muted}>No usage in this range</Text>
            )}
          </Card>

          <SectionLabel tone="cobalt">ACTIVITY</SectionLabel>
          <Card>
            {statsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : statsErr ? (
              <Text style={styles.err}>{statsErr}</Text>
            ) : stats ? (
              <>
                <Row label="Itineraries" value={String(stats.itineraries)} styles={styles} />
                <Row label="Decisions" value={String(stats.decisions)} styles={styles} />
                <Row label="Locations" value={String(stats.locations)} styles={styles} />
                {stats.cities?.length ? <Text style={styles.muted}>{stats.cities.join(', ')}</Text> : null}
              </>
            ) : null}
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function Header({ onBack, styles, colors }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backRow} hitSlop={10}>
        <Ionicons name="chevron-back" size={18} color={colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, value, styles }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { padding: 20, gap: 12 },
  header: { marginBottom: 4 },
  backRow: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: c.primary, marginLeft: 2 },
  email: { fontFamily: FONTS.display, fontSize: 24, color: c.textPrimary },
  meta: { fontFamily: FONTS.body, color: c.textMuted, fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontFamily: FONTS.bodyMedium, color: c.textSecondary },
  rowValue: { fontFamily: FONTS.bodyBold, color: c.textPrimary },
  muted: { fontFamily: FONTS.body, color: c.textMuted, fontSize: 12, marginTop: 4 },
  err: { color: c.error, fontFamily: FONTS.bodyMedium },
  emptyWrap: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60 },
  emptyTitle: { fontFamily: FONTS.display, fontSize: 19, color: c.textPrimary, textAlign: 'center' },
  emptySub: { fontFamily: FONTS.body, fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 8 },
  emptyRadius: { borderRadius: RADII.lg },
});
