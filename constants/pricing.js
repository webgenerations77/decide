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
};
