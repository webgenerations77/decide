import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FONTS, RADII, SHADOWS } from '../../constants/theme';
import { KEYS } from '../../services/settingsService';
import { useTheme } from '../../context/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

async function readMap() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.COLLAPSED_SECTIONS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function CollapsibleCard({ title, sectionKey, defaultCollapsed = true, children, style }) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, scheme), [colors, scheme]);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    readMap().then((map) => {
      if (typeof map[sectionKey] === 'boolean') setCollapsed(map[sectionKey]);
    });
  }, [sectionKey]);

  const toggle = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !collapsed;
    setCollapsed(next);
    const map = await readMap();
    map[sectionKey] = next;
    AsyncStorage.setItem(KEYS.COLLAPSED_SECTIONS, JSON.stringify(map)).catch(() => {});
  };

  return (
    <View style={style}>
      <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.7}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.chevron, !collapsed && styles.chevronOpen]}>▾</Text>
      </TouchableOpacity>
      {!collapsed && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const makeStyles = (c, scheme) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingVertical: 6, marginBottom: 10,
  },
  title: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: c.primary },
  chevron: { fontSize: 20, lineHeight: 20, color: c.textMuted },
  chevronOpen: { color: c.primary },
  body: {
    backgroundColor: c.surface, borderRadius: RADII.md, padding: 16, ...SHADOWS.card,
    ...(scheme === 'dark' ? { borderWidth: StyleSheet.hairlineWidth, borderColor: c.border } : null),
  },
});
