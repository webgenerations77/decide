const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

const ENDPOINT = 'https://maps.googleapis.com/maps/api/staticmap';

// Unlike the Places photo proxy we CANNOT 302-redirect here: the Static Maps API takes
// the key as a query param and returns image bytes directly, so redirecting would hand
// the key to the client. We fetch server-side and stream the bytes back instead.
//
// Only these params are forwarded. This is a whitelist, not a passthrough — an open
// image proxy would let anyone burn the project's Static Maps quota.
const SIMPLE = {
  size:    /^\d{2,4}x\d{2,4}$/,
  scale:   /^[12]$/,
  maptype: /^(roadmap|terrain)$/,
  format:  /^(png|png8|png32|jpg)$/,
};
// markers/path carry coordinates and styling: digits, signs, separators, and
// `color:0xRRGGBBAA` / `label:N` / `weight:N` tokens. Nothing else.
const GEOM = /^[A-Za-z0-9_:|,.\-+%x]+$/;

const MAX_GEOM_LEN = 2000;
const MAX_GEOM_PARTS = 30;

export function buildStaticMapUrl(get, getAll) {
  const out = [];

  for (const [key, re] of Object.entries(SIMPLE)) {
    const v = get(key);
    if (v == null || v === '') continue;
    if (!re.test(v)) return { error: `invalid_${key}` };
    out.push(`${key}=${encodeURIComponent(v)}`);
  }

  let geomCount = 0;
  for (const key of ['markers', 'path']) {
    for (const v of getAll(key) || []) {
      if (!v) continue;
      if (++geomCount > MAX_GEOM_PARTS) return { error: 'too_many_parts' };
      if (v.length > MAX_GEOM_LEN || !GEOM.test(v)) return { error: `invalid_${key}` };
      out.push(`${key}=${encodeURIComponent(v)}`);
    }
  }

  // Without at least one marker or path there is nothing to render, and no
  // center/zoom is supplied by design (Google auto-fits to the geometry).
  if (geomCount === 0) return { error: 'no_geometry' };

  return { url: `${ENDPOINT}?${out.join('&')}&key=${GOOGLE_KEY}` };
}

// Returns { ok:true, contentType, body:ArrayBuffer } or { ok:false, status, error }.
export async function fetchStaticMap(get, getAll) {
  if (!GOOGLE_KEY) return { ok: false, status: 500, error: 'api_key_missing' };

  const built = buildStaticMapUrl(get, getAll);
  if (built.error) return { ok: false, status: 400, error: built.error };

  try {
    const r = await fetch(built.url);
    if (!r.ok) {
      // Google returns 403 with a text body when Static Maps isn't enabled on the key —
      // surface that distinctly so it isn't mistaken for a bad request.
      const detail = await r.text().catch(() => '');
      return { ok: false, status: 502, error: 'staticmap_failed', message: detail.slice(0, 200) };
    }
    return {
      ok: true,
      contentType: r.headers.get('content-type') || 'image/png',
      body: await r.arrayBuffer(),
    };
  } catch (e) {
    return { ok: false, status: 502, error: 'staticmap_failed', message: e.message };
  }
}
