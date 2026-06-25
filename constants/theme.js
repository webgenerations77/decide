// Purple palette derived from the Decide logo
export const COLORS = {
  // Backgrounds
  bg:         '#0D0720',   // deep purple-black (logo background)
  surface:    '#1A0A38',   // dark purple surface
  surfaceAlt: '#0A0416',   // deepest layer
  // Borders
  border:      '#2D1660',
  borderLight: '#3D2278',
  // Primary CTA — vivid violet
  primary:     '#8B5CF6',
  primaryDark: '#7C3AED',
  primaryText: '#FFFFFF',
  // Bright lavender accent — links, chips, active states
  teal:        '#C084FC',
  tealDark:    '#A855F7',
  tealFaint:   '#C084FC22',
  // Soft lavender — section headers, labels, highlights
  gold:        '#DDD6FE',
  goldFaint:   '#DDD6FE22',
  // Text
  textPrimary:   '#FFFFFF',
  textSecondary: '#C4B5FD',  // violet-300
  textMuted:     '#7C5FAA',
  // Status
  success: '#4ade80',
  error:   '#f87171',
  warning: '#fbbf24',
  // Category colors
  food:     '#F472B6',   // pink-400
  activity: '#818CF8',   // indigo-400
  shopping: '#FBBF24',   // amber-400
  outdoor:  '#34D399',   // emerald-400
  // Tab bar
  tabBar: '#0A0416',
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
