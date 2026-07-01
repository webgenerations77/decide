import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import BrandLogo from '../../components/brand/BrandLogo';
import ScreenBackground from '../../components/brand/ScreenBackground';
import CTAButton from '../../components/brand/CTAButton';
import Card from '../../components/brand/Card';

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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
    <ScreenBackground variant="paper">
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.hero}>
              <BrandLogo variant="stacked" size={80} />
              <Text style={styles.heroTitle}>Create account</Text>
              <Text style={styles.heroSub}>Let Decide plan your next great day.</Text>
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Card>
              <View style={styles.form}>
                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>What should we call you? <Text style={styles.optional}>(optional)</Text></Text>
                  <TextInput
                    style={styles.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Your name"
                    placeholderTextColor={colors.textMuted}
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
                    placeholderTextColor={colors.textMuted}
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
                    placeholderTextColor={colors.textMuted}
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
                    placeholderTextColor={colors.textMuted}
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

                <CTAButton
                  variant="cobalt"
                  title="Create account →"
                  onPress={handleSignUp}
                  disabled={!canSubmit}
                  loading={loading}
                />
              </View>
            </Card>

            <View style={styles.footer}>
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                <Text style={styles.linkText}>Already have an account? Sign in</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const makeStyles = (c) => StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 48, paddingTop: 24 },

  hero: { alignItems: 'center', marginBottom: 32 },
  heroTitle: {
    fontSize: 26, color: c.textPrimary,
    fontFamily: FONTS.displayHeavy,
    marginBottom: 6, marginTop: 16,
  },
  heroSub: { fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 22 },

  errorBox: {
    backgroundColor: c.error + '18', borderRadius: 12,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: c.error + '44',
  },
  errorText: { color: c.error, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  form: { gap: 16 },
  fieldBlock: { gap: 6 },
  label: { color: c.textSecondary, fontSize: 13, fontFamily: FONTS.bodySemiBold },
  optional: { color: c.textMuted, fontFamily: FONTS.body },
  required: { color: c.primary },
  input: {
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    borderRadius: 14, paddingHorizontal: 16, height: 52,
    fontSize: 16, color: c.textPrimary,
  },

  tosRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginTop: 4, paddingVertical: 4,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  checkboxActive: { backgroundColor: c.amber, borderColor: c.amber },
  checkmark: { fontSize: 13, color: c.bg, fontFamily: FONTS.displayHeavy },
  tosText: { flex: 1, fontSize: 14, color: c.textSecondary, lineHeight: 20 },
  tosLink: { color: c.primary, fontFamily: FONTS.bodySemiBold, textDecorationLine: 'underline' },

  footer: { alignItems: 'center', marginTop: 28 },
  linkText: { color: c.primary, fontSize: 14, fontFamily: FONTS.bodySemiBold },
});
