import { logUsage } from '../usageLog.js';
import { markFirecrawlDegraded } from '../usageContext.js';

const FIRECRAWL_KEY  = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_BASE = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
const SCRAPE_TIMEOUT_MS = 25000;
const SEARCH_TIMEOUT_MS = 20000;
const MAX_CONTENT_CHARS = 6000;

/**
 * Running out of Firecrawl is INVISIBLE without this.
 *
 * Every caller of this module catches and returns [] — deliberately, because live research must
 * never be the reason a plan fails. The consequence is that an exhausted quota looks exactly like
 * a quiet news day: `hadLiveData: false`, no error, no signal. The differentiator switches itself
 * off and nothing says so.
 *
 * The plan is 1,000 credits/month against roughly 14 per generation — about 70 plans for ALL
 * users — so this is not a remote edge case, it is a monthly event. Marking it makes "research is
 * off because we are out of budget" countable and separable from "research found nothing" — both
 * in the monthly admin aggregate (logUsage) AND on the individual request that hit it
 * (markFirecrawlDegraded, read back by runSmartEngine as `liveDataDegraded`). The aggregate alone
 * only tells you research is failing SOMEWHERE this month; the per-request flag is what lets a
 * given plan's response say "we couldn't look today" instead of quietly looking like a quiet day.
 *
 * 402 = out of credits. 429 = rate limited (also concurrency, which is capped at 2 on this plan).
 */
export function noteFirecrawlFailure(status, where) {
  const model = status === 402 ? 'firecrawl-out-of-credits'
    : status === 429 ? 'firecrawl-rate-limited'
    : null;
  // Only the two states worth acting on get a row. A one-off 500 is noise, and a log nobody can
  // act on trains people to ignore the log.
  if (!model) return;
  console.warn(`[firecrawl] ${model} during ${where} — live research is off until this clears`);
  logUsage({ route: 'firecrawl', model, requests: 1 });
  markFirecrawlDegraded(model);
}

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
  if (!res.ok) { noteFirecrawlFailure(res.status, 'scrape'); throw new Error(`scrape HTTP ${res.status}`); }
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
  if (!res.ok) { noteFirecrawlFailure(res.status, 'search'); throw new Error(`search HTTP ${res.status}`); }
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'search failed');
  const web = data.data?.web || data.data || [];
  return web.map((r) => ({ title: r.title || '', url: r.url || '', description: r.description || '' }));
}
