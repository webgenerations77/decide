import { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADII } from '../constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

function ShimmerLine({ height = 14, width = '100%', style }) {
  const shimmerX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: SCREEN_WIDTH,
        duration: 1500,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View
      style={[
        { height, borderRadius: height / 2, backgroundColor: COLORS.surfaceAlt, overflow: 'hidden', width },
        style,
      ]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateX: shimmerX }] }]}
      >
        <LinearGradient
          colors={['transparent', COLORS.sky100 + 'CC', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export default function SkeletonStopCard({ delay = 0 }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
      <View style={styles.dot} />
      <View style={styles.card}>
        <View style={styles.topRow}>
          <ShimmerLine height={22} width="28%" />
          <ShimmerLine height={22} width="18%" />
          <ShimmerLine height={22} width="22%" />
        </View>
        <ShimmerLine height={20} width="72%" style={{ marginTop: 14 }} />
        <ShimmerLine height={14} width="50%" style={{ marginTop: 8 }} />
        <View style={{ marginTop: 12, gap: 6 }}>
          <ShimmerLine height={13} width="88%" />
          <ShimmerLine height={13} width="76%" />
          <ShimmerLine height={13} width="60%" />
        </View>
        <View style={styles.bottomRow}>
          <ShimmerLine height={36} width="60%" style={{ borderRadius: 12 }} />
          <ShimmerLine height={36} width="34%" style={{ borderRadius: 12 }} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.border,
    marginTop: 18, marginRight: 12, flexShrink: 0,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
});
