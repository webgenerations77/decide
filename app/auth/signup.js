import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS } from '../../constants/theme';

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
      setError('Password needs at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match — give it another look.");
      return;
    }
    if (!tosAccepted) {
      setError('Accept the Terms of Service to continue.');
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
      const msg = e.code === 'auth/email-already-in-use' ? 'An account with that email already exists.'
        : e.code === 'auth/invalid-email' ? "That doesn't look like a valid email."
        : e.code === 'auth/weak-password' ? 'Try a stronger password — at least 6 characters.'
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
            <Image
              source={require('../../assets/logo-small.png')}
              style={styles.heroLogo}
              resizeMode="contain"
            />
            <Text style={styles.heroTitle}>Create account</Text>
            <Text style={styles.heroSub}>Let Cheddar plan your next great day.</Text>
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>What should Cheddar call you? <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Email <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Password <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Confirm password <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Re-enter your password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleSignUp}
              />
            </View>

            <TouchableOpacity
              style={styles.tosRow}
              onPress={() => setTosAccepted(!tosAccepted)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, tosAccepted && styles.checkboxActive]}>
                {tosAccepted && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.tosText}>
                I've read and agree to the{' '}
                <Text
                  style={styles.tosLink}
                  onPress={(e) => { e.stopPropagation?.(); router.push('/terms'); }}
                >
                  Terms of Service
                </Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSignUp}
              disabled={!canSubmit}
              activeOpacity={0.88}
              style={!canSubmit && styles.btnDisabled}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtn}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.primaryText} />
                ) : (
                  <Text style={styles.primaryBtnText}>Create account →</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.linkText}>Already have an account? Sign in</Text>
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
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 48, paddingTop: 24 },

  hero: { alignItems: 'center', marginBottom: 32 },
  heroLogo: { width: 110, height: 110, marginBottom: 16 },
  heroTitle: {
    fontSize: 26, fontWeight: '800', color: COLORS.textPrimary,
    fontFamily: 'PlayfairDisplay_800ExtraBold',
    marginBottom: 6,
  },
  heroSub: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },

  errorBox: {
    backgroundColor: COLORS.error + '18', borderRadius: 12,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.error + '44',
  },
  errorText: { color: COLORS.error, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  form: { gap: 16 },
  fieldBlock: { gap: 6 },
  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  optional: { color: COLORS.textMuted, fontWeight: '400' },
  required: { color: COLORS.primary },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, paddingHorizontal: 16, height: 52,
    fontSize: 16, color: COLORS.textPrimary,
  },

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
  checkboxActive: { backgroundColor: COLORS.amber, borderColor: COLORS.amber },
  checkmark: { fontSize: 13, color: COLORS.bg, fontWeight: '800' },
  tosText: { flex: 1, fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  tosLink: { color: COLORS.amber, fontWeight: '600', textDecorationLine: 'underline' },

  primaryBtn: {
    borderRadius: 18, height: 58,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  primaryBtnText: { color: COLORS.primaryText, fontSize: 17, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },

  footer: { alignItems: 'center', marginTop: 28 },
  linkText: { color: COLORS.amber, fontSize: 14, fontWeight: '600' },
});
