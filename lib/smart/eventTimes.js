import Anthropic from '@anthropic-ai/sdk';
import { logUsage } from '../usageLog.js';

function extractJSON(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

// Extract a structured LOCAL start time from each find's title/snippet/when using the same
// Haiku model the rest of the pipeline uses (scout/anchors). Mutates + returns `finds`,
// annotating each with:
//   startTime      — "HH:MM" 24h local, or null when no time is stated/implied
//   timeConfidence — 'high' (explicit time) | 'low' (implied) | null
// Fully defensive: on a missing key, model failure, or unparseable output, leaves startTime
// null so nothing downstream fabricates a time.
export async function annotateEventTimes(finds, dateISO, deps = {}) {
  const list = Array.isArray(finds) ? finds : [];
  if (!list.length || !process.env.ANTHROPIC_API_KEY) return list;
  const createMessage = deps.createMessage; // test seam
  try {
    const slice = list.slice(0, 20); // bound token cost
    const numbered = slice.map((f, i) =>
      `[${i}] ${f.title || ''}${f.when ? ` | when: ${f.when}` : ''}${f.snippet ? ` | ${f.snippet}` : ''}`
    ).join('\n');
    const user = `Plan date: ${dateISO || 'unknown'}.
For each candidate below, extract the LOCAL start time of the event/show/activity it describes, if one is stated or strongly implied. Do NOT guess a time that the text does not support.

${numbered}

Return ONLY JSON: {"times":[{"i":0,"startTime":"18:40","confidence":"high"}]}
- startTime: 24-hour local "HH:MM", or null if no start time is stated/implied.
- confidence: "high" when an explicit time is present, "low" when only implied, else null.
- Omit entries you cannot extract (or return startTime null for them).`;

    let raw;
    if (createMessage) {
      raw = await createMessage({ user });
    } else {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
        system: 'You extract explicit event start times from short listings. Return only JSON.',
        messages: [{ role: 'user', content: user }],
      });
      logUsage({
        route: 'eventtimes',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: msg.usage?.input_tokens ?? 0,
        outputTokens: msg.usage?.output_tokens ?? 0,
      });
      raw = msg.content[0]?.text ?? '{}';
    }

    const parsed = JSON.parse(extractJSON(raw));
    const times = Array.isArray(parsed?.times) ? parsed.times : [];
    for (const t of times) {
      const idx = Number(t?.i);
      if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) continue;
      const st = typeof t.startTime === 'string' && /^\d{1,2}:\d{2}$/.test(t.startTime) ? t.startTime : null;
      list[idx].startTime = st;
      list[idx].timeConfidence = st ? (t.confidence === 'high' ? 'high' : 'low') : null;
    }
    return list;
  } catch (e) {
    console.warn('[eventTimes] failed:', e.message);
    return list;
  }
}
