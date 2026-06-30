const FIRECRAWL_KEY  = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_BASE = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
const SCRAPE_TIMEOUT_MS = 25000;
const SEARCH_TIMEOUT_MS = 20000;
const MAX_CONTENT_CHARS = 6000;

export async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function firecrawlScrape(url) {
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

export async function firecrawlSearch(query, limit = 5) {
  const res = await fetchWithTimeout(`${FIRECRAWL_BASE}/v2/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  }, SEARCH_TIMEOUT_MS);
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'search failed');
  const web = data.data?.web || data.data || [];
  return web.map((r) => ({ title: r.title || '', url: r.url || '', description: r.description || '' }));
}
