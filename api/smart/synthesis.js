import Anthropic from '@anthropic-ai/sdk';

function extractJSON(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

export function buildSynthesisPrompt({ places, finds, anchors, ctx }) {
  const p = ctx.prefs || {};
  const anchorBlock = anchors.length
    ? anchors.map((a, i) => `ANCHOR ${i + 1}: ${a.find.title} @ (${a.find.lat},${a.find.lng}) — ${a.rationale} [${a.find.sourceLabel}]`).join('\n')
    : '(none — build from places and any finds below)';
  const findBlock = finds.slice(0, 20).map((f) => `- ${f.title}${f.snippet ? ` (${f.snippet})` : ''} @ (${f.lat},${f.lng}) [${f.interest}/${f.sourceLabel}]`).join('\n') || '(none)';

  const system = 'You are Cheddar, a warm, opinionated local friend who builds day plans. You make confident calls and lead with what makes the day special. Return ONLY a JSON array of stops, no prose.';

  const user = `City: ${ctx.location}
Window: ${ctx.startTime} to ${ctx.endTime}. Group: ${p.group_type || 'couple'}. Pace: ${p.pace || 'moderate'}. Budget: ${p.budget || '$$'}.
Dietary: ${(p.dietary || []).join(', ') || 'none'}.

## Anchors — build the day around these (they are the point)
${anchorBlock}

## Other live finds you may weave in
${findBlock}

## Nearby places (Google) to fill gaps
${JSON.stringify(places, null, 0).slice(0, 9000)}

Rules:
- Lead with the anchors — they shape the day, not the other way around. Put each anchor in at the right time.
- For an anchor or find used as a stop: set place_id to "find_" + a slug of its name, use its lat/lng, set category to its category, and add "provenance": {"interest","sourceLabel","why"}.
- Fill remaining stops from the Google places (use their exact place_id/lat/lng).
- Include lunch if midday is in the window and dinner if evening is. Match budget. Don't repeat a place.
- Do not include bars, breweries, or alcohol-serving venues as stops unless the user explicitly requested them OR the venue is hosting live music on this date (a stop whose provenance interest is "live music").
- ${p.pace === 'relaxed' ? '4–5' : p.pace === 'packed' ? '7–8' : '5–6'} stops.

Return a JSON array. Each stop: time, duration_mins, category, name, place_id, address, lat, lng, reason, excitement_score, admission_cost ("Free" | "$15/adult" | "Prices vary — check website" | null for food/shopping), and provenance (only for anchor/find stops).`;

  return { system, user };
}

export function validateStops(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.filter((s) =>
    s && s.time && s.name && s.category &&
    (s.lat === 0 || typeof s.lat === 'number') && (s.lng === 0 || typeof s.lng === 'number')
  ).map((s) => ({
    time: s.time, duration_mins: Number(s.duration_mins) || 60, category: s.category,
    name: s.name, place_id: s.place_id || `stop_${Math.round((s.lat || 0) * 1000)}`,
    address: s.address || '', lat: s.lat, lng: s.lng,
    reason: s.reason || '', excitement_score: Number(s.excitement_score) || 70,
    admission_cost: s.admission_cost ?? null,
    ...(s.provenance ? { provenance: s.provenance } : {}),
  }));
}

export async function runSynthesis({ places, finds, anchors, ctx }) {
  try {
    const { system, user } = buildSynthesisPrompt({ places, finds, anchors, ctx });
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 4096,
      output_config: { effort: 'medium' },
      system, messages: [{ role: 'user', content: user }],
    });
    const stops = validateStops(JSON.parse(extractJSON(msg.content[0]?.text ?? '[]')));
    return stops;
  } catch (e) {
    console.warn('[synthesis] failed:', e.message);
    return [];
  }
}
