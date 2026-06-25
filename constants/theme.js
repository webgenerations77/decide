// Dark charcoal-purple palette — purple as accent, neutral greys as structure
export const COLORS = {
  // Backgrounds — medium-dark charcoal with subtle purple undertone
  bg:         '#1A1826',   // matches logo outer background
  surface:    '#24223A',   // visible card surfaces
  surfaceAlt: '#141322',   // deepest layer
  // Borders — grey-purple, not vivid purple
  border:      '#333050',
  borderLight: '#3F3C60',
  // Primary CTA — vivid violet (logo accent color)
  primary:     '#8B5CF6',
  primaryDark: '#7C3AED',
  primaryText: '#FFFFFF',
  // Lavender accent — links, chips, active states
  teal:        '#A78BFA',
  tealDark:    '#8B5CF6',
  tealFaint:   '#A78BFA1A',
  // Soft lavender — section labels, highlights
  gold:        '#C9B8FF',
  goldFaint:   '#C9B8FF18',
  // Text — mostly neutral, not vivid purple
  textPrimary:   '#FFFFFF',
  textSecondary: '#A9A3C2',
  textMuted:     '#6B6680',
  // Status
  success: '#4ade80',
  error:   '#f87171',
  warning: '#fbbf24',
  // Category colors — varied for contrast
  food:     '#F472B6',   // pink-400
  activity: '#818CF8',   // indigo-400
  shopping: '#FBBF24',   // amber-400
  outdoor:  '#34D399',   // emerald-400
  // Tab bar
  tabBar: '#141322',
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
