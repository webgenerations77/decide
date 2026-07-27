import { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, RADII } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

// Collapsible route preview. Matches the DiscoveryAnchors disclosure pattern so the
// itinerary keeps one visual language for optional supplementary content.
//
// A STATIC map image, not an interactive map: react-native-maps has no web story and
// would need a native rebuild, whereas a static image renders identically on web and
// native with no new dependency. Tapping hands off to real Google Maps for pan/zoom.
//
// The image is proxied through /api/places/photo?type=staticmap so GOOGLE_PLACES_API_KEY
// never reaches the client (same rule as place photos).

const MAP_W = 640;
const MAP_H = 360;

export function stopsWithCoords(stops = []) {
  return stops.filter((s) => Number.isFinite(Number(s?.lat)) && Number.isFinite(Number(s?.lng)));
}

// Google caps marker labels at ONE character, so stops 10+ would collide. Beyond 9 we
// switch to unlabelled dots — the ordered list below the map carries the numbering.
function markerParams(pts) {
  const labelled = pts.length <= 9;
  return pts
    .map((p, i) => {
      const label = labelled ? `label:${i + 1}%7C` : '';
      return `markers=color:0x2563C9%7C${label}${p.lat},${p.lng}`;
    })
    .join('&');
}

export function buildStaticMapPath(stops) {
  const pts = stopsWithCoords(stops).map((s) => ({ lat: Number(s.lat), lng: Number(s.lng) }));
  if (pts.length === 0) return null;
  const path = `path=color:0x2563C980%7Cweight:3%7C${pts.map((p) => `${p.lat},${p.lng}`).join('%7C')}`;
  // No center/zoom — Google auto-fits the viewport to the markers and path.
  return `/api/places/photo?type=staticmap&size=${MAP_W}x${MAP_H}&scale=2&${markerParams(pts)}&${path}`;
}

// Multi-stop Google Maps directions: first stop is origin, last is destination,
// everything between becomes a waypoint.
export function buildDirectionsUrl(stops) {
  const pts = stopsWithCoords(stops);
  if (pts.length === 0) return null;
  const coord = (s) => `${s.lat},${s.lng}`;
  const origin = coord(pts[0]);
  const destination = coord(pts[pts.length - 1]);
  const waypoints = pts.slice(1, -1).map(coord).join('|');
  const params = [
    'api=1',
    `origin=${encodeURIComponent(origin)}`,
    `destination=${encodeURIComponent(destination)}`,
    waypoints ? `waypoints=${encodeURIComponent(waypoints)}` : '',
    'travelmode=driving',
  ].filter(Boolean);
  return `https://www.google.com/maps/dir/?${params.join('&')}`;
}

export default function RouteMap({ stops = [] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const mapped = useMemo(() => stopsWithCoords(stops), [stops]);
  const src = useMemo(() => buildStaticMapPath(stops), [stops]);
  const dirUrl = useMemo(() => buildDirectionsUrl(stops), [stops]);

  // Nothing to plot, or a single point with no route to show.
  if (mapped.length < 2 || !src) return null;

  const dropped = stops.length - mapped.length;
  const openDirections = () => { if (dirUrl) Linking.openURL(dirUrl).catch(() => {}); };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded((e) => !e)} activeOpacity={0.7}>
        <Text style={styles.headerText}>🗺 The route ({mapped.length} stops)</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {failed ? (
            <Text style={styles.failText}>Map preview unavailable right now.</Text>
          ) : (
            <TouchableOpacity activeOpacity={0.85} onPress={openDirections} style={styles.mapWrap}>
              <Image
                source={{ uri: src }}
                style={styles.map}
                resizeMode="cover"
                onLoadEnd={() => setLoading(false)}
                onError={() => { setLoading(false); setFailed(true); }}
                accessibilityLabel={`Map showing ${mapped.length} stops in order`}
              />
              {loading && (
                <View style={styles.mapLoading}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          )}

          {mapped.length > 9 && (
            <Text style={styles.note}>
              Markers aren't numbered past 9 — the order below still applies.
            </Text>
          )}
          {dropped > 0 && (
            <Text style={styles.note}>
              {dropped} stop{dropped === 1 ? '' : 's'} had no location and {dropped === 1 ? 'is' : 'are'} not shown.
            </Text>
          )}

          <TouchableOpacity onPress={openDirections} style={styles.dirBtn} activeOpacity={0.7}>
            <Ionicons name="navigate-outline" size={15} color={colors.primary} />
            <Text style={styles.dirText}>Open the whole day in Google Maps</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap:       { marginTop: 10, alignSelf: 'stretch' },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  headerText: { color: c.primary, fontSize: 12, fontFamily: FONTS.bodySemiBold, fontStyle: 'italic' },
  body: {
    marginTop: 10, gap: 8,
    backgroundColor: c.surfaceAlt, borderRadius: RADII.md,
    borderWidth: 1, borderColor: c.border, padding: 12,
  },
  mapWrap: {
    borderRadius: RADII.sm, overflow: 'hidden',
    borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
  },
  // Fixed aspect ratio matches the requested image size, so the card doesn't
  // reflow when the image finally loads.
  map:        { width: '100%', aspectRatio: MAP_W / MAP_H },
  mapLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  note:       { fontSize: 11, color: c.textMuted, fontFamily: FONTS.body, textAlign: 'center' },
  failText:   { fontSize: 12, color: c.textMuted, fontFamily: FONTS.body, textAlign: 'center', paddingVertical: 12 },
  dirBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 4 },
  dirText:    { fontSize: 13, color: c.primary, fontFamily: FONTS.bodySemiBold },
});
