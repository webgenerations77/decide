import { fetchStaticMap } from '../../lib/staticMap.js';

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

// Proxies a Google Places (New) v1 photo so the API key never reaches the client.
// `name` is a photo resource name ("places/.../photos/..."). We resolve it to a
// keyless googleusercontent URL and 302-redirect, so a client <Image> can point its
// `uri` straight at this endpoint.
const PHOTO_NAME_RE = /^places\/.+\/photos\/.+/;

export default async function handler(req, res) {
  if (!GOOGLE_KEY) return res.status(500).json({ error: 'api_key_missing' });

  // ?type=staticmap → itinerary route map. Folded onto this endpoint (rather than a new
  // api/ file) to stay under Vercel's 12-function cap; see CLAUDE.md.
  if (req.query.type === 'staticmap') {
    // req.query values are string | string[]; markers/path repeat, so normalize to arrays.
    const getAll = (k) => (Array.isArray(req.query[k]) ? req.query[k] : req.query[k] ? [req.query[k]] : []);
    const get = (k) => (Array.isArray(req.query[k]) ? req.query[k][0] : req.query[k]);
    const r = await fetchStaticMap(get, getAll);
    if (!r.ok) return res.status(r.status).json({ error: r.error, message: r.message });
    res.setHeader('Content-Type', r.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(Buffer.from(r.body));
  }

  const name = req.query.name;
  if (!name || !PHOTO_NAME_RE.test(name)) return res.status(400).json({ error: 'invalid_name' });

  let maxWidth = parseInt(req.query.maxWidth, 10) || 800;
  maxWidth = Math.min(Math.max(maxWidth, 100), 1600);

  try {
    const r = await fetch(
      `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxWidth}&skipHttpRedirect=true&key=${GOOGLE_KEY}`,
    );
    const data = await r.json();
    const uri = data?.photoUri;
    if (!r.ok || !uri) return res.status(404).json({ error: 'no_photo' });
    return res.redirect(302, uri);
  } catch (e) {
    return res.status(404).json({ error: 'no_photo', message: e.message });
  }
}
