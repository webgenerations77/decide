import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../constants/theme';

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || !password || !confirm) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!tosAccepted) {
      setError('Please accept the Terms of Service to continue.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signUp(email.trim(), password);
      const timestamp = new Date().toISOString();
      if (displayName.trim()) {
        await AsyncStorage.setItem('@decide/display_name', displayName.trim());
      }
      await AsyncStorage.setItem('@decide/tos_accepted', timestamp);
    } catch (e) {
      const msg = e.code === 'auth/email-already-in-use' ? 'An account with this email already exists.'
        : e.code === 'auth/invalid-email' ? 'Please enter a valid email address.'
        : e.code === 'auth/weak-password' ? 'Password is too weak. Use at least 6 characters.'
        : e.message || 'Sign up failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && tosAccepted;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>🧭</Text>
            <Text style={styles.heroTitle}>Create Account</Text>
            <Text style={styles.heroSub}>Join Decide and let Cheddar plan your day.</Text>
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.form}>
            <Text style={styles.label}>Display Name (optional)</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="What should Cheddar call you?"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              autoComplete="new-password"
            />

            <Text style={styles.label}>Confirm Password *</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Re-enter your password"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              autoComplete="new-password"
            />

            {/* Terms of Service checkbox */}
            <TouchableOpacity
              style={styles.tosRow}
              onPress={() => setTosAccepted(!tosAccepted)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, tosAccepted && styles.checkboxActive]}>
                {tosAccepted && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.tosText}>
                I have read and agree to the{' '}
                <Text
                  style={styles.tosLink}
                  onPress={(e) => { e.stopPropagation?.(); router.push('/terms'); }}
                >
                  Terms of Service
                </Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, !canSubmit && styles.btnDisabled]}
              onPress={handleSignUp}
              disabled={!canSubmit}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.bg} />
              ) : (
                <Text style={styles.primaryBtnText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.links}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.linkText}>Already have an account? Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 40 },
  hero: { alignItems: 'center', marginBottom: 32 },
  heroEmoji: { fontSize: 56, marginBottom: 8 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  heroSub: { fontSize: 15, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  errorBox: { backgroundColor: 'rgba(248,113,113,0.15)', borderRadius: 12, padding: 12, marginBottom: 16 },
  errorText: { color: COLORS.error, fontSize: 14, textAlign: 'center' },
  form: { gap: 12 },
  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, padding: 14, fontSize: 16, color: COLORS.textPrimary,
  },
  // ToS row
  tosRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginTop: 4, paddingVertical: 4,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  checkboxActive: { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  checkmark: { fontSize: 13, color: COLORS.bg, fontWeight: '800' },
  tosText: { flex: 1, fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  tosLink: { color: COLORS.teal, fontWeight: '600', textDecorationLine: 'underline' },
  // Buttons
  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  primaryBtnText: { color: COLORS.primaryText, fontSize: 17, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  links: { alignItems: 'center', marginTop: 24 },
  linkText: { color: COLORS.teal, fontSize: 14, fontWeight: '600' },
});
