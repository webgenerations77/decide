import Anthropic from '@anthropic-ai/sdk';
import { firecrawlSearch, firecrawlScrape } from './firecrawl.js';
import { logUsage } from '../usageLog.js';

const MUSIC_STYLE_RE = /live music|concert|\bgig\b|\bband\b|\bshow\b|music venue|\bdj\b/i;
const MAX_VENUES = 4; // cap concurrent scrapes — keeps latency to one scrape round

function extractJSON(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

// True only when live music was explicitly requested. Gates the whole feature so
// it never adds latency to a build that did not ask for it.
export function wantsLiveMusic(prefs = {}, tripNote = '') {
  const styles = (prefs.activityStyles || []).join(' ');
  return MUSIC_STYLE_RE.test(styles) || MUSIC_STYLE_RE.test(tripNote || '');
}

// Card-ready one-liner for a parsed show.
export function summarizeShow(show) {
  if (show && show.confirmed && show.artist) {
    return `🎵 ${show.artist}${show.showtime ? ` · ${show.showtime}` : ''}`;
  }
  const where = show?.url ? ` — check ${show.url}` : '';
  return `Live music likely${where} for the current schedule`;
}

// Ask haiku to pull confirmed shows for the date out of scraped venue pages.
// deps.client is injectable for tests. Returns [] on any failure.
export async function parseShows(pages, dateISO, deps = {}) {
  const usable = (pages || []).filter((p) => p && p.content);
  if (!usable.length) return [];
  try {
    const client = deps.client || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const blocks = usable
      .map((p, i) => `[${i}] ${p.title} <${p.url}>\n${p.content.slice(0, 2500)}`)
      .join('\n\n');
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
      system: 'You extract live-music shows for a specific date from scraped venue pages. Return only JSON.',
      messages: [{ role: 'user', content:
        `Date of interest: ${dateISO}. Venue pages:\n\n${blocks}\n\n` +
        `For each page that lists a show on that exact date, return the act and start time. ` +
        `Return ONLY JSON: {"shows":[{"pageIndex":0,"artist":"","showtime":""}]}` }],
    });
    logUsage({
      route: 'liveMusic',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: msg.usage?.input_tokens ?? 0,
      outputTokens: msg.usage?.output_tokens ?? 0,
    });
    const raw = JSON.parse(extractJSON(msg.content[0]?.text ?? '{}'));
    const out = [];
    for (const s of raw.shows || []) {
      const p = usable[s.pageIndex];
      if (p && s.artist) out.push({ url: p.url, artist: String(s.artist), showtime: String(s.showtime || ''), confirmed: true });
    }
    return out;
  } catch (e) {
    console.warn('[livemusic] parse failed:', e.message);
    return [];
  }
}

// Source-shaped runner. Searches the web for live music on the date, scrapes the
// top candidate venue pages concurrently, and returns finds. Confirmed shows get
// artist/showtime; unconfirmed candidates become "live music likely" finds.
export async function runLiveMusic(ctx, interest, deps = {}) {
  const search = deps.firecrawlSearch || firecrawlSearch;
  const scrape = deps.firecrawlScrape || firecrawlScrape;
  const date = ctx.travelDates?.start || '';
  try {
    const results = await search(`live music in ${ctx.location} on ${date}`, MAX_VENUES);
    const candidates = (results || []).filter((r) => r.url).slice(0, MAX_VENUES);
    if (!candidates.length) return [];

    const pages = await Promise.all(candidates.map(async (c) => {
      try { return { title: c.title, url: c.url, content: await scrape(c.url) }; }
      catch (e) { console.warn(`[livemusic] scrape ${c.url} failed: ${e.message}`); return { title: c.title, url: c.url, content: '' }; }
    }));

    const shows = await parseShows(pages, date, deps);
    const showByUrl = new Map(shows.map((s) => [s.url, s]));

    return candidates.map((c) => {
      const show = showByUrl.get(c.url) || { confirmed: false, url: c.url };
      return {
        title: c.title, category: 'activity', interest: 'live music',
        lat: null, lng: null, address: '', when: date,
        url: c.url, snippet: summarizeShow(show), sourceLabel: 'Live music',
        needsTickets: !!show.confirmed,
        live_music: { artist: show.artist || null, showtime: show.showtime || null, confirmed: !!show.confirmed },
      };
    });
  } catch (e) {
    console.warn('[livemusic] failed:', e.message);
    return [];
  }
}
