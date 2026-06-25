// Travel-oriented color palette — warm sandy tones, deep ocean blues, sunset corals
export const COLORS = {
  // Backgrounds
  bg:         '#0C1A2E',   // deep ocean night
  surface:    '#142540',   // midnight ocean
  surfaceAlt: '#0A1423',   // deepest layer
  // Borders
  border:      '#1E3A5A',
  borderLight: '#233F60',
  // Primary CTA — sunset coral/orange
  primary:     '#FF6B35',
  primaryDark: '#CC5520',
  primaryText: '#FFFFFF',  // text on primary buttons
  // Tropical teal accent (replaces old #00d2be)
  teal:        '#00BFB3',
  tealDark:    '#009E98',
  tealFaint:   '#00BFB322',
  // Sandy gold — section headers, budget, highlights
  gold:        '#C9964E',
  goldFaint:   '#C9964E22',
  // Text
  textPrimary:   '#FFFFFF',
  textSecondary: '#8AACBF',
  textMuted:     '#4A7090',
  // Status
  success: '#4ade80',
  error:   '#f87171',
  warning: '#fbbf24',
  // Category colors
  food:     '#FF6B35',
  activity: '#00BFB3',
  shopping: '#C9964E',
  outdoor:  '#5BBFDC',
  // Tab bar
  tabBar: '#0A1423',
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
