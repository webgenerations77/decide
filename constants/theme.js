export const COLORS = {
  // Backgrounds — deep navy
  bg:         '#0C1A2E',
  surface:    '#142540',
  surfaceAlt: '#0A1423',
  // Borders
  border:      '#1E3A5A',
  borderLight: '#2A4F78',
  // Primary CTA — orange
  primary:     '#FF6B35',
  primaryDark: '#E85A24',
  primaryText: '#FFFFFF',
  // Teal accent
  teal:        '#00BFB3',
  tealDark:    '#009E93',
  tealFaint:   '#00BFB31A',
  // Gold
  gold:        '#C9964E',
  goldFaint:   '#C9964E18',
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
