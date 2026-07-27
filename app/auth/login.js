import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { signInWithGoogleCredential } from '../../services/authService';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import BrandLogo from '../../components/brand/BrandLogo';
import ScreenBackground from '../../components/brand/ScreenBackground';
import CTAButton from '../../components/brand/CTAButton';
import TextField from '../../components/brand/TextField';
import Card from '../../components/brand/Card';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

// Email/password sign-in is hidden for now — Google is the only supported entry point.
// Flip to `true` to show it to everyone again.
const EMAIL_AUTH_ENABLED = false;

// Escape hatch: tapping the period in "Decide." reveals the email form even when the
// above is false, so QA/test accounts (TEST_ACCOUNT_* in .env) can still sign in.
// Deliberately undiscoverable rather than secure — it only reveals a form, and Firebase
// still enforces credentials.
const DOT_TAPS_TO_UNLOCK = 3;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
  });

  const [dotTaps,     setDotTaps]     = useState(0);
  const [emailUnlock, setEmailUnlock] = useState(false);
  const showEmailAuth = EMAIL_AUTH_ENABLED || emailUnlock;

  const tapDot = () => {
    if (showEmailAuth) return;
    setDotTaps((n) => {
      const next = n + 1;
      if (next >= DOT_TAPS_TO_UNLOCK) { setEmailUnlock(true); return 0; }
      return next;
    });
  };

  const heroAnim  = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleEmailSignIn = async () => {
    if (!email.trim() || !password) { setError('Please fill in all fields.'); return; }
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      const msg = e.code === 'auth/invalid-credential' ? 'Wrong email or password — give it another try.'
        : e.code === 'auth/user-not-found' ? 'No account found with that email.'
        : e.code === 'auth/too-many-requests' ? 'Too many attempts. Take a breath and try again.'
        : e.message || 'Sign in failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!GOOGLE_WEB_CLIENT_ID) { setError('Google Sign-In not configured yet.'); return; }
    setError('');
    setLoading(true);
    try {
      const result = await promptAsync();
      if (result?.type === 'success') {
        await signInWithGoogleCredential(result.params.id_token);
      } else {
        // Surface WHY the Google step didn't complete (dismiss / cancel / error / locked)
        // so a stuck tester can report it instead of a silent bounce back to login.
        setError(`Google sign-in didn't complete (${result?.type ?? 'no response'}). Please try again.`);
      }
    } catch (e) {
      // Show the Firebase error code so we can tell apart an invite-list rejection, a
      // provider conflict (account-exists-with-different-credential), a disabled account, etc.
      const code = e.code ? ` [${e.code}]` : '';
      setError(`${e.message || 'Google sign-in failed.'}${code}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground variant="paper">
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Animated.View style={[styles.hero, { opacity: heroAnim, transform: [{ translateY: heroSlide }] }]}>
              <BrandLogo variant="stacked" size={80} onDotPress={tapDot} />
              <Text style={styles.heroTag}>Your day, decided.</Text>
            </Animated.View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Card>
              <View style={styles.form}>
                {showEmailAuth && (
                  <>
                    <View style={styles.fieldBlock}>
                      <Text style={styles.label}>Email</Text>
                      <TextField
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        returnKeyType="next"
                      />
                    </View>

                    <View style={styles.fieldBlock}>
                      <Text style={styles.label}>Password</Text>
                      <TextField
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Your password"
                        secureTextEntry
                        autoComplete="password"
                        returnKeyType="done"
                        onSubmitEditing={handleEmailSignIn}
                      />
                    </View>

                    <CTAButton
                      variant="cobalt"
                      title="Sign in →"
                      onPress={handleEmailSignIn}
                      loading={loading}
                      disabled={loading}
                    />
                  </>
                )}

                {/* Google is the sole CTA while email auth is hidden, so it leads in cobalt. */}
                <CTAButton
                  variant={showEmailAuth ? 'secondary' : 'cobalt'}
                  title="Continue with Google"
                  onPress={handleGoogleSignIn}
                  loading={!showEmailAuth && loading}
                  disabled={loading || !request}
                  leftIcon={
                    <Ionicons
                      name="logo-google"
                      size={18}
                      color={showEmailAuth ? colors.textPrimary : colors.primaryText}
                    />
                  }
                />
              </View>
            </Card>

            {showEmailAuth && (
              <View style={styles.links}>
                <TouchableOpacity onPress={() => router.push('/auth/forgot-password')} activeOpacity={0.7}>
                  <Text style={styles.linkText}>Forgot password?</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/auth/signup')} activeOpacity={0.7}>
                  <Text style={styles.linkText}>Create account</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const makeStyles = (c) => StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 48 },

  hero: { alignItems: 'center', marginBottom: 40 },
  heroTag: {
    fontSize: 16, color: c.textSecondary,
    fontFamily: FONTS.display,
    letterSpacing: 0.2,
    marginTop: 12,
  },

  errorBox: {
    backgroundColor: c.error + '18',
    borderRadius: 12, padding: 14,
    marginBottom: 20,
    borderWidth: 1, borderColor: c.error + '44',
  },
  errorText: { color: c.error, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  form: { gap: 16 },
  fieldBlock: { gap: 6 },
  label: {
    color: c.textSecondary, fontSize: 13, fontFamily: FONTS.bodySemiBold,
  },
  links: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 28, paddingHorizontal: 4,
  },
  linkText: { color: c.primary, fontSize: 14, fontFamily: FONTS.bodySemiBold },
});
