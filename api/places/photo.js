const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

// Proxies a Google Places (New) v1 photo so the API key never reaches the client.
// `name` is a photo resource name ("places/.../photos/..."). We resolve it to a
// keyless googleusercontent URL and 302-redirect, so a client <Image> can point its
// `uri` straight at this endpoint.
const PHOTO_NAME_RE = /^places\/.+\/photos\/.+/;

export default async function handler(req, res) {
  if (!GOOGLE_KEY) return res.status(500).json({ error: 'api_key_missing' });

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
