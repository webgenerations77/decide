import Anthropic from '@anthropic-ai/sdk';
import { logUsage } from '../lib/usageLog.js';

const SYSTEM = 'You are Cheddar, a warm, knowledgeable, slightly playful local trip planner.';

function buildPrompt(tripNote) {
  return `A traveler is planning their day and left this note about what they're into: "${tripNote}"

Write ONE short, friendly, SPECIFIC follow-up question that would meaningfully improve their day plan. Keep the tone warm and a little playful, like a friend texting back — not a form. Return ONLY the question, no preamble, no quotes.

If the note is empty, generic, or uninformative (e.g. "no", "nothing", "n/a", "idk"), return exactly the token SKIP.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tripNote } = req.body || {};
  if (!tripNote || tripNote.trim().length < 2) {
    return res.json({ skip: true });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      system: SYSTEM,
      messages: [{ role: 'user', content: buildPrompt(tripNote) }],
    });
    logUsage({
      route: 'clarify',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: msg.usage?.input_tokens ?? 0,
      outputTokens: msg.usage?.output_tokens ?? 0,
    });
    const text = msg.content[0]?.text?.trim() ?? '';
    if (text === '' || text.toUpperCase() === 'SKIP') return res.json({ skip: true });
    return res.json({ question: text });
  } catch (e) {
    console.warn('[clarify] failed:', e.message);
    return res.json({ skip: true });
  }
}
