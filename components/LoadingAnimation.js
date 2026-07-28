import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import LottieView from 'lottie-react-native';
import SectionLabel from './brand/SectionLabel';
import BrandLogo from './brand/BrandLogo';
import Card from './brand/Card';
import HouseAd from './HouseAd';
import { FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { fetchLoadingFacts } from '../lib/loadingFacts';
import { pickHouseAd } from '../constants/houseAds';

// Post-"Build my day" loading state.
//
// Three zones, top to bottom:
//   1. A house card for another Spinach Creations app — dead time the traveller has already
//      accepted. Falls back to the live-facts card when there is no ad to show.
//   2. Decide's mark, the status label, and the countdown.
//   3. The Lottie globe, smaller than it used to be and no longer the centrepiece.
//
// Everything here fails soft: no facts, no ad, no Lottie — the label and the clock still render.

// Lottie sized for both native (style) and web (webStyle — the web LottieView path ignores
// `style` and only honours `webStyle`). Was 200; the globe moved to the bottom third and shrank
// so the countdown could take the eye instead.
const SIZE = { width: 140, height: 140 };

const ROTATE_MS = 5500;

/**
 * ⚠ THIS NUMBER IS AN ESTIMATE, AND IT IS CURRENTLY FOLKLORE.
 *
 * 45s is an eyeball figure from watching real generations, not a measurement — nothing in the
 * codebase timed a generation until `durationMs` was added to logUsage alongside this screen.
 * Once beta traffic has accumulated, read the p80 from the admin dashboard's "Itinerary
 * generation" panel and put it here. p80 rather than p50 deliberately: this drives a countdown,
 * and a clock that expires early on one run in two is worse than one that finishes early.
 *
 * It must stay an estimate in the UI's mind, not a promise. See the zero behaviour below.
 *
 * ⚠ THIS NUMBER IS NOW COUPLED TO TWO OTHERS. Do not raise it in isolation:
 *     45s  this countdown
 *     54s  SYNTHESIS_BUDGET_MS (lib/smart/index.js) — synthesis aborts and the day falls back
 *     60s  Vercel maxDuration (vercel.json) — the function is killed outright
 * The ordering is the design: the clock runs out BEFORE the server gives up, so "almost there"
 * is still true when it appears — a plan really is coming, just a simpler one. Push this past
 * the synthesis budget and the countdown starts promising time the server has already spent.
 */
const ESTIMATED_SECONDS = 45;

/**
 * Copy for the stretch after the estimate runs out.
 *
 * The countdown NEVER shows 0:00, never counts negative, and never freezes at 0:01 — all three
 * read as a hang, which is the precise impression a countdown exists to prevent. When the
 * estimate is spent it simply stops being a clock and becomes a sentence.
 */
const OVERTIME_COPY = 'Almost there — putting the finishing touches on it';

/**
 * Status lines, in the order the server actually works: live research, then place discovery,
 * then synthesis.
 *
 * ⚠ These are TIME-DRIVEN, not progress-driven. The client makes one POST and waits, so it has
 * no visibility into which phase the server is in — these are indicative of the pipeline's real
 * order, not a measurement of it. That is why each line describes an activity that is broadly
 * true for the whole wait rather than claiming a step is finished. Do not reword them into
 * completion claims ("Found 40 places") without real progress data behind them.
 */
const PHASES = [
  { at: 0.00, text: 'Checking what’s happening nearby' },
  { at: 0.35, text: 'Finding places worth your time' },
  { at: 0.70, text: 'Putting the day in order' },
];

function clock(secs) {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function LoadingAnimation({ label = 'Building your day…', coords }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [adFailed, setAdFailed] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  // Chosen once per mount so the card cannot swap mid-wait, which reads as a glitch. The mount
  // IS the loading session: this component is rendered only while a plan is generating.
  const ad = useMemo(() => (adFailed ? null : pickHouseAd(0)), [adFailed]);

  // Fetch the three live facts once on mount (or when coords first arrive).
  useEffect(() => {
    let active = true;
    fetchLoadingFacts(coords)
      .then((c) => { if (active) { setCards(c); setIndex(0); } })
      .catch(() => {});
    return () => { active = false; };
  }, [coords]);

  // One tick per second for the whole wait. Counting elapsed rather than storing a deadline
  // keeps the overtime copy trivially correct however long the server takes.
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

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
  const remaining = ESTIMATED_SECONDS - elapsed;
  const overtime = remaining <= 0;
  const phase = [...PHASES].reverse()
    .find((p) => elapsed >= p.at * ESTIMATED_SECONDS)?.text ?? PHASES[0].text;

  return (
    <View style={styles.wrap}>
      {/* ─── TOP: another app in the family, or the live facts when there is no ad ───────── */}
      <View style={styles.topSlot}>
        {ad ? (
          <HouseAd ad={ad} onUnavailable={() => setAdFailed(true)} />
        ) : card ? (
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
        ) : null}
      </View>

      {/* ─── MIDDLE: whose app this is, what it is doing, how much longer ────────────────── */}
      <View style={styles.middle}>
        <BrandLogo variant="full" size={30} />
        <SectionLabel tone="cobalt" style={styles.label}>{label}</SectionLabel>

        {/* Mono for the digits — it is a time, per the Mono Is Structural rule. 28px is the
            type ceiling for the whole product and this sits exactly on it. */}
        {overtime ? (
          <Text style={styles.overtime}>{OVERTIME_COPY}</Text>
        ) : (
          <>
            <Text style={styles.clock}>{clock(remaining)}</Text>
            <Text style={styles.phase}>{phase}</Text>
          </>
        )}
      </View>

      {/* ─── BOTTOM: the globe, smaller and no longer the main event ─────────────────────── */}
      <LottieView
        source={require('../assets/loading.json')}
        autoPlay
        loop
        style={styles.lottie}
        webStyle={SIZE}
      />
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  // alignSelf stretch + flex so the three zones can spread across the overlay. Both call sites
  // (the plan screen overlay and the admin preview) centre their children, which would otherwise
  // shrink this to its content width and collapse the layout back to a stack.
  //
  // ⚠ minHeight is NOT decoration. `flex: 1` resolves to ZERO height in a parent that has no
  // definite height of its own, and this component renders inside an RN Modal — a context where
  // that is easy to get wrong. Before the three-zone rework this was content-sized and so drew
  // itself anywhere; now it can be laid out to nothing and render as an empty background. The
  // floor guarantees it is always visible; wherever the parent does give real height, flex wins
  // and this never applies.
  wrap: {
    flex: 1, alignSelf: 'stretch', width: '100%', minHeight: 480,
    alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 20, paddingHorizontal: 16,
  },

  // Reserves the slot whether or not it is filled, so the countdown does not jump when the ad
  // resolves or a fact arrives late.
  topSlot: { width: '100%', alignItems: 'center', minHeight: 132, justifyContent: 'center' },

  middle: { alignItems: 'center', gap: 8 },
  label:  { textAlign: 'center' },
  clock: {
    fontFamily: FONTS.mono, fontSize: 28, color: c.textPrimary,
    letterSpacing: 1, marginTop: 2,
  },
  phase: {
    fontFamily: FONTS.body, fontSize: 13, color: c.textSecondary,
    textAlign: 'center', maxWidth: 280,
  },
  // Same vertical space the clock and phase occupied, so nothing shifts at the handover.
  overtime: {
    fontFamily: FONTS.body, fontSize: 14, lineHeight: 20, color: c.textSecondary,
    textAlign: 'center', maxWidth: 260, marginTop: 6,
  },

  lottie: SIZE,

  cardWrap: { width: 300, maxWidth: '88%' },
  infoCard: { gap: 6, alignItems: 'center' },
  infoTitle:{ marginBottom: 2, textAlign: 'center' },
  infoLine: {
    fontSize: 14, color: c.textSecondary, fontFamily: FONTS.body,
    lineHeight: 20, textAlign: 'center',
  },
});
