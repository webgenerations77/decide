import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { FONTS } from '../constants/theme';
import ScreenBackground from '../components/brand/ScreenBackground';
import Card from '../components/brand/Card';

const EFFECTIVE_DATE = 'June 25, 2026';
const APP_NAME = 'Decide';
const CONTACT_EMAIL = 'support@decideyourday.com';

export default function TermsOfService() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenBackground variant="paper">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
            <Text style={styles.backTxt}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Terms of Service</Text>
          <Text style={styles.subtitle}>Effective {EFFECTIVE_DATE}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.introCard}>
            <Text style={styles.introText}>
              We wrote these in plain English. Read them — they're short and they matter.
            </Text>
          </Card>

          <Section title="1. Acceptance of Terms">
            By creating an account or using the {APP_NAME} app, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the app.
          </Section>

          <Section title={`2. What ${APP_NAME} does`}>
            {APP_NAME} uses AI-assisted recommendations, location data, and third-party data sources to suggest itineraries, restaurants, attractions, and activities. All recommendations are suggestions only — we do not guarantee accuracy, availability, or suitability for your specific situation.
          </Section>

          <Section title="3. User accounts">
            You must be at least 13 years of age to use this app. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
          </Section>

          <Section title="4. Location and personal data">
            {APP_NAME} requests access to your device location to provide location-based recommendations. Location data is used only to generate itinerary suggestions and is not sold to third parties. You may use manual location entry at any time.
          </Section>

          <Section title="5. Allergen & sensitivity warnings">
            Allergen and sensitivity alerts are informational only — not a substitute for direct communication with restaurants or medical professionals. Always verify allergen information with the specific establishment. {APP_NAME} assumes no liability for adverse reactions.
          </Section>

          <Section title="6. Third-party services">
            {APP_NAME} integrates with Google Maps, Google Places, National Park Service, and other providers. Your use of those services is subject to their respective terms. We are not responsible for the accuracy of third-party data.
          </Section>

          <Section title="7. Subscriptions">
            Free tier includes limited itinerary generations and quick spins per day. Pro subscription is billed monthly and renews automatically unless cancelled. Refund requests are handled case-by-case.
          </Section>

          <Section title="8. Prohibited uses">
            You agree not to: (a) use the app for any unlawful purpose; (b) scrape or reverse-engineer the service; (c) use automated tools to access the service; (d) impersonate other users or create fraudulent accounts; (e) interfere with the security or integrity of the service.
          </Section>

          <Section title="9. Disclaimer">
            {APP_NAME} is provided "as is." We do not warrant that the service will be uninterrupted or error-free, or that recommendations will be accurate or complete. Use at your own risk.
          </Section>

          <Section title="10. Limitation of liability">
            To the fullest extent permitted by law, {APP_NAME} and its operators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the app.
          </Section>

          <Section title="11. Changes">
            We may update these terms. Continued use after changes constitutes acceptance. We will notify users of material changes via the app or email.
          </Section>

          <Section title="12. Contact">
            Questions? Reach us at {CONTACT_EMAIL}
          </Section>

          <Text style={styles.legalNote}>
            Placeholder document — replace with legally reviewed copy before public launch.
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </ScreenBackground>
    </SafeAreaView>
  );
}

function Section({ title, children }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  screen:   { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  backBtn:  { marginBottom: 12 },
  backTxt:  { color: c.primary, fontSize: 14, fontFamily: FONTS.bodySemiBold },
  title:    {
    fontSize: 24, color: c.textPrimary,
    fontFamily: FONTS.displayHeavy,
  },
  subtitle: { fontSize: 12, color: c.textMuted, marginTop: 4, fontFamily: FONTS.body },

  content:  { paddingHorizontal: 20, paddingTop: 20 },

  introCard: {
    marginBottom: 24,
    borderLeftWidth: 3, borderLeftColor: c.gold,
  },
  introText: {
    fontSize: 14, color: c.textSecondary,
    lineHeight: 21, fontStyle: 'italic', fontFamily: FONTS.body,
  },

  section:      { marginBottom: 24 },
  sectionTitle: {
    fontSize: 14, color: c.primary,
    marginBottom: 8, letterSpacing: 0.2, fontFamily: FONTS.bodyBold,
  },
  sectionBody:  {
    fontSize: 14, color: c.textSecondary,
    lineHeight: 22, fontFamily: FONTS.body,
  },
  legalNote: {
    fontSize: 11, color: c.textMuted, fontStyle: 'italic', lineHeight: 16,
    marginTop: 8, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 16, fontFamily: FONTS.body,
  },
});
