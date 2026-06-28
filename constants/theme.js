// Cheddar design system — American travel palette
// Midnight navy + brass gold + star-spangled blue. Prestigious, trustworthy, distinctly American.

export const COLORS = {
  // ── Backgrounds — midnight navy ───────────────────────────────────────────
  bg:         '#0B1929',   // deep midnight navy
  surface:    '#132234',   // navy card surface
  surfaceAlt: '#0D1C2B',   // deeper navy

  // ── Borders — cool navy ───────────────────────────────────────────────────
  border:      '#1E3558',
  borderLight: '#2A4A72',

  // ── Primary — star-spangled blue ─────────────────────────────────────────
  primary:     '#1E5FA8',  // confident American blue
  primaryDark: '#164A88',
  primaryText: '#EFF5FD',  // cool white

  // ── Brass gold accent — eagle & seal ─────────────────────────────────────
  amber:       '#C8963A',  // American brass gold
  amberDark:   '#A67928',
  amberFaint:  '#C8963A1A',

  // ── Text — cool American ──────────────────────────────────────────────────
  textPrimary:   '#EFF5FD',  // bright clean white
  textSecondary: '#7FA8CC',  // sky blue-gray
  textMuted:     '#4A7090',  // muted navy

  // ── Status ────────────────────────────────────────────────────────────────
  success: '#4A9A68',
  error:   '#C04040',
  warning: '#C8963A',  // brass gold doubles as warning

  // ── Category colors ───────────────────────────────────────────────────────
  food:     '#C8963A',  // brass gold — warm, inviting
  activity: '#4A90D9',  // sky blue — open sky, freedom
  shopping: '#7A7090',  // muted slate
  outdoor:  '#4A8A60',  // national parks green

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabBar: '#080F1A',   // deepest navy

  // ── Backward-compat aliases ───────────────────────────────────────────────
  teal: '#C8963A',   // mapped to brass gold
  gold: '#C8963A',   // mapped to brass gold
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
