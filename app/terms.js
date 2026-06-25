import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const EFFECTIVE_DATE = 'June 25, 2026';
const APP_NAME = 'Decide';
const CONTACT_EMAIL = 'support@decideyourday.com';

export default function TermsOfService() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.subtitle}>Effective: {EFFECTIVE_DATE}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="1. Acceptance of Terms">
          By creating an account or using the {APP_NAME} app, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the app.
        </Section>

        <Section title="2. Description of Service">
          {APP_NAME} is a travel and activity planning application ("Cheddar") that uses AI-assisted recommendations, location data, and third-party data sources to suggest itineraries, restaurants, attractions, and activities. All recommendations are suggestions only — we do not guarantee accuracy, availability, or suitability for your specific situation.
        </Section>

        <Section title="3. User Accounts">
          You must be at least 13 years of age to use this app. You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate and complete information during registration. You are responsible for all activities that occur under your account.
        </Section>

        <Section title="4. Location and Personal Data">
          {APP_NAME} requests access to your device location to provide location-based recommendations. Location data is used only to generate itinerary suggestions and is not sold to third parties. You may use manual location entry at any time. Please review our Privacy Policy for full details on how we collect, use, and store your data.
        </Section>

        <Section title="5. Allergen & Sensitivity Warnings">
          Allergen and sensitivity alerts provided by {APP_NAME} are informational only and are NOT a substitute for direct communication with restaurants, venues, or medical professionals. Always verify allergen information with the specific establishment before consuming food or visiting a location. {APP_NAME} assumes no liability for adverse reactions.
        </Section>

        <Section title="6. Third-Party Services">
          {APP_NAME} integrates with third-party services including Google Maps, Google Places, National Park Service, and other data providers. Your use of those services is subject to their respective terms and privacy policies. We are not responsible for the accuracy of third-party data.
        </Section>

        <Section title="7. Subscription and Payments">
          Free tier: limited to a specified number of itinerary generations and quick spins per day. Pro subscription: unlimited use, billed monthly. All payments are processed through authorized payment providers. Subscriptions renew automatically unless cancelled. Refund requests are handled on a case-by-case basis.
        </Section>

        <Section title="8. Prohibited Uses">
          You agree not to: (a) use the app for any unlawful purpose; (b) attempt to scrape, reverse-engineer, or extract data from the app; (c) use automated tools to access the service; (d) impersonate other users or create fraudulent accounts; (e) interfere with the security or integrity of the service.
        </Section>

        <Section title="9. Disclaimer of Warranties">
          {APP_NAME} is provided "as is" without warranty of any kind, express or implied. We do not warrant that the service will be uninterrupted, error-free, or that recommendations will be accurate or complete. Use the app at your own risk.
        </Section>

        <Section title="10. Limitation of Liability">
          To the fullest extent permitted by law, {APP_NAME} and its operators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the app or reliance on its recommendations.
        </Section>

        <Section title="11. Changes to Terms">
          We may update these Terms of Service from time to time. Continued use of the app after changes constitutes acceptance of the updated terms. We will notify users of material changes via the app or email.
        </Section>

        <Section title="12. Contact">
          Questions about these Terms? Contact us at {CONTACT_EMAIL}
        </Section>

        <Text style={styles.legalNote}>
          This is a placeholder Terms of Service document. Replace with legally reviewed copy before public launch.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: '#0C1A2E' },
  header:   { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#1E3A5A' },
  backBtn:  { marginBottom: 12 },
  backTxt:  { color: '#FF6B35', fontSize: 14, fontWeight: '600' },
  title:    { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  subtitle: { fontSize: 12, color: '#4A7090', marginTop: 4 },
  content:  { paddingHorizontal: 20, paddingTop: 20 },
  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#C9964E', marginBottom: 8, letterSpacing: 0.3 },
  sectionBody:  { fontSize: 14, color: '#8AACBF', lineHeight: 22 },
  legalNote: {
    fontSize: 11, color: '#4A7090', fontStyle: 'italic', lineHeight: 16,
    marginTop: 8, borderTopWidth: 1, borderTopColor: '#1E3A5A', paddingTop: 16,
  },
});
