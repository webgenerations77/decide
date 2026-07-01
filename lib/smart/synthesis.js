import Anthropic from '@anthropic-ai/sdk';
import { logUsage } from '../usageLog.js';

function extractJSON(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

export function buildSynthesisPrompt({ places, finds, anchors, ctx }) {
  const p = ctx.prefs || {};
  const anchorBlock = anchors.length
    ? anchors.map((a, i) => `ANCHOR ${i + 1}: ${a.find.title} @ (${a.find.lat},${a.find.lng}) — ${a.rationale} [${a.find.sourceLabel}]`).join('\n')
    : '(none — build from places and any finds below)';
  const findBlock = finds.slice(0, 20).map((f) => `- ${f.title}${f.when ? ` — ${f.when}` : ''}${f.snippet ? ` (${f.snippet})` : ''} @ (${f.lat},${f.lng}) [${f.interest}/${f.sourceLabel}]`).join('\n') || '(none)';

  const system = 'You are Cheddar, a warm, opinionated local friend who builds day plans. You make confident calls and lead with what makes the day special. Return ONLY a JSON array of stops, no prose.';

  const user = `City: ${ctx.location}
Window: ${ctx.startTime} to ${ctx.endTime}. Group: ${p.group_type || 'couple'}. Pace: ${p.pace || 'moderate'}. Budget: ${p.budget || '$$'}.
Date: ${ctx.formattedDate || ctx.travelDates?.start || ''}${ctx.dayOfWeek ? ` (${ctx.dayOfWeek})` : ''}${ctx.holiday ? ` — ${ctx.holiday}` : ''}.
Dietary: ${(p.dietary || []).join(', ') || 'none'}.
Requested activity styles: ${(p.activityStyles || []).join(', ') || 'none'}.
What they said for this trip: "${ctx.tripNote || ''}".

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
- Balance activity types: include at most 1–2 stops of any single activity type, no matter how strongly it was requested. If the traveler asked for multiple activity types, represent each of them across the day rather than over-filling one.
- If a requested activity type cannot be sourced from the anchors, finds, or places, add a short note stop or call it out in a stop's reason rather than silently dropping it.
${p.neurodivergent ? '- Accessibility: this traveler is neurodivergent / sensory-sensitive. Favor calmer, quieter, structured, predictable places and a gentler pace; avoid loud, crowded, chaotic, or overstimulating venues.\n' : ''}- If a stop is a live-music venue (provenance interest "live music"), copy its show info into a "live_music" field on the stop: {"note": the find's snippet}.
- If any "Local events" finds or a holiday are present for this date, acknowledge what's happening and time the day to take advantage (e.g. be near the waterfront for fireworks). You may reference a dated event in a stop's reason even if it has no fixed location.
- For free or public outdoor attractions (boardwalks, beaches, parks, downtowns, public venues), set "parking" to a brief honest caveat about likely paid/limited parking nearby. For ordinary venues with their own lot, or where parking is a non-issue, set parking to null. Never put parking cost into admission_cost — keep them separate.
- Set "category" to a short lowercase type word describing the stop (e.g. food, cafe, beach, outdoor, nature, hike, shopping, nightlife, music, arts, attraction, sightseeing, spa, sports, activity).

Return a JSON array. Each stop: time, duration_mins, category, name, place_id, address, lat, lng, reason, excitement_score, admission_cost ("Free" | "$15/adult" | "Prices vary — check website" | null for food/shopping), parking (a short caveat string ONLY for free/low-cost outdoor or public attractions where nearby parking likely costs money or is limited — e.g. "Metered/paid lots nearby", "Paid lots ~$2/hr in season", "Free lot on-site"; otherwise null), and provenance (only for anchor/find stops).`;

  return { system, user };
}

export function validateStops(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const isMusic = (s) => !!s.live_music || s.provenance?.interest === 'live music';
  return arr.filter((s) =>
    s && s.time && s.name && s.category &&
    (((s.lat === 0 || typeof s.lat === 'number') && (s.lng === 0 || typeof s.lng === 'number')) || isMusic(s))
  ).map((s) => ({
    time: s.time, duration_mins: Number(s.duration_mins) || 60, category: s.category,
    name: s.name, place_id: s.place_id || `stop_${Math.round((s.lat || 0) * 1000)}`,
    address: s.address || '',
    lat: typeof s.lat === 'number' ? s.lat : null,
    lng: typeof s.lng === 'number' ? s.lng : null,
    reason: s.reason || '', excitement_score: Number(s.excitement_score) || 70,
    admission_cost: s.admission_cost ?? null,
    parking: s.parking ?? null,
    ...(s.provenance ? { provenance: s.provenance } : {}),
    ...(s.live_music ? { live_music: s.live_music } : {}),
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
    logUsage({
      route: 'synthesis',
      model: 'claude-sonnet-4-6',
      inputTokens: msg.usage?.input_tokens ?? 0,
      outputTokens: msg.usage?.output_tokens ?? 0,
    });
    const stops = validateStops(JSON.parse(extractJSON(msg.content[0]?.text ?? '[]')));
    return stops;
  } catch (e) {
    console.warn('[synthesis] failed:', e.message);
    return [];
  }
}
