// How much live-research budget is left.
//
// WHY THIS IS ON THE DASHBOARD: the plan is 1,000 credits a month and a generation costs roughly
// 14, so the ceiling is about 70 plans for ALL users combined. That is not a limit you discover
// gracefully — `lib/smart/events.js` returns [] when Firecrawl is unavailable, so running out
// looks identical to a quiet news day. Every plan silently loses its live research and nothing
// anywhere says why. Showing the balance turns a monthly surprise into a number you can watch.
//
// Server-side only: the key must never reach the client.

const BASE = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';

/**
 * Turn the raw balance into something a dashboard can act on.
 *
 * `plansLeft` is the number that matters — credits are an abstraction, "you can generate about
 * nine more plans this month" is a decision.
 */
export function summarizeCredits(data, creditsPerPlan = 14) {
  const remaining = Number(data?.remainingCredits ?? data?.remaining_credits);
  const total = Number(data?.planCredits ?? data?.plan_credits);
  if (!Number.isFinite(remaining) || !Number.isFinite(total) || total <= 0) return null;
  const per = creditsPerPlan > 0 ? creditsPerPlan : 14;
  return {
    remaining,
    total,
    usedPct: Math.min(100, Math.round(((total - remaining) / total) * 100)),
    plansLeft: Math.floor(remaining / per),
    periodEnd: data?.billingPeriodEnd ?? data?.billing_period_end ?? null,
    // The threshold is deliberately generous: by the time this is true, live research is days
    // from switching itself off, and the only warning anyone gets is this row.
    low: remaining / total < 0.2,
  };
}

/**
 * Fetch the balance. Returns null on ANY failure — an admin dashboard must still render when a
 * third party is down, and this is a nice-to-have panel, not a reason to 500.
 */
export async function fetchFirecrawlCredits() {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`${BASE}/v2/team/credit-usage`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const json = await res.json();
      return summarizeCredits(json?.data);
    } finally { clearTimeout(timer); }
  } catch { return null; }
}
