import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
    setError('');
    setLoading(true);
    try {
      await signUp(email.trim(), password);
      if (displayName.trim()) {
        await AsyncStorage.setItem('@decide/display_name', displayName.trim());
      }
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>🎯</Text>
            <Text style={styles.heroTitle}>Create Account</Text>
            <Text style={styles.heroSub}>Join Decide and start exploring.</Text>
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
              placeholder="What should we call you?"
              placeholderTextColor="#4a6a6e"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Email *</Text>
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

            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor="#4a6a6e"
              secureTextEntry
              autoComplete="new-password"
            />

            <Text style={styles.label}>Confirm Password *</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Re-enter your password"
              placeholderTextColor="#4a6a6e"
              secureTextEntry
              autoComplete="new-password"
            />

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color="#00191f" />
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
  container: { flex: 1, backgroundColor: '#00191f' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 40 },
  hero: { alignItems: 'center', marginBottom: 32 },
  heroEmoji: { fontSize: 56, marginBottom: 8 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#ffffff' },
  heroSub: { fontSize: 15, color: '#9ca3af', marginTop: 4 },
  errorBox: { backgroundColor: 'rgba(248,113,113,0.15)', borderRadius: 12, padding: 12, marginBottom: 16 },
  errorText: { color: '#f87171', fontSize: 14, textAlign: 'center' },
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
