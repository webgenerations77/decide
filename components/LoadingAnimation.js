import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import SectionLabel from './brand/SectionLabel';

// Post-"Build my day" loading state — Lottie animation + cobalt status label.
export default function LoadingAnimation({ label = 'Building your day…' }) {
  return (
    <View style={styles.wrap}>
      <LottieView
        source={require('../assets/loading.json')}
        autoPlay
        loop
        style={styles.lottie}
      />
      <SectionLabel tone="cobalt" style={styles.label}>{label}</SectionLabel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  lottie: { width: 160, height: 160 },
  label:  { marginTop: 12, textAlign: 'center' },
});
