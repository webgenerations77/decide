import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { signInWithGoogleCredential } from '../../services/authService';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { COLORS, FONTS } from '../../constants/theme';

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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.hero, { opacity: heroAnim, transform: [{ translateY: heroSlide }] }]}>
            <Image
              source={require('../../assets/logo-small.png')}
              style={styles.heroLogo}
              resizeMode="contain"
            />
            <Text style={styles.heroTag}>Your day, decided by Cheddar.</Text>
          </Animated.View>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

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

            <TouchableOpacity
              onPress={handleEmailSignIn}
              disabled={loading}
              activeOpacity={0.88}
              style={loading && styles.btnDisabled}
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
                  <Text style={styles.primaryBtnText}>Sign in →</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleSignIn}
              disabled={loading || !request}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-google" size={18} color={COLORS.amber} style={{ marginRight: 10 }} />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>

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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 48 },

  hero: { alignItems: 'center', marginBottom: 40 },
  heroLogo: { width: 130, height: 130, marginBottom: 16 },
  heroTag: {
    fontSize: 16, color: COLORS.textSecondary,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.2,
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
    color: COLORS.textSecondary, fontSize: 13, fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, paddingHorizontal: 16, height: 52,
    fontSize: 16, color: COLORS.textPrimary,
  },
  primaryBtn: {
    borderRadius: 18, height: 58,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  primaryBtnText: {
    color: COLORS.primaryText, fontSize: 17, fontWeight: '700',
  },
  btnDisabled: { opacity: 0.6 },
  googleBtn: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 18, height: 58, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row',
  },
  googleBtnText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600' },
  links: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 28, paddingHorizontal: 4,
  },
  linkText: { color: COLORS.amber, fontSize: 14, fontWeight: '600' },
});
