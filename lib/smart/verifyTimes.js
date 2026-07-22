import Anthropic from '@anthropic-ai/sdk';
import { logUsage } from '../usageLog.js';
import { firecrawlScrape, firecrawlSearch } from './firecrawl.js';

const MAX_VERIFY = 3;
const PER_ITEM_TIMEOUT_MS = 6000;
const SCHEDULED_EVENT_RE = /music|sport|theat(er|re)|festival|tour|show|race|concert|game|event/i;

function extractJSON(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

// Step 1 — pick the finds worth proactively verifying: scheduled-event-shaped, not already
// confirmed, capped at 3 so this never becomes an unbounded fan-out of scrapes/searches.
export function selectTimeSensitive(finds) {
  const list = Array.isArray(finds) ? finds : [];
  const out = [];
  for (const f of list) {
    if (!f || typeof f !== 'object') continue;
    const looksScheduled =
      f.sourceLabel === 'Local events' ||
      SCHEDULED_EVENT_RE.test(f.interest || '') ||
      SCHEDULED_EVENT_RE.test(f.category || '');
    if (!looksScheduled) continue;
    if (f.timeConfidence === 'high' || f.timeConfidence === 'verified') continue;
    out.push(f);
    if (out.length >= MAX_VERIFY) break;
  }
  return out;
}

// Step 2 — a find with a real http(s) url can be scraped directly; otherwise the caller
// must run one targeted search to find a source page first.
export function pickSourceUrl(find) {
  const url = find && typeof find.url === 'string' ? find.url : '';
  if (/^https?:\/\//i.test(url)) return { url, needsSearch: false };
  return { url: null, needsSearch: true };
}

function timeoutAfter(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms, { timedOut: true }));
}

// Verify one find: resolve a source url (search if needed), scrape it, ask Haiku for a
// confirmed start time on the SPECIFIC plan date, and only accept a high-confidence,
// well-formed result. Never throws — any failure leaves the find untouched.
async function verifyOne(find, ctx, deps) {
  const search = deps.search || firecrawlSearch;
  const scrape = deps.scrape || firecrawlScrape;
  const createMessage = deps.createMessage;

  try {
    let { url, needsSearch } = pickSourceUrl(find);
    if (needsSearch) {
      const query = `${find.title || ''} ${ctx.dayOfWeek || ''} ${ctx.travelDates?.start || ''} schedule start time ${ctx.location || ''}`;
      const results = await search(query, 3);
      const top = Array.isArray(results) ? results[0] : null;
      if (!top || !top.url) return; // nothing to verify against — leave untouched
      url = top.url;
    }
    if (!url) return;

    const markdown = await scrape(url);
    const slice = (markdown || '').slice(0, 4000);

    const user = `Plan date: ${ctx.travelDates?.start || 'unknown'} (${ctx.dayOfWeek || 'unknown weekday'}).
Venue/event: ${find.title || 'unknown'}

Scraped page content:
${slice}

Extract the CONFIRMED start time for THIS SPECIFIC DATE (not a generic weekly/recurring time) if the page states or clearly implies one for that date.

Return ONLY JSON: {"startTime":"HH:MM","confidence":"high"} or {"startTime":null,"confidence":null}
- startTime: 24-hour local "HH:MM", or null if not confirmable for this specific date.
- confidence: "high" only when the page explicitly confirms the time for this date, "low" if only implied/generic, else null.`;

    let raw;
    if (createMessage) {
      raw = await createMessage({ user });
    } else {
      if (!process.env.ANTHROPIC_API_KEY) return; // real client gated on its own key only
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: 'You extract a confirmed event start time for a specific date from a scraped page. Return only JSON.',
        messages: [{ role: 'user', content: user }],
      });
      logUsage({
        route: 'verifytimes',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: msg.usage?.input_tokens ?? 0,
        outputTokens: msg.usage?.output_tokens ?? 0,
      });
      raw = msg.content[0]?.text ?? '{}';
    }

    const parsed = JSON.parse(extractJSON(raw));
    const startTime = typeof parsed?.startTime === 'string' ? parsed.startTime : null;
    const confidence = parsed?.confidence;
    if (confidence === 'high' && startTime && /^\d{1,2}:\d{2}$/.test(startTime)) {
      find.verifiedTime = startTime;
      find.verifiedSource = url;
      find.timeConfidence = 'verified';
    }
    // anything else (low/null confidence, bad shape) → leave the find untouched
  } catch (e) {
    console.warn('[verifyTimes] failed:', e.message);
    // leave the find untouched
  }
}

// Proactively confirms real start times for a small, capped set of time-sensitive finds by
// scraping the venue/event page (falling back to one targeted search when no url is known)
// and extracting a date-specific start time via Haiku. Mutates + returns `finds` (same
// contract as annotateEventTimes). Fully defensive — this feature must only ever improve
// timing, never block or corrupt it, so it NEVER throws and NEVER downgrades a find.
export async function verifyEventTimes(finds, ctx = {}, deps = {}) {
  const list = Array.isArray(finds) ? finds : [];
  if (!list.length) return finds;
  try {
    const selected = selectTimeSensitive(list);
    if (!selected.length) return list;
    await Promise.all(
      selected.map((find) =>
        Promise.race([verifyOne(find, ctx, deps), timeoutAfter(PER_ITEM_TIMEOUT_MS)])
      )
    );
    return list;
  } catch (e) {
    console.warn('[verifyTimes] failed:', e.message);
    return list;
  }
}
