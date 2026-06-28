// Cheddar design system — warm travel palette
// Signature: espresso dark backgrounds (not cold navy) + terracotta + golden amber

export const COLORS = {
  // ── Backgrounds — warm espresso dark ──────────────────────────────────────
  bg:         '#1A120B',   // deep espresso (signature: warm not cold)
  surface:    '#261A12',   // warm card surface
  surfaceAlt: '#1F1511',   // deeper warm surface

  // ── Borders — earthy ──────────────────────────────────────────────────────
  border:      '#3B2A1E',
  borderLight: '#4E3828',

  // ── Primary — terracotta ──────────────────────────────────────────────────
  primary:     '#C85C30',  // warm terracotta
  primaryDark: '#A8481F',
  primaryText: '#FFF8F0',  // warm cream white

  // ── Amber accent — golden hour ────────────────────────────────────────────
  amber:       '#D4913A',  // golden amber
  amberDark:   '#B07829',
  amberFaint:  '#D4913A18',

  // ── Text — warm tones ─────────────────────────────────────────────────────
  textPrimary:   '#F5E8D8',  // warm cream (not cold white)
  textSecondary: '#B8967A',  // warm taupe
  textMuted:     '#9A7860',  // warm muted

  // ── Status ────────────────────────────────────────────────────────────────
  success: '#5BA85A',
  error:   '#E86060',
  warning: '#D4913A',  // amber — doubles as warning

  // ── Category colors ───────────────────────────────────────────────────────
  food:     '#C85C30',  // terracotta
  activity: '#D4913A',  // amber
  shopping: '#8A7060',  // warm tan
  outdoor:  '#5F8A56',  // sage green

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabBar: '#150E08',   // deepest espresso

  // ── Backward-compat alias (used in a few places as COLORS.teal) ───────────
  teal: '#D4913A',   // mapped to amber — remove after full token sweep
  gold: '#D4913A',   // mapped to amber
};

export const FONTS = {
  display:     'PlayfairDisplay_700Bold',
  displayHeavy:'PlayfairDisplay_800ExtraBold',
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
