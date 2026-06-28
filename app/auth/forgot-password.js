import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) { setError('Please enter your email.'); return; }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (e) {
      const msg = e.code === 'auth/user-not-found' ? 'No account found with that email.'
        : e.code === 'auth/invalid-email' ? 'Please enter a valid email address.'
        : e.message || 'Failed to send reset email.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.content}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
            <Text style={styles.backTxt}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Reset password</Text>
            <Text style={styles.heroSub}>
              {sent
                ? 'Check your email for a reset link.'
                : "Enter your email and we'll send a reset link."}
            </Text>
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {sent ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>Reset email sent — check your inbox.</Text>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="done"
                onSubmitEditing={handleReset}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleReset}
                disabled={loading}
                activeOpacity={0.7}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.primaryText} />
                ) : (
                  <Text style={styles.primaryBtnText}>Send reset link</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  backBtn: { marginBottom: 24 },
  backTxt: { color: COLORS.amber, fontSize: 14, fontWeight: '600' },
  hero: { alignItems: 'center', marginBottom: 32 },
  heroTitle: {
    fontSize: 26, color: COLORS.textPrimary,
    fontFamily: 'PlayfairDisplay_800ExtraBold',
    marginBottom: 8,
  },
  heroSub: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  errorBox: {
    backgroundColor: COLORS.error + '18', borderRadius: 12,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.error + '44',
  },
  errorText: { color: COLORS.error, fontSize: 14, textAlign: 'center' },
  successBox: {
    backgroundColor: COLORS.success + '18', borderRadius: 12,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.success + '44',
  },
  successText: { color: COLORS.success, fontSize: 15, textAlign: 'center', fontWeight: '600' },
  form: { gap: 12 },
  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, paddingHorizontal: 16, height: 52,
    fontSize: 16, color: COLORS.textPrimary,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: 16, height: 56,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  primaryBtnText: { color: COLORS.primaryText, fontSize: 17, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
});
