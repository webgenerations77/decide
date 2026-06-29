import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import SectionLabel from './brand/SectionLabel';

// Lottie animation sized for both native (style) and web (webStyle — the web
// LottieView path ignores `style` and only honors `webStyle`).
const SIZE = { width: 200, height: 200 };

// Post-"Build my day" loading state — Lottie animation + cobalt status label.
// Rendered centered inside a full-screen overlay by plan.js while loading.
export default function LoadingAnimation({ label = 'Building your day…' }) {
  return (
    <View style={styles.wrap}>
      <LottieView
        source={require('../assets/loading.json')}
        autoPlay
        loop
        style={styles.lottie}
        webStyle={SIZE}
      />
      <SectionLabel tone="cobalt" style={styles.label}>{label}</SectionLabel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  lottie: SIZE,
  label:  { marginTop: 12, textAlign: 'center' },
});
