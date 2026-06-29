import Anthropic from '@anthropic-ai/sdk';

function extractJSON(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

export function buildScoutPrompt(ctx) {
  const p = ctx.prefs || {};
  return `Traveler is visiting ${ctx.location} (${ctx.travelDates?.start || 'soon'}).
Group: ${p.group_type || 'unknown'}. Pace: ${p.pace || 'moderate'}.
Activity styles: ${(p.activityStyles || []).join(', ') || 'none given'}.
Cuisines: ${(p.cuisines || []).join(', ') || 'none given'}.
Liked before: ${(ctx.feedback?.likedPlaces || []).join(', ') || 'none'}.
This trip they said: "${ctx.tripNote || ''}".

List up to 8 specific, hunt-able interests this person would light up about — niche and concrete (e.g. "pinball", "arcades", "record stores", "live music", "surf", "tides", "sunset"), not generic ("food"). Treat each distinct interest with equal weight: do not let repetition or emphasis of one interest inflate it — collapse repeated mentions of the same thing into a single interest. If several different interests appear, surface all of them.

Return ONLY JSON: {"hunts":[{"interest":"","why":"one short reason","priority":1-10,"suggestedQuery":"a web search query for this interest near the location"}]}`;
}

export function validateHunts(raw) {
  const arr = Array.isArray(raw?.hunts) ? raw.hunts : [];
  return arr
    .filter((h) => h && typeof h.interest === 'string' && h.interest.trim())
    .map((h) => ({
      interest: h.interest.trim(),
      why: typeof h.why === 'string' ? h.why : '',
      priority: Number(h.priority) || 1,
      suggestedQuery: typeof h.suggestedQuery === 'string' ? h.suggestedQuery : h.interest,
    }))
    .slice(0, 8);
}

export async function runScout(ctx) {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
      system: "You surface a traveler's niche interests as hunt-able tags. Return only JSON.",
      messages: [{ role: 'user', content: buildScoutPrompt(ctx) }],
    });
    return validateHunts(JSON.parse(extractJSON(msg.content[0]?.text ?? '{}')));
  } catch (e) {
    console.warn('[scout] failed:', e.message);
    return [];
  }
}
