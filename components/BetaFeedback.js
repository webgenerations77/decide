import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ScrollView, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { submitFeedback } from '../services/feedbackService';
import CTAButton from './brand/CTAButton';
import { useTheme } from '../context/ThemeContext';
import { FONTS, RADII } from '../constants/theme';
import useViewportOverlay, { WEB_OVERLAY_FIX } from '../hooks/useViewportOverlay';

const TYPES = ['Bug Report', 'Feature Suggestion', 'General Impression', 'Something Felt Off'];

function firstName(user) {
  const n = user?.displayName?.trim().split(/\s+/)[0];
  return n || 'friend';
}

// `topOffset` pushes the FAB below any visible top banners (demo/beta) so it
// anchors to the top-right corner without covering the bottom Settings tab.
export default function BetaFeedback({ topOffset = 0 }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, scheme), [colors, scheme]);

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(pathname);
  const [type, setType] = useState(TYPES[0]);
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null); // { kind: 'success' | 'error', text }
  const overlayRef = useViewportOverlay(open);

  const openModal = () => { setPage(pathname); setOpen(true); };

  const onSubmit = async () => {
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    const res = await submitFeedback({
      page,
      feedbackType: type,
      message: message.trim(),
      rating,
      userEmail: user?.email || '',
      userName: firstName(user),
    });
    setSubmitting(false);
    if (res.success) {
      setOpen(false);
      setMessage(''); setRating(0); setType(TYPES[0]);
      setToast({ kind: 'success', text: `Feedback sent! Thanks ${firstName(user)} 🙌` });
    } else {
      setToast({ kind: 'error', text: "Hmm, that didn't go through. Try again?" });
    }
    setTimeout(() => setToast(null), 3500);
  };

  const toastNode = toast ? (
    <View
      style={[styles.toast, { bottom: 92 + insets.bottom }, toast.kind === 'error' && styles.toastError]}
      pointerEvents="none"
    >
      <Text style={styles.toastText}>{toast.text}</Text>
    </View>
  ) : null;

  return (
    <>
      <TouchableOpacity
        style={[styles.fab, { top: insets.top + topOffset + 8 }]}
        onPress={openModal}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>💬 Give Feedback</Text>
      </TouchableOpacity>

      {toastNode}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View ref={overlayRef} style={styles.overlay}>
          <View style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12 }}>
              <View style={styles.headerRow}>
                <Text style={styles.title}>Give Feedback</Text>
                <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.close}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>PAGE / FEATURE</Text>
              <TextInput
                style={styles.input} value={page} onChangeText={setPage}
                placeholder="Which screen?" placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>FEEDBACK TYPE</Text>
              <View style={styles.pillRow}>
                {TYPES.map((t) => (
                  <TouchableOpacity
                    key={t} onPress={() => setType(t)}
                    style={[styles.pill, type === t && styles.pillActive]} activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, type === t && styles.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>YOUR FEEDBACK</Text>
              <TextInput
                style={[styles.input, styles.textarea]} value={message} onChangeText={setMessage}
                placeholder="Tell us what you're thinking..." placeholderTextColor={colors.textMuted}
                multiline numberOfLines={4} textAlignVertical="top"
              />

              <Text style={styles.label}>RATING (OPTIONAL)</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity
                    key={n} onPress={() => setRating(n === rating ? 0 : n)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={styles.star}>{n <= rating ? '★' : '☆'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <CTAButton
                title="Send to Cheddar HQ" variant="cobalt" onPress={onSubmit}
                loading={submitting} disabled={!message.trim() || submitting} style={{ marginTop: 6 }}
              />
            </ScrollView>
          </View>
          {toastNode}
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (c, scheme) => StyleSheet.create({
  fab: {
    position: 'absolute', right: 24, zIndex: 9997, elevation: 18,
    backgroundColor: c.primary, borderRadius: RADII.pill,
    paddingHorizontal: 18, paddingVertical: 12,
    ...({ shadowColor: c.navy, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }),
  },
  fabText: { color: c.white, fontFamily: FONTS.bodyBold, fontSize: 14 },

  toast: {
    position: 'absolute', left: 20, right: 20, zIndex: 9999, elevation: 22,
    backgroundColor: c.navy, borderRadius: RADII.md, paddingVertical: 12, paddingHorizontal: 16,
    alignItems: 'center',
  },
  toastError: { backgroundColor: c.error },
  toastText: { color: c.white, fontFamily: FONTS.bodySemiBold, fontSize: 13, textAlign: 'center' },

  overlay: { ...WEB_OVERLAY_FIX, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.bg, borderTopLeftRadius: RADII.lg, borderTopRightRadius: RADII.lg,
    maxHeight: '88%',
    // Hairline separates the sheet from the dimmed backdrop in dark mode (parity with Card).
    ...(scheme === 'dark' && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border }),
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 20, fontFamily: FONTS.displayHeavy, color: c.textPrimary },
  close: { fontSize: 18, fontFamily: FONTS.bodyBold, color: c.textMuted },

  label: { fontSize: 10, fontFamily: FONTS.monoBold, color: c.goldText, letterSpacing: 1.5, textTransform: 'uppercase' },
  input: {
    backgroundColor: c.surface, borderRadius: RADII.md,
    borderWidth: 1, borderColor: c.border,
    paddingHorizontal: 14, height: 48, fontSize: 15, color: c.textPrimary, fontFamily: FONTS.body,
  },
  textarea: { height: 110, paddingTop: 12 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADII.pill,
    backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
  },
  pillActive: { backgroundColor: c.primary, borderColor: c.primary },
  pillText: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: c.textSecondary },
  pillTextActive: { color: c.primaryText },

  starRow: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 28, color: c.gold },
});
