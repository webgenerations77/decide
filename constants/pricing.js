// Cost-estimate rates for the admin API-usage dashboard. USD.
// Dated so dashboard figures are auditable; update when provider pricing changes.
export const PRICING = {
  effectiveDate: '2026-06-30',
  anthropic: {
    'claude-haiku-4-5-20251001': { inPerMTok: 1.00, outPerMTok: 5.00 },
    'claude-sonnet-4-6':         { inPerMTok: 3.00, outPerMTok: 15.00 },
  },
  // Rough blended estimate per Google Places (Nearby/Text/Details) request.
  googlePlacesPerRequest: 0.017,

  // Google Routes, billed per ELEMENT (one origin × one destination), Essentials SKU at
  // $5/1,000 with 10,000 free per month. lib/transport/routes.js deliberately avoids the
  // TRAFFIC_AWARE modifiers that would promote requests to the Pro SKU.
  //
  // ⚠ These were previously uncosted, so every Routes call logged $0.00 and the dashboard
  // under-reported a real plan by about 20% — roughly $0.045 of a ~$0.22 plan. A cost dashboard
  // that quietly omits a fifth of the bill is worse than no dashboard, because it gets trusted.
  googleRoutesPerElement: 0.005,

  // Firecrawl, for reference: the plan is a flat monthly fee rather than per-call, so it is not
  // billed through logUsage. At $16/5,000 credits and ~14 credits per generation that is about
  // $0.045 a plan — see docs/backlog.md for the measured breakdown.
  firecrawlPerCredit: 16 / 5000,
};
