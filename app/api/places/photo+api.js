const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

// Proxies a Google Places (New) v1 photo so the API key never reaches the client.
// `name` is a photo resource name ("places/.../photos/..."). We resolve it to a
// keyless googleusercontent URL and 302-redirect, so a client <Image> can point its
// `uri` straight at this endpoint.
const PHOTO_NAME_RE = /^places\/.+\/photos\/.+/;

export async function GET(request) {
  if (!GOOGLE_KEY) return Response.json({ error: 'api_key_missing' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  if (!name || !PHOTO_NAME_RE.test(name)) return Response.json({ error: 'invalid_name' }, { status: 400 });

  let maxWidth = parseInt(searchParams.get('maxWidth'), 10) || 800;
  maxWidth = Math.min(Math.max(maxWidth, 100), 1600);

  try {
    const r = await fetch(
      `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxWidth}&skipHttpRedirect=true&key=${GOOGLE_KEY}`,
    );
    const data = await r.json();
    const uri = data?.photoUri;
    if (!r.ok || !uri) return Response.json({ error: 'no_photo' }, { status: 404 });
    return Response.redirect(uri, 302);
  } catch (e) {
    return Response.json({ error: 'no_photo', message: e.message }, { status: 404 });
  }
}
