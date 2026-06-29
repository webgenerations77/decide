const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export default async function handler(req, res) {
  const q   = req.query.q;
  const lat = req.query.lat;
  const lng = req.query.lng;

  if (!GOOGLE_KEY) {
    return res.status(500).json({ error: 'api_key_missing' });
  }

  // ── Reverse geocode: lat/lng → city, state ──────────────────────────────
  if (lat && lng) {
    try {
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`
      );
      const data = await r.json();
      if (data.status === 'REQUEST_DENIED' || data.status === 'INVALID_REQUEST') {
        return res.status(400).json({ error: data.status, message: data.error_message });
      }
      if (!data.results?.length) {
        return res.json({ label: null });
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
      return res.json({ label, city, state });
    } catch (err) {
      return res.status(500).json({ error: 'network', message: err.message });
    }
  }

  // ── Forward search: text → suggestions with coordinates ─────────────────
  if (q && q.length >= 3) {
    try {
      const acRes  = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=(cities)&language=en&key=${GOOGLE_KEY}`
      );
      const acData = await acRes.json();
      if (acData.status === 'REQUEST_DENIED') {
        return res.status(400).json({ error: 'api_key', message: acData.error_message });
      }
      if (!acData.predictions?.length) {
        return res.json({ results: [] });
      }
      const results = await Promise.all(
        acData.predictions.slice(0, 5).map(async (p) => {
          try {
            const detailRes  = await fetch(
              `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=geometry,address_components,formatted_address&key=${GOOGLE_KEY}`
            );
            const detailData = await detailRes.json();
            const r2         = detailData.result;
            if (!r2?.geometry?.location) return null;
            const parts = r2.address_components ?? [];
            const get   = (t) => parts.find((c) => c.types.includes(t));
            const city  = get('locality')?.long_name ?? get('sublocality')?.long_name ?? get('postal_town')?.long_name;
            const state = get('administrative_area_level_1')?.short_name;
            const short = city && state ? `${city}, ${state}`
                        : r2.formatted_address?.split(',').slice(0, 2).join(',').trim();
            return {
              label:     p.description,
              short,
              latitude:  r2.geometry.location.lat,
              longitude: r2.geometry.location.lng,
            };
          } catch {
            return null;
          }
        })
      );
      return res.json({ results: results.filter(Boolean) });
    } catch (err) {
      return res.status(500).json({ error: 'network', message: err.message });
    }
  }

  return res.status(400).json({ error: 'bad_request' });
}
