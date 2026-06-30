import { firecrawlSearch } from './firecrawl.js';

// Always-on, date/holiday-aware local-events finder. ONE web search (bounded cost).
// Returns finds with NO coords — surfaced as Local Happenings context, not map stops.
// deps.firecrawlSearch is injectable for tests. Returns [] on any failure / missing key.
export async function runEvents(ctx, deps = {}) {
  const search = deps.firecrawlSearch || firecrawlSearch;
  if (!process.env.FIRECRAWL_API_KEY) return []; // keeps offline tests/no-key builds fast
  const location = ctx.location;
  const dateISO = ctx.travelDates?.start || '';
  const when = ctx.formattedDate || dateISO;
  if (!location || !when) return [];
  const holiday = ctx.holiday || null;
  const query = holiday
    ? `${holiday} events, fireworks, parades and festivals in ${location} ${when}`
    : `local events, festivals and live entertainment in ${location} on ${when}`;
  try {
    const results = await search(query, 5);
    return (results || [])
      .filter((r) => r.url && r.title)
      .slice(0, 5)
      .map((r) => ({
        title: r.title, category: 'activity',
        interest: holiday || 'local events',
        lat: null, lng: null, address: '',
        when: dateISO, cost: '', needsTickets: false,
        url: r.url, snippet: r.description || '', sourceLabel: 'Local events',
      }));
  } catch (e) {
    console.warn('[events] failed:', e.message);
    return [];
  }
}
