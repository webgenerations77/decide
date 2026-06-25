import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

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
      const msg = e.code === 'auth/user-not-found' ? 'No account found with this email.'
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
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>🔑</Text>
            <Text style={styles.heroTitle}>Reset Password</Text>
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
              <Text style={styles.successText}>Reset email sent! Check your inbox.</Text>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#4a6a6e"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleReset}
                disabled={loading}
                activeOpacity={0.7}
              >
                {loading ? (
                  <ActivityIndicator color="#00191f" />
                ) : (
                  <Text style={styles.primaryBtnText}>Send Reset Email</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.links}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.linkText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#00191f' },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  hero: { alignItems: 'center', marginBottom: 32 },
  heroEmoji: { fontSize: 56, marginBottom: 8 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#ffffff' },
  heroSub: { fontSize: 15, color: '#9ca3af', marginTop: 4, textAlign: 'center' },
  errorBox: { backgroundColor: 'rgba(248,113,113,0.15)', borderRadius: 12, padding: 12, marginBottom: 16 },
  errorText: { color: '#f87171', fontSize: 14, textAlign: 'center' },
  successBox: { backgroundColor: 'rgba(0,210,190,0.15)', borderRadius: 12, padding: 16, marginBottom: 16 },
  successText: { color: '#00d2be', fontSize: 15, textAlign: 'center', fontWeight: '600' },
  form: { gap: 12 },
  label: { color: '#9ca3af', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  input: {
    backgroundColor: '#00262e', borderWidth: 1, borderColor: '#003040',
    borderRadius: 12, padding: 14, fontSize: 16, color: '#ffffff',
  },
  primaryBtn: {
    backgroundColor: '#00d2be', borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  primaryBtnText: { color: '#00191f', fontSize: 17, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  links: { alignItems: 'center', marginTop: 24 },
  linkText: { color: '#00d2be', fontSize: 14, fontWeight: '600' },
});
