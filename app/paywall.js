import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { purchasePro, restorePurchases } from '../services/subscriptionService';

const FREE_FEATURES = [
  { text: '5 decisions per day', included: true },
  { text: '3 quick spins per day', included: true },
  { text: 'Basic history', included: true },
];

const PRO_FEATURES = [
  { text: 'Unlimited decisions', included: true },
  { text: 'Unlimited spins', included: true },
  { text: 'Full itinerary history', included: true },
  { text: 'Priority support', included: true },
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
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Coming Soon', result.message);
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Purchase failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        Alert.alert('Restored!', 'Your Pro subscription has been restored.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('No Purchases', 'No previous purchases found to restore.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Restore failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>👑</Text>
        <Text style={styles.heroTitle}>Unlock Decide Pro</Text>
        <Text style={styles.heroSub}>Unlimited decisions, every day.</Text>
      </View>

      <View style={styles.comparison}>
        <View style={styles.planCol}>
          <Text style={styles.planLabel}>Free</Text>
          {FREE_FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureCheck}>✓</Text>
              <Text style={styles.featureTextFree}>{f.text}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.planCol, styles.planColPro]}>
          <Text style={styles.planLabelPro}>Pro</Text>
          {PRO_FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureCheckPro}>✓</Text>
              <Text style={styles.featureTextPro}>{f.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.upgradeBtn, loading && styles.btnDisabled]}
        onPress={handleUpgrade}
        disabled={loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator color="#00191f" />
        ) : (
          <Text style={styles.upgradeBtnText}>Upgrade to Pro — $3.99/mo</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={handleRestore} disabled={loading} activeOpacity={0.7}>
        <Text style={styles.restoreText}>Restore Purchases</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#00191f', paddingHorizontal: 24, justifyContent: 'center' },
  closeBtn: {
    position: 'absolute', top: 56, right: 20, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#00262e', alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#9ca3af', fontSize: 16, fontWeight: '700' },
  hero: { alignItems: 'center', marginBottom: 32 },
  heroEmoji: { fontSize: 56, marginBottom: 8 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#ffffff' },
  heroSub: { fontSize: 15, color: '#9ca3af', marginTop: 4 },
  comparison: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  planCol: {
    flex: 1, backgroundColor: '#00262e', borderRadius: 16,
    borderWidth: 1, borderColor: '#003040', padding: 16,
  },
  planColPro: { borderColor: '#00d2be', backgroundColor: 'rgba(0,210,190,0.08)' },
  planLabel: { fontSize: 16, fontWeight: '700', color: '#9ca3af', marginBottom: 12, textAlign: 'center' },
  planLabelPro: { fontSize: 16, fontWeight: '700', color: '#00d2be', marginBottom: 12, textAlign: 'center' },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  featureCheck: { color: '#4a6a6e', fontSize: 14, marginRight: 8, fontWeight: '700' },
  featureCheckPro: { color: '#00d2be', fontSize: 14, marginRight: 8, fontWeight: '700' },
  featureTextFree: { color: '#9ca3af', fontSize: 13, flex: 1 },
  featureTextPro: { color: '#ffffff', fontSize: 13, flex: 1 },
  upgradeBtn: {
    backgroundColor: '#00d2be', borderRadius: 16, height: 56,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  upgradeBtnText: { color: '#00191f', fontSize: 17, fontWeight: '800' },
  btnDisabled: { opacity: 0.6 },
  restoreText: { color: '#4a6a6e', fontSize: 14, textAlign: 'center', fontWeight: '600' },
});
