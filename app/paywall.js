import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { purchasePro, restorePurchases } from '../services/subscriptionService';
import { COLORS, FONTS } from '../constants/theme';

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
        <View style={styles.planCol}>
          <Text style={styles.planLabel}>Free</Text>
          {FREE_FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons name="checkmark" size={16} color={COLORS.textMuted} />
              <Text style={styles.featureTextFree}>{f.text}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.planCol, styles.planColPro]}>
          <Text style={styles.planLabelPro}>Pro</Text>
          {PRO_FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.amber} />
              <Text style={styles.featureTextPro}>{f.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        onPress={handleUpgrade}
        disabled={loading}
        activeOpacity={0.88}
        style={loading && styles.btnDisabled}
      >
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.upgradeBtn}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.primaryText} />
          ) : (
            <Text style={styles.upgradeBtnText}>Upgrade to Pro — $3.99/mo</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleRestore} disabled={loading} activeOpacity={0.7}>
        <Text style={styles.restoreText}>Restore purchases</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.bg,
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
    backgroundColor: COLORS.amberFaint,
    borderWidth: 2, borderColor: COLORS.amber + '44',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 26, color: COLORS.textPrimary,
    fontFamily: 'PlayfairDisplay_800ExtraBold',
    textAlign: 'center', marginBottom: 6,
  },
  heroSub: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center' },

  comparison: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  planCol: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border, padding: 16, gap: 10,
  },
  planColPro: {
    borderColor: COLORS.amber + '55',
    backgroundColor: COLORS.amberFaint,
  },
  planLabel: {
    fontSize: 15, fontWeight: '700', color: COLORS.textMuted,
    textAlign: 'center', marginBottom: 2,
  },
  planLabelPro: {
    fontSize: 15, fontWeight: '700', color: COLORS.amber,
    textAlign: 'center', marginBottom: 2,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureTextFree: { color: COLORS.textMuted, fontSize: 13, flex: 1 },
  featureTextPro:  { color: COLORS.textPrimary, fontSize: 13, flex: 1 },

  upgradeBtn: {
    borderRadius: 18, height: 58,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42, shadowRadius: 16, elevation: 10,
  },
  upgradeBtnText: { color: COLORS.primaryText, fontSize: 17, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  restoreText: {
    color: COLORS.textMuted, fontSize: 14, textAlign: 'center', fontWeight: '600',
  },
});
