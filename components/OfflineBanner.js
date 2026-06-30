import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '../context/ThemeContext';
import { FONTS } from '../constants/theme';

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

const makeStyles = (c) => StyleSheet.create({
  banner: {
    position: 'absolute', left: 0, right: 0,
    height: 32, zIndex: 9998, elevation: 19,
    backgroundColor: c.error,
    alignItems: 'center', justifyContent: 'center',
  },
  text: { fontSize: 12, fontFamily: FONTS.bodyBold, color: c.primaryText },
});
