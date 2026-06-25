const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q   = searchParams.get('q');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!GOOGLE_KEY) {
    return Response.json({ error: 'api_key_missing' }, { status: 500 });
  }

  // ── Reverse geocode: lat/lng → city, state ──────────────────────────────
  if (lat && lng) {
    try {
      const res  = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`
      );
      const data = await res.json();
      if (data.status === 'REQUEST_DENIED' || data.status === 'INVALID_REQUEST') {
        return Response.json({ error: data.status, message: data.error_message }, { status: 400 });
      }
      if (!data.results?.length) {
        return Response.json({ label: null });
      }
      const parts = data.results[0].address_components;
      const get   = (t) => parts.find((c) => c.types.includes(t));
      const hood  = get('neighborhood')?.long_name || get('sublocality')?.long_name;
      const city  = get('locality')?.long_name;
      const state = get('administrative_area_level_1')?.short_name;
      const place = hood || city;
      const label = place && state ? `${place}, ${state}`
                  : place          ? place
                  : state          ? state
                  : null;
      return Response.json({ label, city, state });
    } catch (err) {
      return Response.json({ error: 'network', message: err.message }, { status: 500 });
    }
  }

  // ── Forward search: text → suggestions with coordinates ─────────────────
  if (q && q.length >= 3) {
    try {
      // Use Places Autocomplete (same API family as Nearby Search — reliably enabled)
      const acRes  = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=(cities)&language=en&key=${GOOGLE_KEY}`
      );
      const acData = await acRes.json();

      if (acData.status === 'REQUEST_DENIED') {
        return Response.json({ error: 'api_key', message: acData.error_message }, { status: 400 });
      }
      if (!acData.predictions?.length) {
        return Response.json({ results: [] });
      }

      // Fetch coordinates for each prediction via Place Details
      const results = await Promise.all(
        acData.predictions.slice(0, 5).map(async (p) => {
          try {
            const detailRes  = await fetch(
              `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=geometry,address_components,formatted_address&key=${GOOGLE_KEY}`
            );
            const detailData = await detailRes.json();
            const r          = detailData.result;
            if (!r?.geometry?.location) return null;

            const parts = r.address_components ?? [];
            const get   = (t) => parts.find((c) => c.types.includes(t));
            const city  = get('locality')?.long_name ?? get('sublocality')?.long_name ?? get('postal_town')?.long_name;
            const state = get('administrative_area_level_1')?.short_name;
            const short = city && state ? `${city}, ${state}`
                        : r.formatted_address?.split(',').slice(0, 2).join(',').trim();

            return {
              label:     p.description,
              short,
              latitude:  r.geometry.location.lat,
              longitude: r.geometry.location.lng,
            };
          } catch {
            return null;
          }
        })
      );

      return Response.json({ results: results.filter(Boolean) });
    } catch (err) {
      return Response.json({ error: 'network', message: err.message }, { status: 500 });
    }
  }

  return Response.json({ error: 'bad_request' }, { status: 400 });
}
