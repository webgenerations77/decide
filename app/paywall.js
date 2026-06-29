import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { purchasePro, restorePurchases } from '../services/subscriptionService';
import { COLORS, FONTS } from '../constants/theme';
import ScreenBackground from '../components/brand/ScreenBackground';
import CTAButton from '../components/brand/CTAButton';
import Card from '../components/brand/Card';

const FREE_FEATURES = [
  { text: '5 decisions per day' },
  { text: '3 quick spins per day' },
  { text: 'Basic history' },
];

const PRO_FEATURES = [
  { text: 'Unlimited decisions' },
  { text: 'Unlimited spins' },
  { text: 'Full itinerary history' },
  { text: 'Priority support' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const result = await purchasePro();
      if (result.success) {
        Alert.alert('Welcome to Pro!', 'You now have unlimited access.', [
          { text: 'Let\'s go', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Coming Soon', result.message);
      }
    } catch (e) {
      Alert.alert('Something went wrong', e.message || 'Purchase failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        Alert.alert('All set!', 'Your Pro subscription has been restored.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Nothing found', 'No previous purchases found.');
      }
    } catch (e) {
      Alert.alert('Something went wrong', e.message || 'Restore failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground variant="paper">
      <SafeAreaView style={styles.container}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>

        <View style={styles.hero}>
          <View style={styles.crownBadge}>
            <Ionicons name="star" size={28} color={COLORS.amber} />
          </View>
          <Text style={styles.heroTitle}>Unlock Cheddar Pro</Text>
          <Text style={styles.heroSub}>Unlimited decisions. Every day.</Text>
        </View>

        <View style={styles.comparison}>
          <Card style={styles.planColFree}>
            <Text style={styles.planLabel}>Free</Text>
            {FREE_FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Ionicons name="checkmark" size={16} color={COLORS.textMuted} />
                <Text style={styles.featureTextFree}>{f.text}</Text>
              </View>
            ))}
          </Card>
          <Card style={styles.planColPro}>
            <Text style={styles.planLabelPro}>Pro</Text>
            {PRO_FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.amber} />
                <Text style={styles.featureTextPro}>{f.text}</Text>
              </View>
            ))}
          </Card>
        </View>

        <CTAButton
          variant="go"
          title="Upgrade to Pro — $3.99/mo"
          onPress={handleUpgrade}
          loading={loading}
          disabled={loading}
          style={styles.upgradeBtn}
        />

        <TouchableOpacity onPress={handleRestore} disabled={loading} activeOpacity={0.7}>
          <Text style={styles.restoreText}>Restore purchases</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24, justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute', top: 56, right: 20, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },

  hero: { alignItems: 'center', marginBottom: 32 },
  crownBadge: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.gold + '22',
    borderWidth: 2, borderColor: COLORS.amber + '44',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 26, color: COLORS.textPrimary,
    fontFamily: FONTS.displayHeavy,
    textAlign: 'center', marginBottom: 6,
  },
  heroSub: { fontSize: 15, color: COLORS.textSecondary, fontFamily: FONTS.body, textAlign: 'center' },

  comparison: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  planColFree: {
    flex: 1, gap: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  planColPro: {
    flex: 1, gap: 10,
    borderWidth: 1, borderColor: COLORS.amber + '55',
    backgroundColor: COLORS.gold + '22',
  },
  planLabel: {
    fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.textMuted,
    textAlign: 'center', marginBottom: 2,
  },
  planLabelPro: {
    fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.goldText,
    textAlign: 'center', marginBottom: 2,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureTextFree: { color: COLORS.textMuted, fontSize: 13, fontFamily: FONTS.body, flex: 1 },
  featureTextPro:  { color: COLORS.textPrimary, fontSize: 13, fontFamily: FONTS.body, flex: 1 },

  upgradeBtn: { marginBottom: 16 },
  restoreText: {
    color: COLORS.textMuted, fontSize: 14, textAlign: 'center', fontFamily: FONTS.bodySemiBold,
  },
});
