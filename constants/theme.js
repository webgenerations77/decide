// Decide design system — "We'll decide. You just go."
// Light, warm, editorial travel. Cobalt is the confident lead; orange is the
// moment of "go" (one accent per screen); gold warms the retro-travel moments;
// warm cream grounds it all so the brights never shout.
// Source of truth — no hardcoded hex in components. Derived from docs/brand/.

export const LIGHT = {
  // ── Backgrounds — warm paper/cream ────────────────────────────────────────
  bg:         '#F6EEDF',   // paper — default screen background (subtly darker so white cards pop)
  surface:    '#FFFFFF',   // white card surface
  surfaceAlt: '#ECE3D1',   // cream — secondary surface / grouped sections (stepped below the darker paper)

  // ── Borders ───────────────────────────────────────────────────────────────
  border:      '#E4D9C4',  // warm hairline (harmonized for darker paper)
  borderLight: '#E6EDFB',  // cool/sky hairline

  // ── Primary — cobalt (the confident lead) ─────────────────────────────────
  primary:     '#2563C9',  // cobalt
  primaryDark: '#1B3F86',  // cobalt deep
  primaryText: '#FFFFFF',

  // ── Accent — orange "go" + gold warmth ────────────────────────────────────
  accent:     '#FF8A3D',   // the decisive action — one per screen
  accentDark: '#E0662A',   // darker orange gradient stop (CTAButton go-gradient end)
  accentSoft: '#FFD9B8',   // orange 200
  gold:       '#F4B63A',   // retro-travel warmth — fills/borders/badges only (too light for text on paper)
  goldText:   '#8C6010',   // deep ochre — AA warm TEXT token: ~4.9:1 on paper (#F6EEDF), ~4.9:1 on gold-tint badges (gold+'22'); mostly used on white cards
  beta:       '#7C3AED',   // violet — beta-tester banner/badge (distinct from gold warning & cobalt primary; ~5.7:1 with white text)

  // ── Sky tints ─────────────────────────────────────────────────────────────
  sky100: '#E6EDFB',
  sky200: '#C9D8F4',
  sky300: '#9DB8E8',

  // ── Ink / navy — text + dark surfaces (headers, reversed lockups) ──────────
  navy: '#102A4C',
  ink:  '#16243B',

  // ── Text ──────────────────────────────────────────────────────────────────
  textPrimary:   '#16243B',  // ink
  textSecondary: '#2C3E5C',  // slate
  textMuted:     '#7E8BA3',  // muted

  // ── Status ────────────────────────────────────────────────────────────────
  success:   '#2E9E7B',  // brand-adjacent green
  error:     '#D6453C',  // alert
  errorDark: '#A8362E',  // danger-button gradient stop (darker error)
  warning:   '#F4B63A',  // gold

  // ── Category colors ───────────────────────────────────────────────────────
  food:     '#FF8A3D',  // orange
  activity: '#2563C9',  // cobalt
  shopping: '#F4B63A',  // gold
  outdoor:  '#2E9E7B',  // brand-adjacent green

  // ── Utility ───────────────────────────────────────────────────────────────
  white: '#FFFFFF',   // pure white — use for reversed/on-dark text and icons

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabBar: '#FFFFFF',

  // ── Backward-compat aliases (so existing components don't break pre-reskin) ─
  amber: '#F4B63A',   // was brass gold → now brand gold
  teal:  '#2563C9',   // was brass gold → now cobalt
};

export const DARK = {
  bg:         '#15120E',
  surface:    '#211D17',
  surfaceAlt: '#2B2620',

  border:      '#3A352B',
  borderLight: '#2A3450',

  primary:     '#4A82E0',
  primaryDark: '#2E5DB0',
  primaryText: '#FFFFFF',

  accent:     '#FF9A52',
  accentDark: '#C9551F',
  accentSoft: '#3E2C1C',
  gold:       '#F4C04A',
  goldText:   '#E6B860',
  beta:       '#9B6BF0',

  sky100: '#232C3E',
  sky200: '#2E3A52',
  sky300: '#3D4D6B',

  navy: '#0C1F38',
  ink:  '#0F1828',

  textPrimary:   '#F3EEE3',
  textSecondary: '#C7C0B2',
  textMuted:     '#8B8475',

  success:   '#3FB892',
  error:     '#FF6B61',
  errorDark: '#C9483F',
  warning:   '#F4C04A',

  food:     '#FF9A52',
  activity: '#4A82E0',
  shopping: '#F4C04A',
  outdoor:  '#3FB892',

  white: '#FFFFFF',
  tabBar: '#1C1813',

  amber: '#F4C04A',
  teal:  '#4A82E0',
};

// Back-compat default: static consumers + data-layer maps resolve to light.
export const COLORS = LIGHT;
export const PALETTES = { light: LIGHT, dark: DARK };

export const FONTS = {
  display:      'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
  body:         'HankenGrotesk_400Regular',
  bodyMedium:   'HankenGrotesk_500Medium',
  bodySemiBold: 'HankenGrotesk_600SemiBold',
  bodyBold:     'HankenGrotesk_700Bold',
  mono:         'SpaceMono_400Regular',
  monoBold:     'SpaceMono_700Bold',
};

export const RADII = { sm: 6, md: 10, lg: 24, pill: 999, icon: 42 };

export const SHADOWS = {
  card: {
    shadowColor: '#102A4C',
    shadowOpacity: 0.10,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
};

export const CATEGORY_COLORS = {
  food:     COLORS.food,
  activity: COLORS.activity,
  shopping: COLORS.shopping,
  outdoor:  COLORS.outdoor,
};

export const CATEGORY_EMOJIS = {
  food: '🍽️', activity: '🎭', shopping: '🛍️', outdoor: '🌿',
};

export const PRICE_LEGEND = [
  { symbol: '$',    label: 'Under $15/person' },
  { symbol: '$$',   label: '$15–$30/person' },
  { symbol: '$$$',  label: '$30–$60/person' },
  { symbol: '$$$$', label: '$60+/person' },
];
