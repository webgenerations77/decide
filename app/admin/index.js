import { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  getUsage, getUsers, setUserRole,
  getInvites, inviteUser, resendInvite, deleteInvite, removeUser, enableUser,
} from '../../services/adminApi';
import ScreenBackground from '../../components/brand/ScreenBackground';
import Card from '../../components/brand/Card';
import TextField from '../../components/brand/TextField';
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
// Milliseconds are the wrong unit for a number a human is about to copy into a countdown.
const secs = (ms) => (Number.isFinite(ms) ? `${(ms / 1000).toFixed(1)}s` : '—');

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
  const [invites, setInvites] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState(null);

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
    getInvites().then(setInvites).catch(() => setInvites([]));
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

  const refreshInvites = () => getInvites().then(setInvites).catch(() => {});

  async function submitInvite() {
    const email = inviteEmail.trim();
    if (!email || inviting) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const r = await inviteUser(email);
      setInviteEmail('');
      // The invite row is saved even when the send fails — say which happened rather
      // than implying the tester got an email they never received.
      setInviteMsg(
        r.emailed
          ? { text: `Invited ${r.email}${r.existingUser ? ' — they already had an account, beta granted now.' : ' — email sent.'}` }
          : { text: `Saved ${r.email}, but the email did NOT send: ${r.emailError || 'unknown error'}`, bad: true },
      );
      refreshInvites();
      getUsers().then(setUsers).catch(() => {});
    } catch (e) {
      setInviteMsg({ text: e.message, bad: true });
    } finally {
      setInviting(false);
    }
  }

  async function doResend(email) {
    setInviteMsg(null);
    try {
      await resendInvite(email);
      setInviteMsg({ text: `Invite resent to ${email}.` });
    } catch (e) {
      setInviteMsg({ text: `Resend failed: ${e.message}`, bad: true });
    }
  }

  async function doDeleteInvite(email) {
    try { await deleteInvite(email); refreshInvites(); } catch (e) { setErr(e.message); }
  }

  function confirmRemove(u) {
    Alert.alert(
      'Remove access?',
      `${u.email} will lose beta access and won't be able to sign in. Their account and history stay intact — you can restore them later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeUser({ uid: u.uid, email: u.email });
              setUsers((list) => list.map((x) => (x.uid === u.uid ? { ...x, role: null, status: 'disabled' } : x)));
              refreshInvites();
            } catch (e) { setErr(e.message); }
          },
        },
      ],
    );
  }

  async function doRestore(u) {
    try {
      await enableUser(u.uid);
      setUsers((list) => list.map((x) => (x.uid === u.uid ? { ...x, status: 'active' } : x)));
    } catch (e) { setErr(e.message); }
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
              {/* Copy tracks what the screen actually shows. The info cards are now the ad
                  slot's FALLBACK rather than a permanent fixture, so promising them here would
                  send an admin looking for something that usually is not there. */}
              <Text style={styles.toolSub}>Preview the ad slot, countdown and globe</Text>
            </View>
            <Text style={styles.toolChevron}>›</Text>
          </Pressable>
          <Pressable style={styles.toolRow} onPress={() => router.push('/beta-guide')}>
            <Ionicons name="book-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.toolLabel}>Beta tester guide</Text>
              <Text style={styles.toolSub}>Open the welcome doc new testers see</Text>
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

              {/* How long people actually waited. THIS is what the loading screen's countdown
                  should be set from — read p80, not p50: a clock that expires early on one run
                  in two is worse than one that finishes early. Put the value in
                  ESTIMATED_SECONDS in components/LoadingAnimation.js. */}
              {/* The funnel. `Died` is the alarm — requests that started and never came back,
                  which is what a Vercel kill looks like from the inside. `Hit deadline` is NOT
                  a failure: those are days that would previously have died and now arrive as a
                  simpler plan instead. */}
              <Text style={styles.subhead}>Generation funnel</Text>
              {usage.funnel ? (
                <>
                  <Row label="Started" value={String(usage.funnel.started)} />
                  <Row label="Completed" value={String(usage.funnel.completed)} />
                  <Row
                    label={usage.funnel.died > 0 ? 'Died · investigate' : 'Died'}
                    value={String(usage.funnel.died)}
                  />
                  <Row label="Hit synthesis deadline" value={String(usage.funnel.deadline)} />
                  {usage.funnel.skipped > 0 ? (
                    <Row label="Skipped — no budget left" value={String(usage.funnel.skipped)} />
                  ) : null}
                </>
              ) : (
                <Text style={styles.pricingNote}>
                  No generations recorded in this range.
                </Text>
              )}

              <Text style={styles.subhead}>Itinerary generation</Text>
              {usage.generation ? (
                <>
                  <Row label="p50" value={secs(usage.generation.p50)} />
                  <Row label="p80 · use this" value={secs(usage.generation.p80)} />
                  <Row label="p95" value={secs(usage.generation.p95)} />
                  <Row label="Slowest" value={secs(usage.generation.max)} />
                  <Row label="Timed runs" value={String(usage.generation.n)} />
                </>
              ) : (
                <Text style={styles.pricingNote}>
                  Nothing timed in this range yet — the countdown is still running on an estimate.
                </Text>
              )}
            </View>
          )}
        </Card>

        <SectionLabel tone="cobalt">INVITE A BETA TESTER</SectionLabel>
        <Card>
          <Text style={styles.inviteHelp}>
            Pre-authorises an email before they've ever signed in. They get an invite and the
            beta role attaches automatically the first time they Continue with Google — it must
            be this exact address.
          </Text>
          <View style={styles.inviteRow}>
            <TextField
              style={{ flex: 1 }}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="tester@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={submitInvite}
              returnKeyType="send"
            />
            <Pressable
              onPress={submitInvite}
              disabled={inviting || !inviteEmail.trim()}
              style={[styles.inviteBtn, (inviting || !inviteEmail.trim()) && styles.inviteBtnOff]}
            >
              <Text style={styles.inviteBtnText}>{inviting ? '…' : 'Invite'}</Text>
            </Pressable>
          </View>
          {inviteMsg ? <Text style={[styles.inviteMsg, inviteMsg.bad && styles.inviteMsgBad]}>{inviteMsg.text}</Text> : null}

          {(invites || []).length > 0 && (
            <>
              <Text style={styles.pendingLabel}>PENDING ({invites.length})</Text>
              {invites.map((iv) => (
                <View key={iv.email} style={styles.pendingRow}>
                  <Text style={styles.pendingEmail} numberOfLines={1}>{iv.email}</Text>
                  <Pressable onPress={() => doResend(iv.email)} style={styles.pendingAction}>
                    <Text style={styles.pendingActionText}>Resend</Text>
                  </Pressable>
                  <Pressable onPress={() => doDeleteInvite(iv.email)} style={styles.pendingAction}>
                    <Text style={[styles.pendingActionText, styles.dangerText]}>Cancel</Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}
        </Card>

        <SectionLabel tone="cobalt">USER ADMINISTRATION</SectionLabel>
        <Card>
          {!users ? <ActivityIndicator color={colors.primary} /> : users.map((u) => {
            const rowIsAdmin = getAdminRole({ email: u.email }) === 'admin';
            const disabled = u.status === 'disabled';
            return (
              <Pressable
                key={u.uid}
                style={styles.userRow}
                onPress={() => router.push(`/admin/user/${encodeURIComponent(u.uid)}?range=${range}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.userEmail, disabled && styles.userEmailOff]}>{u.email}</Text>
                  <Text style={styles.userMeta}>{u.role || 'user'} · {u.status}</Text>
                  <Text style={styles.tapDetailHint}>View details →</Text>
                </View>
                {rowIsAdmin ? (
                  <Text style={styles.adminLabel}>Admin</Text>
                ) : disabled ? (
                  <Pressable onPress={() => doRestore(u)} style={[styles.betaBtn, styles.restoreBtn]}>
                    <Text style={styles.betaBtnText}>Restore</Text>
                  </Pressable>
                ) : (
                  <View style={styles.rowActions}>
                    <Pressable onPress={() => toggleBeta(u)} style={[styles.betaBtn, u.role === 'beta_tester' && styles.betaBtnOn]}>
                      <Text style={[styles.betaBtnText, u.role === 'beta_tester' && styles.betaBtnTextOn]}>
                        {u.role === 'beta_tester' ? 'Beta ✓' : 'Grant beta'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => confirmRemove(u)} style={styles.removeBtn} hitSlop={6}>
                      <Ionicons name="person-remove-outline" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                )}
              </Pressable>
            );
          })}
        </Card>
        </ScrollView>

        {/* ⚠ NOT an RN Modal. This used to be one and rendered as an empty background on
            mobile web — RN's Modal does not pin its content to the VISUAL viewport there,
            which is the same defect hooks/useViewportOverlay.js exists to work around. It
            reproduced on a phone and not on a desktop browser, which is exactly the shape of
            that bug.

            This is instead the absolutely-positioned overlay that plan.js already uses for the
            real loading state — the one code path in the app where this component is known to
            render correctly in production. Preview and reality now go through the same
            mechanism, so the preview cannot silently disagree with what travellers see. */}
        {loadingPreview && (
          <Pressable style={styles.previewOverlay} onPress={() => setLoadingPreview(false)}>
            <LoadingAnimation coords={previewCoords} />
            <Text style={styles.previewHint}>Preview · tap anywhere to close</Text>
          </Pressable>
        )}
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
  tapDetailHint: { fontFamily: FONTS.bodySemiBold, color: c.primary, fontSize: 12, marginTop: 4 },
  betaBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADII.pill, backgroundColor: c.surfaceAlt },
  betaBtnOn: { backgroundColor: c.primary },
  betaBtnText: { fontFamily: FONTS.bodySemiBold, color: c.textSecondary, fontSize: 13 },
  betaBtnTextOn: { color: c.primaryText },
  pricingNote: { fontFamily: FONTS.body, color: c.textMuted, fontSize: 11, marginTop: 4 },
  adminLabel: { fontFamily: FONTS.bodySemiBold, color: c.textMuted, fontSize: 13 },

  // Invite / remove
  userEmailOff: { textDecorationLine: 'line-through', color: c.textMuted },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeBtn: { padding: 6, borderRadius: RADII.sm },
  restoreBtn: { backgroundColor: c.sky100 },
  inviteHelp: { fontFamily: FONTS.body, color: c.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 10 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inviteBtn: {
    paddingVertical: 11, paddingHorizontal: 16, borderRadius: RADII.md,
    backgroundColor: c.primary, minWidth: 72, alignItems: 'center',
  },
  inviteBtnOff: { opacity: 0.5 },
  inviteBtnText: { fontFamily: FONTS.bodySemiBold, color: c.primaryText, fontSize: 14 },
  inviteMsg: { fontFamily: FONTS.body, fontSize: 12, lineHeight: 17, color: c.success, marginTop: 8 },
  inviteMsgBad: { color: c.error },
  pendingLabel: { fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 1.2, color: c.textMuted, marginTop: 14 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  pendingEmail: { flex: 1, fontFamily: FONTS.body, fontSize: 13, color: c.textSecondary },
  pendingAction: { paddingVertical: 2, paddingHorizontal: 4 },
  pendingActionText: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: c.primary },
  dangerText: { color: c.error },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  toolLabel: { fontFamily: FONTS.bodySemiBold, color: c.textPrimary, fontSize: 15 },
  toolSub: { fontFamily: FONTS.body, color: c.textMuted, fontSize: 12, marginTop: 1 },
  toolChevron: { fontFamily: FONTS.body, color: c.textMuted, fontSize: 22 },
  // Mirrors plan.js's loadingOverlay exactly. Absolute inset-0 gives LoadingAnimation a parent
  // with real height, which `flex: 1` needs and which an RN Modal on mobile web did not supply.
  previewOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: c.bg,
    alignItems: 'center', justifyContent: 'center', gap: 16,
    zIndex: 50, elevation: 50,
  },
  previewHint: { fontFamily: FONTS.mono, color: c.textMuted, fontSize: 11, letterSpacing: 0.5 },
});
