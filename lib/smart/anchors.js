import Anthropic from '@anthropic-ai/sdk';
import { logUsage } from '../usageLog.js';

function extractJSON(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

export function buildAnchorPrompt(finds, ctx) {
  const list = finds.map((f, i) => `[${i}] ${f.title}${f.snippet ? ` — ${f.snippet}` : ''} (${f.sourceLabel || ''})`).join('\n');
  return `Trip to ${ctx.location}. Candidate live finds:\n${list}\n\nPick the 1–3 that should ANCHOR the day — the most time-sensitive, unique, or delightful ones worth building around. Skip generic filler.\n\nReturn ONLY JSON: {"anchors":[{"findIndex":0,"rationale":"why this anchors the day"}]}`;
}

export function validateAnchors(raw, finds) {
  const arr = Array.isArray(raw?.anchors) ? raw.anchors : [];
  return arr
    .filter((a) => a && Number.isInteger(a.findIndex) && finds[a.findIndex])
    .map((a) => ({ find: finds[a.findIndex], rationale: typeof a.rationale === 'string' ? a.rationale : '' }))
    .slice(0, 3);
}

export async function pickAnchors(finds, ctx) {
  try {
    if (!finds.length) return [];
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
      system: 'You choose which live finds should anchor a day plan. Return only JSON.',
      messages: [{ role: 'user', content: buildAnchorPrompt(finds, ctx) }],
    });
    logUsage({
      route: 'anchors',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: msg.usage?.input_tokens ?? 0,
      outputTokens: msg.usage?.output_tokens ?? 0,
    });
    return validateAnchors(JSON.parse(extractJSON(msg.content[0]?.text ?? '{}')), finds);
  } catch (e) {
    console.warn('[anchors] failed:', e.message);
    return [];
  }
}
