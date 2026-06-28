// Decide design system — "We'll decide. You just go."
// Light, warm, editorial travel. Cobalt is the confident lead; orange is the
// moment of "go" (one accent per screen); gold warms the retro-travel moments;
// warm cream grounds it all so the brights never shout.
// Source of truth — no hardcoded hex in components. Derived from docs/brand/.

export const COLORS = {
  // ── Backgrounds — warm paper/cream ────────────────────────────────────────
  bg:         '#FCF9F4',   // paper — default screen background
  surface:    '#FFFFFF',   // white card surface
  surfaceAlt: '#F6F0E6',   // cream — secondary surface / grouped sections

  // ── Borders ───────────────────────────────────────────────────────────────
  border:      '#ECE2CF',  // warm hairline
  borderLight: '#E6EDFB',  // cool/sky hairline

  // ── Primary — cobalt (the confident lead) ─────────────────────────────────
  primary:     '#2563C9',  // cobalt
  primaryDark: '#1B3F86',  // cobalt deep
  primaryText: '#FFFFFF',

  // ── Accent — orange "go" + gold warmth ────────────────────────────────────
  accent:     '#FF8A3D',   // the decisive action — one per screen
  accentSoft: '#FFD9B8',   // orange 200
  gold:       '#F4B63A',   // retro-travel warmth

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
  success: '#2E9E7B',  // brand-adjacent green
  error:   '#D6453C',  // alert
  warning: '#F4B63A',  // gold

  // ── Category colors ───────────────────────────────────────────────────────
  food:     '#FF8A3D',  // orange
  activity: '#2563C9',  // cobalt
  shopping: '#F4B63A',  // gold
  outdoor:  '#2E9E7B',  // brand-adjacent green

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabBar: '#FFFFFF',

  // ── Backward-compat aliases (so existing components don't break pre-reskin) ─
  amber: '#F4B63A',   // was brass gold → now brand gold
  teal:  '#2563C9',   // was brass gold → now cobalt
};

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
