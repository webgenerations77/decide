// Maps a free-form AI-generated `category` string to a distinct { icon, color }.
// Pure module (no React) — used by StopCard, PlaceDetailModal, and history.js, and
// must also work for already-saved itineraries in history with older/odd category strings.
import { COLORS } from './theme';

const DEFAULT = { icon: 'location', color: COLORS.textMuted };

// Ordered — first match wins; put more specific rows before generic ones.
// Each row: match if the normalized category EQUALS or CONTAINS any key.
const ROWS = [
  { keys: ['cafe', 'coffee', 'bakery', 'dessert', 'ice cream'],                          icon: 'cafe',           color: COLORS.food },
  { keys: ['food', 'dining', 'restaurant', 'eat', 'lunch', 'dinner', 'breakfast', 'brunch', 'meal', 'seafood'], icon: 'restaurant', color: COLORS.food },
  { keys: ['beach', 'water', 'surf', 'ocean', 'lake', 'swim', 'boat', 'kayak', 'paddle', 'marina'], icon: 'water',   color: COLORS.primary },
  { keys: ['hike', 'hiking', 'trail', 'walk'],                                          icon: 'walk',           color: COLORS.outdoor },
  { keys: ['outdoor', 'nature', 'park', 'garden', 'scenic', 'wildlife', 'forest'],       icon: 'leaf',           color: COLORS.outdoor },
  { keys: ['shopping', 'shop', 'market', 'boutique', 'store', 'mall', 'retail'],         icon: 'bag-handle',     color: COLORS.shopping },
  { keys: ['nightlife', 'bar', 'club', 'pub', 'brewery', 'lounge'],                      icon: 'wine',           color: COLORS.beta },
  { keys: ['music', 'live music', 'concert', 'dance', 'festival'],                       icon: 'musical-notes',  color: COLORS.beta },
  { keys: ['theater', 'theatre', 'movie', 'cinema', 'film', 'comedy', 'show', 'entertainment'], icon: 'film',    color: COLORS.beta },
  { keys: ['arts', 'art', 'culture', 'gallery', 'museum', 'exhibit'],                    icon: 'color-palette',  color: COLORS.beta },
  { keys: ['spa', 'wellness', 'relax', 'massage', 'yoga', 'sauna'],                      icon: 'flower',         color: COLORS.beta },
  { keys: ['sports', 'sport', 'recreation', 'fitness', 'gym', 'bike', 'cycling', 'golf', 'tennis', 'athletic'], icon: 'fitness', color: COLORS.success },
  { keys: ['attraction', 'sightseeing', 'landmark', 'tour', 'historic', 'monument', 'sight'], icon: 'camera',    color: COLORS.navy },
  { keys: ['activity', 'fun', 'experience', 'things to do', 'adventure'],                icon: 'sparkles',       color: COLORS.primary },
];

export function categoryVisual(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return DEFAULT;
  for (const row of ROWS) {
    if (row.keys.some((k) => s === k || s.includes(k))) return { icon: row.icon, color: row.color };
  }
  return DEFAULT;
}
