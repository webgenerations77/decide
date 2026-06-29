import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { COLORS, FONTS } from '../constants/theme';

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(state.isConnected === false);
    });
    return unsubscribe;
  }, []);

  if (!isOffline) return null;

  return (
    <View style={[styles.banner, { top: insets.top }]}>
      <Text style={styles.text}>No internet — reconnecting…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', left: 0, right: 0,
    height: 32, zIndex: 9998, elevation: 19,
    backgroundColor: COLORS.error,
    alignItems: 'center', justifyContent: 'center',
  },
  text: { fontSize: 12, fontFamily: FONTS.bodyBold, color: COLORS.primaryText },
});
