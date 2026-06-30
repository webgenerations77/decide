import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import LottieView from 'lottie-react-native';
import SectionLabel from './brand/SectionLabel';
import Card from './brand/Card';
import { FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { fetchLoadingFacts } from '../lib/loadingFacts';

// Lottie animation sized for both native (style) and web (webStyle — the web
// LottieView path ignores `style` and only honors `webStyle`).
const SIZE = { width: 200, height: 200 };

const ROTATE_MS = 3500;

// Post-"Build my day" loading state — Lottie animation + cobalt status label,
// plus rotating live info cards (weather / born today / on this day) fetched
// from keyless public APIs. Cards fail soft: if none load, only the animation
// shows — exactly as before.
export default function LoadingAnimation({ label = 'Building your day…', coords }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  // Fetch the three live facts once on mount (or when coords first arrive).
  useEffect(() => {
    let active = true;
    fetchLoadingFacts(coords)
      .then((c) => { if (active) { setCards(c); setIndex(0); } })
      .catch(() => {});
    return () => { active = false; };
  }, [coords]);

  // Gentle fade rotation through the available cards (only if 2+).
  useEffect(() => {
    if (cards.length < 2) return;
    const id = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % cards.length);
        Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      });
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [cards, fade]);

  const card = cards[index];

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

      {card && (
        <Animated.View style={[styles.cardWrap, { opacity: fade }]}>
          <Card style={styles.infoCard}>
            <SectionLabel tone="cobalt" style={styles.infoTitle}>
              {card.emoji} {card.title}
            </SectionLabel>
            {card.lines.map((line, i) => (
              <Text key={i} style={styles.infoLine}>{line}</Text>
            ))}
          </Card>
        </Animated.View>
      )}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap:     { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  lottie:   SIZE,
  label:    { marginTop: 12, textAlign: 'center' },
  cardWrap: { marginTop: 24, width: 300, maxWidth: '88%' },
  infoCard: { gap: 6, alignItems: 'center' },
  infoTitle:{ marginBottom: 2, textAlign: 'center' },
  infoLine: {
    fontSize: 14, color: c.textSecondary, fontFamily: FONTS.body,
    lineHeight: 20, textAlign: 'center',
  },
});
