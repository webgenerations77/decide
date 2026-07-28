import { useState, useMemo, useRef, createElement } from 'react';
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
  const [muted, setMuted] = useState(false);
  const frameRef = useRef(null);

  if (!ad) return null;

  const canEmbed = Platform.OS === 'web' && !!ad.embed && !embedFailed;

  // The embed publishes __adSetMuted (see scripts/build-house-ad.js). Same-origin, so this is a
  // direct call rather than postMessage — no handshake to get wrong, and nothing to queue.
  // Wrapped because the frame may not have finished loading on the first tap.
  const applyMute = (next) => {
    try { frameRef.current?.contentWindow?.__adSetMuted?.(next); } catch { /* frame not ready */ }
  };

  const toggleMute = () => {
    hapticTap();
    const next = !muted;
    setMuted(next);
    applyMute(next);
  };

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

      {canEmbed ? (
        // NOT one big touchable. The mute toggle has to be pressable WITHOUT also opening the
        // trailer, and nesting it inside a card-wide TouchableOpacity makes that a fight with
        // event bubbling on web. So the frame and the caption row are separate targets.
        <View style={styles.frameCard}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={openAd}
            accessibilityRole="link"
            accessibilityLabel={`${ad.name}. ${ad.tagline}. ${ad.cta}. Opens in a new tab.`}
          >
            {/* Raw DOM iframe: react-native-web renders through react-dom, so a string tag is
                a real element here. `pointerEvents: none` is what lets the tap fall through to
                the TouchableOpacity above — without it the iframe swallows every press and the
                ad becomes unclickable. */}
            <View style={[styles.frame, { aspectRatio: ad.embedAspect ?? 16 / 9 }]}>
              {createElement('iframe', {
                src: ad.embed,
                title: `${ad.name} — preview`,
                // Without this an iframe cannot start audio at all, whatever the parent page's
                // activation state. Same-origin (served from public/), so the tap on "Build my
                // day" carries in. Where a browser still refuses, the ad plays silently — the
                // timeline is driven by rAF, not by audio.
                allow: 'autoplay',
                ref: (el) => { frameRef.current = el; },
                // Re-assert on load: a traveller who hits mute before the frame finishes
                // loading would otherwise be overruled by it starting up unmuted.
                onLoad: () => applyMute(muted),
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
          </TouchableOpacity>

          {/* "Watch with sound" was true of a silent ad and became a lie the moment this one
              got a voice. The row now carries the control that actually matters: the ad is
              talking, and the traveller needs a way to stop it that is visible without tapping
              through to anything. */}
          <View style={styles.capRow}>
            <Text style={styles.capName} numberOfLines={1}>{ad.name}</Text>
            <TouchableOpacity
              style={styles.muteBtn}
              onPress={toggleMute}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityState={{ selected: muted }}
              accessibilityLabel={muted ? 'Unmute the ad' : 'Mute the ad'}
            >
              <Ionicons
                name={muted ? 'volume-mute-outline' : 'volume-high-outline'}
                size={16}
                color={muted ? colors.textMuted : colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={openAd}
          accessibilityRole="link"
          accessibilityLabel={`${ad.name}. ${ad.tagline}. ${ad.cta}. Opens in a new tab.`}
        >
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
        </TouchableOpacity>
      )}
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
  // Icon-only and generously hit-slopped. It sits beside a name on a 3:2 card, so a labelled
  // button would crowd the row; the speaker glyph is unambiguous and carries an a11y label.
  muteBtn: { paddingHorizontal: 4, paddingVertical: 2 },

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
