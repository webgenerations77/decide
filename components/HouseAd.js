import { useState, useMemo, createElement } from 'react';
import { View, Text, Image, TouchableOpacity, Linking, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, RADII } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { hapticTap } from '../services/hapticsService';

// "More from Spinach Creations" — a house card for another app in the family.
//
// Lives in the loading screen's top slot, which is dead time the traveller has already accepted.
// Framed as a family card rather than an ad unit on purpose: PRODUCT.md's anti-references include
// the generic ad-supported free app, and the difference between the two is almost entirely
// framing rather than pixels.
//
// TWO RENDERINGS:
//   web + ad.embed  → the ad PLAYS. A silent, self-starting, looping cut of the real trailer in
//                     an iframe (see scripts/build-house-ad.js). It is a separate lazy request
//                     from public/, so it never enters the JS bundle.
//   otherwise       → a still card. This is the native path, and the fallback if the embed
//                     fails to load. Never a blank frame.
//
// ⚠ THE ONE BUG THIS FEATURE COULD CAUSE: tapping this while a plan is generating must not
// navigate the PWA away. Doing so cancels the in-flight /api/itinerary request and the traveller
// loses the day they just waited forty seconds for. So the link opens in a NEW TAB on web, and
// react-native-web's Linking is deliberately NOT trusted to do that — it has resolved to a
// same-tab navigation, which is the exact failure. See openAd below.

export default function HouseAd({ ad, onUnavailable }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [artFailed, setArtFailed] = useState(false);
  const [embedFailed, setEmbedFailed] = useState(false);

  if (!ad) return null;

  const canEmbed = Platform.OS === 'web' && !!ad.embed && !embedFailed;

  const openAd = () => {
    hapticTap();
    if (Platform.OS === 'web') {
      // noopener/noreferrer: the opened page gets no handle back to this window, so it cannot
      // touch the tab still waiting on an itinerary.
      if (typeof window !== 'undefined') window.open(ad.url, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(ad.url).catch(() => {});
  };

  return (
    <View style={styles.wrap}>
      {/* Space Mono eyebrow — structural label, per DESIGN.md's Mono Is Structural rule. It is
          doing real work: it tells the traveller this is a sibling app, not a sponsor. */}
      <Text style={styles.eyebrow}>More from Spinach Creations</Text>

      <TouchableOpacity
        style={canEmbed ? styles.frameCard : styles.card}
        activeOpacity={0.85}
        onPress={openAd}
        accessibilityRole="link"
        accessibilityLabel={`${ad.name}. ${ad.tagline}. ${ad.cta}. Opens in a new tab.`}
      >
        {canEmbed ? (
          <>
            {/* Raw DOM iframe: react-native-web renders through react-dom, so a string tag is
                a real element here. `pointerEvents: none` is what lets the tap fall through to
                the TouchableOpacity above — without it the iframe swallows every press and the
                ad becomes unclickable. The embed needs no interaction of its own: it autoplays,
                loops, and its controls are hidden by the build script. */}
            <View style={[styles.frame, { aspectRatio: ad.embedAspect ?? 16 / 9 }]}>
              {createElement('iframe', {
                src: ad.embed,
                title: `${ad.name} — silent preview`,
                loading: 'lazy',
                scrolling: 'no',
                tabIndex: -1,
                'aria-hidden': 'true',
                onError: () => setEmbedFailed(true),
                style: {
                  border: 0, display: 'block', width: '100%', height: '100%',
                  pointerEvents: 'none', backgroundColor: colors.navy,
                },
              })}
            </View>
            <View style={styles.capRow}>
              <Text style={styles.capName} numberOfLines={1}>{ad.name}</Text>
              <Text style={styles.capCta} numberOfLines={1}>{ad.cta}</Text>
              <Ionicons name="open-outline" size={12} color={colors.primary} />
            </View>
          </>
        ) : (
          <>
            {ad.media && !artFailed ? (
              <Image
                source={ad.media}
                style={styles.art}
                resizeMode="cover"
                // A bundled asset failing is close to impossible, but if it does the parent
                // swaps this slot for the live-facts card rather than showing a broken frame.
                onError={() => { setArtFailed(true); onUnavailable?.(); }}
              />
            ) : null}
            <View style={styles.copy}>
              <Text style={styles.name} numberOfLines={1}>{ad.name}</Text>
              <Text style={styles.tagline} numberOfLines={2}>{ad.tagline}</Text>
              <View style={styles.ctaRow}>
                <Text style={styles.cta} numberOfLines={1}>{ad.cta}</Text>
                <Ionicons name="open-outline" size={12} color={colors.primary} />
              </View>
            </View>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap: { width: '100%', maxWidth: 380, gap: 7 },

  eyebrow: {
    fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 1.5,
    color: c.textMuted, textTransform: 'uppercase', textAlign: 'center',
  },

  // ── Playing variant ──────────────────────────────────────────────────────────
  // overflow hidden so the trailer's own dark stage is clipped to the card radius.
  frameCard: {
    borderRadius: RADII.md, overflow: 'hidden',
    backgroundColor: c.surface,
    borderWidth: 1, borderColor: c.border,
  },
  frame: { width: '100%', backgroundColor: c.navy },
  capRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  capName: { flex: 1, fontFamily: FONTS.display, fontSize: 13, color: c.textPrimary },
  // Names what the tap adds, since the embed is deliberately silent and shortened.
  capCta:  { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: c.primary },

  // ── Still variant (native, and the fallback) ─────────────────────────────────
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 10,
    borderRadius: RADII.md,
    backgroundColor: c.surface,
    borderWidth: 1, borderColor: c.border,
  },
  // Portrait, phone-shaped, small. It reads as "an app" at a glance, which is all it has to do.
  art: {
    width: 46, height: 102,
    borderRadius: 7,
    backgroundColor: c.surfaceAlt,
  },
  copy: { flex: 1, gap: 2 },
  name:    { fontFamily: FONTS.display, fontSize: 14, color: c.textPrimary },
  tagline: { fontFamily: FONTS.body, fontSize: 12, lineHeight: 16, color: c.textSecondary },
  ctaRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  // Cobalt, like every other action in the system. No orange — One Orange rule.
  cta: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: c.primary },
});
