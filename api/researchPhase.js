import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Live Intelligence Research Phase
//
// Fires before every itinerary generation. Pulls current events, live
// entertainment, convention listings, and restaurant specials from real web
// sources via the Firecrawl REST API (api.firecrawl.dev), then summarizes the
// raw content into a clean structured payload that gets injected into Cheddar's
// itinerary prompt.
//
// NOTE: this runs inside a deployed serverless function, so it must use the
// Firecrawl HTTP API (not the MCP server or CLI, which only exist in the dev
// session). Requires FIRECRAWL_API_KEY in the environment.
// ---------------------------------------------------------------------------

const FIRECRAWL_KEY  = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_BASE = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';

const RESEARCH_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const SCRAPE_TIMEOUT_MS  = 25000;              // per-source ceiling
const SEARCH_TIMEOUT_MS  = 20000;
const MAX_CONTENT_CHARS  = 6000;               // truncate each source before summarizing
const SEARCH_RESULT_LIMIT = 5;

// ---------------------------------------------------------------------------
// Geography-configurable source registry (TASK 5)
//
// Maps fuzzy, case-insensitive geography keys to their high-value scrape URLs.
// Locations that don't match any key fall back to web search only (no scrapes).
// The DE/MD beach corridor is the reference implementation.
// ---------------------------------------------------------------------------

// Priority 1 scrapes for the Delaware/Maryland beach corridor — always run.
const BEACH_CORRIDOR_SOURCES = [
  { label: 'Beach Fun & Bargains',  url: 'https://www.beach-fun.com/events/beach-fun-bargains.html' },
  { label: 'Seacrets Calendar',     url: 'https://seacrets.com/calendar/' },
  { label: 'OC Convention Center',  url: 'https://www.ococean.com/convention-center/attend/events/' },
  { label: 'OceanCity.com Events',  url: 'https://www.oceancity.com/events/' },
  { label: 'Rehoboth Events',       url: 'https://www.rehoboth.com/events-a-activities/calendar-of-events.html' },
];

const researchSources = {
  'ocean city md':   BEACH_CORRIDOR_SOURCES,
  'ocean city':      BEACH_CORRIDOR_SOURCES,
  'rehoboth beach':  BEACH_CORRIDOR_SOURCES,
  'rehoboth':        BEACH_CORRIDOR_SOURCES,
  'dewey beach':     BEACH_CORRIDOR_SOURCES,
  'bethany beach':   BEACH_CORRIDOR_SOURCES,
  'fenwick island':  BEACH_CORRIDOR_SOURCES,
  'lewes':           BEACH_CORRIDOR_SOURCES,
  'default':         [], // falls back to web search only
  // Add new geography URL sets here as the app expands
};

// Fuzzy, case-insensitive match of a location string to a source set.
function selectSources(location) {
  const norm = (location || '').toLowerCase().trim();
  if (!norm) return researchSources.default;
  for (const key of Object.keys(researchSources)) {
    if (key === 'default') continue;
    if (norm.includes(key) || key.includes(norm)) return researchSources[key];
  }
  return researchSources.default;
}

// ---------------------------------------------------------------------------
// 4-hour in-memory cache, keyed by location string
// ---------------------------------------------------------------------------

const researchCache = new Map();

function cacheGet(key) {
  const entry = researchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > RESEARCH_CACHE_TTL) { researchCache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key, data) { researchCache.set(key, { data, ts: Date.now() }); }

// ---------------------------------------------------------------------------
// Firecrawl REST helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function firecrawlScrape(url) {
  const res = await fetchWithTimeout(`${FIRECRAWL_BASE}/v2/scrape`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true, timeout: SCRAPE_TIMEOUT_MS }),
  }, SCRAPE_TIMEOUT_MS + 2000);
  if (!res.ok) throw new Error(`scrape HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'scrape failed');
  return (data.data?.markdown || '').slice(0, MAX_CONTENT_CHARS);
}

async function firecrawlSearch(query) {
  const res = await fetchWithTimeout(`${FIRECRAWL_BASE}/v2/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit: SEARCH_RESULT_LIMIT }),
  }, SEARCH_TIMEOUT_MS);
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'search failed');
  const web = data.data?.web || data.data || [];
  return web
    .map((r) => `- ${r.title || ''}: ${r.description || ''} (${r.url || ''})`)
    .join('\n')
    .slice(0, MAX_CONTENT_CHARS);
}

// Scrape a source; on any failure fall back to a web search for that source.
async function scrapeWithSearchFallback(source, location) {
  try {
    const content = await firecrawlScrape(source.url);
    if (content && content.trim()) return { label: source.label, via: 'scrape', content };
    throw new Error('empty scrape');
  } catch (err) {
    console.warn(`[research] scrape failed for ${source.label} (${err.message}) — falling back to search`);
    try {
      const content = await firecrawlSearch(`${source.label} ${location} events schedule`);
      if (content && content.trim()) return { label: source.label, via: 'search-fallback', content };
    } catch (err2) {
      console.warn(`[research] search fallback also failed for ${source.label}: ${err2.message}`);
    }
    return null;
  }
}

async function safeSearch(query) {
  try {
    const content = await firecrawlSearch(query);
    if (content && content.trim()) return { label: query, via: 'search', content };
  } catch (err) {
    console.warn(`[research] search failed for "${query}": ${err.message}`);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

function buildSearchQueries(location, travelDates) {
  const start = travelDates?.start ? new Date(travelDates.start) : new Date();
  const month   = start.toLocaleString('en-US', { month: 'long' });
  const year    = start.getFullYear();
  const dateStr = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return [
    `"${location}" restaurant specials live music ${month} ${year}`,
    `"${location}" events this week ${dateStr}`,
    `new movies playing near "${location}" ${dateStr}`,
    `"${location}" bar entertainment schedule ${month}`,
  ];
}

// ---------------------------------------------------------------------------
// Summarization step — turn raw scraped/search content into clean structured
// JSON filtered to the user's travel window. Never returns raw HTML/markdown.
// ---------------------------------------------------------------------------

const EMPTY_SUMMARY = { events: [], specials: [], notes: '' };

async function summarizeResearch(blocks, location, travelDates, userContext) {
  const windowStr = travelDates?.start
    ? `${travelDates.start}${travelDates.end && travelDates.end !== travelDates.start ? ` to ${travelDates.end}` : ''}`
    : 'the upcoming days';

  const corpus = blocks
    .map((b) => `### SOURCE: ${b.label} (via ${b.via})\n${b.content}`)
    .join('\n\n')
    .slice(0, 24000);

  const system = 'You are a local-events research analyst. You receive raw scraped web content and must extract only real, time-sensitive events, specials, and entertainment relevant to a traveler. Return ONLY a valid JSON object — no prose, no markdown fences.';

  const user = `Location: ${location}
Travel window: ${windowStr}
Traveler context: ${JSON.stringify(userContext || {})}

From the raw sources below, extract events, live entertainment, and specials that fall within (or plausibly overlap) the travel window. Discard anything clearly outside the window, navigation/boilerplate text, or items with no date relevance.

Return a JSON object with this exact shape:
{
  "events":   [{ "name": "", "date": "", "time": "", "location": "", "cost": "", "why_timesensitive": "", "needs_tickets": false, "source": "" }],
  "specials": [{ "name": "", "date": "", "location": "", "cost": "", "why_timesensitive": "", "source": "" }],
  "notes": ""
}

Rules:
- Only include items you can actually find evidence for in the sources. Do NOT invent events.
- Prefer items inside the travel window. If a date is ambiguous but the item is clearly recurring/current, include it and say so in why_timesensitive.
- Set needs_tickets true only when advance tickets/reservations are clearly implied.
- Keep each field concise. Empty arrays are fine if nothing qualifies.

RAW SOURCES:
${corpus}`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const raw = message.content[0]?.text ?? '{}';
    const jsonText = raw.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim() ?? raw.trim();
    const parsed = JSON.parse(jsonText);
    return {
      events:   Array.isArray(parsed.events) ? parsed.events : [],
      specials: Array.isArray(parsed.specials) ? parsed.specials : [],
      notes:    typeof parsed.notes === 'string' ? parsed.notes : '',
    };
  } catch (err) {
    console.warn('[research] summarization failed:', err.message);
    return EMPTY_SUMMARY;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function emptyResult(reason) {
  return { hadLiveData: false, reason, summary: EMPTY_SUMMARY, sourcesUsed: [], cached: false };
}

/**
 * Run the live research phase for a location and travel window.
 * Never throws — research failure must never block itinerary generation.
 *
 * @param {{ location: string, travelDates: { start: string, end: string }, userContext?: object }} args
 * @returns {Promise<{ hadLiveData: boolean, summary: object, sourcesUsed: string[], cached: boolean, reason?: string }>}
 */
export async function runResearchPhase({ location, travelDates, userContext = {} }) {
  try {
    const cacheKey = (location || '').toLowerCase().trim() || 'unknown';
    const cached = cacheGet(cacheKey);
    if (cached) {
      console.log(`[research] cache hit for "${cacheKey}"`);
      return { ...cached, cached: true };
    }

    if (!FIRECRAWL_KEY) return emptyResult('FIRECRAWL_API_KEY not configured');

    const sources = selectSources(location);
    const queries = buildSearchQueries(location, travelDates);

    // Fire scrapes (with per-source search fallback) and web searches in parallel.
    const [scrapeResults, searchResults] = await Promise.all([
      Promise.all(sources.map((s) => scrapeWithSearchFallback(s, location))),
      Promise.all(queries.map((q) => safeSearch(q))),
    ]);

    const blocks = [...scrapeResults, ...searchResults].filter(Boolean);
    if (blocks.length === 0) return emptyResult('All live sources failed or returned nothing');

    const summary = await summarizeResearch(blocks, location, travelDates, userContext);
    const hadLiveData = summary.events.length > 0 || summary.specials.length > 0;

    const result = {
      hadLiveData,
      summary,
      sourcesUsed: blocks.map((b) => `${b.label} (${b.via})`),
      cached: false,
      reason: hadLiveData ? undefined : 'Sources scraped but no in-window events found',
    };
    cacheSet(cacheKey, result);
    return result;
  } catch (err) {
    console.error('[research] unexpected error:', err.message);
    return emptyResult(`unexpected error: ${err.message}`);
  }
}

/**
 * Render a research result into a readable text block for prompt injection.
 * Returns null when there's nothing useful to inject.
 */
export function formatResearchSummary(result) {
  if (!result || !result.hadLiveData) return null;
  const { events = [], specials = [] } = result.summary || {};
  const lines = [];

  if (events.length) {
    lines.push('Events & entertainment:');
    for (const e of events) {
      const bits = [e.name, e.date && `— ${e.date}`, e.time && `at ${e.time}`, e.location && `@ ${e.location}`]
        .filter(Boolean).join(' ');
      const tags = [e.cost && `cost: ${e.cost}`, e.needs_tickets && 'ADVANCE TICKETS/RESERVATION', e.why_timesensitive]
        .filter(Boolean).join(' · ');
      lines.push(`- ${bits}${tags ? ` (${tags})` : ''}`);
    }
  }

  if (specials.length) {
    lines.push('Specials & deals:');
    for (const s of specials) {
      const bits = [s.name, s.date && `— ${s.date}`, s.location && `@ ${s.location}`].filter(Boolean).join(' ');
      const tags = [s.cost && `cost: ${s.cost}`, s.why_timesensitive].filter(Boolean).join(' · ');
      lines.push(`- ${bits}${tags ? ` (${tags})` : ''}`);
    }
  }

  return lines.length ? lines.join('\n') : null;
}
