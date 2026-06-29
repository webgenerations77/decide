import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { signInWithGoogleCredential } from '../../services/authService';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../constants/theme';
import BrandLogo from '../../components/brand/BrandLogo';
import ScreenBackground from '../../components/brand/ScreenBackground';
import CTAButton from '../../components/brand/CTAButton';
import Card from '../../components/brand/Card';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
  });

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
      }
    } catch (e) {
      setError(e.message || 'Google sign-in failed.');
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
              <BrandLogo variant="stacked" size={80} />
              <Text style={styles.heroTag}>Your day, decided by Cheddar.</Text>
            </Animated.View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Card>
              <View style={styles.form}>
                <View style={styles.fieldBlock}>
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
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Your password"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry
                    autoComplete="password"
                    returnKeyType="done"
                    onSubmitEditing={handleEmailSignIn}
                  />
                </View>

                <CTAButton
                  variant="go"
                  title="Sign in →"
                  onPress={handleEmailSignIn}
                  loading={loading}
                  disabled={loading}
                />

                <CTAButton
                  variant="secondary"
                  title="Continue with Google"
                  onPress={handleGoogleSignIn}
                  disabled={loading || !request}
                  leftIcon={<Ionicons name="logo-google" size={18} color={COLORS.textPrimary} />}
                />
              </View>
            </Card>

            <View style={styles.links}>
              <TouchableOpacity onPress={() => router.push('/auth/forgot-password')} activeOpacity={0.7}>
                <Text style={styles.linkText}>Forgot password?</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/auth/signup')} activeOpacity={0.7}>
                <Text style={styles.linkText}>Create account</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 48 },

  hero: { alignItems: 'center', marginBottom: 40 },
  heroTag: {
    fontSize: 16, color: COLORS.textSecondary,
    fontFamily: FONTS.display,
    letterSpacing: 0.2,
    marginTop: 12,
  },

  errorBox: {
    backgroundColor: COLORS.error + '18',
    borderRadius: 12, padding: 14,
    marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.error + '44',
  },
  errorText: { color: COLORS.error, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  form: { gap: 16 },
  fieldBlock: { gap: 6 },
  label: {
    color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.bodySemiBold,
  },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, paddingHorizontal: 16, height: 52,
    fontSize: 16, color: COLORS.textPrimary,
  },
  links: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 28, paddingHorizontal: 4,
  },
  linkText: { color: COLORS.primary, fontSize: 14, fontFamily: FONTS.bodySemiBold },
});
