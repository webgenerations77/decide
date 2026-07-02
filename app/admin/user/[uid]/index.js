import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../../context/ThemeContext';
import { getUsage, getUserHistory, getUsers } from '../../../../services/adminApi';
import ScreenBackground from '../../../../components/brand/ScreenBackground';
import Card from '../../../../components/brand/Card';
import SectionLabel from '../../../../components/brand/SectionLabel';
import DecisionCard from '../../../../components/history/DecisionCard';
import { FONTS, RADII } from '../../../../constants/theme';

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
  const [history, setHistory] = useState(null);   // { itineraries, decisions } | null
  const [historyErr, setHistoryErr] = useState(null);
  const [err, setErr] = useState(null);

  const itineraries = history?.itineraries || [];
  const decisions = history?.decisions || [];
  const cityMap = new Map();
  for (const it of itineraries) {
    const city = typeof it?.meta?.city === 'string' ? it.meta.city.trim() : '';
    if (city && !cityMap.has(city.toLowerCase())) cityMap.set(city.toLowerCase(), city);
  }
  const cities = Array.from(cityMap.values()).slice(0, 10);

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
    getUserHistory(uid)
      .then((h) => { if (alive) setHistory(h); })
      .catch((e) => { if (alive) setHistoryErr(e.message); });
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
            {!history && !historyErr ? (
              <ActivityIndicator color={colors.primary} />
            ) : historyErr ? (
              <Text style={styles.err}>{historyErr}</Text>
            ) : (
              <>
                <Row label="Itineraries" value={String(itineraries.length)} styles={styles} />
                <Row label="Decisions" value={String(decisions.length)} styles={styles} />
                <Row label="Locations" value={String(cityMap.size)} styles={styles} />
                {cities.length ? <Text style={styles.muted}>{cities.join(', ')}</Text> : null}
              </>
            )}
          </Card>

          <SectionLabel tone="cobalt">ITINERARIES</SectionLabel>
          <Card>
            {!history && !historyErr ? (
              <ActivityIndicator color={colors.primary} />
            ) : itineraries.length === 0 ? (
              <Text style={styles.muted}>No itineraries yet</Text>
            ) : (
              itineraries.map((it) => (
                <Pressable
                  key={it.id}
                  style={styles.recordRow}
                  onPress={() => router.push(`/admin/user/${encodeURIComponent(uid)}/itinerary/${encodeURIComponent(it.id)}`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordTitle}>
                      {`${it.meta?.day_of_week ?? ''} ${it.meta?.date ?? ''}`.trim() || 'Itinerary'}
                    </Text>
                    <Text style={styles.recordSub}>
                      {[it.meta?.city, `${it.itinerary?.length ?? it.stops?.length ?? 0} stops`].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text style={styles.recordChevron}>›</Text>
                </Pressable>
              ))
            )}
          </Card>

          <SectionLabel tone="cobalt">DECISIONS</SectionLabel>
          {!history && !historyErr ? (
            <Card><ActivityIndicator color={colors.primary} /></Card>
          ) : decisions.length === 0 ? (
            <Card><Text style={styles.muted}>No decisions yet</Text></Card>
          ) : (
            decisions.map((d) => <DecisionCard key={d.id} item={d} readOnly />)
          )}
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
  recordRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  recordTitle: { fontFamily: FONTS.bodySemiBold, color: c.textPrimary },
  recordSub: { fontFamily: FONTS.body, color: c.textMuted, fontSize: 12, marginTop: 1 },
  recordChevron: { fontFamily: FONTS.body, color: c.textMuted, fontSize: 22 },
});
