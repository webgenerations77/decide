import { PRICING } from '../constants/pricing.js';
import { getAdminDb } from './firebaseAdmin.cjs';
import { currentUserId } from './usageContext.js';

export function computeCost({ model, inputTokens = 0, outputTokens = 0, requests = 0 }) {
  if (model === 'google-places') return requests * PRICING.googlePlacesPerRequest;
  // Routes bills per element (one origin × one destination), and lib/transport/routes.js sends
  // exactly one pair per request — so requests and elements are the same number here. Left
  // uncosted until 2026-07-28, which hid about 20% of a plan's real cost from the dashboard.
  if (typeof model === 'string' && model.startsWith('google-routes')) {
    return requests * PRICING.googleRoutesPerElement;
  }
  const rate = PRICING.anthropic[model];
  if (!rate) return 0;
  return (inputTokens / 1e6) * rate.inPerMTok + (outputTokens / 1e6) * rate.outPerMTok;
}

// Fire-and-forget: never await in a request path; swallow all errors.
//
// `durationMs` is OPTIONAL and measures wall-clock time the user actually waited, which is a
// different question from cost and is why it is not derived from tokens. It exists because the
// loading screen shows a countdown, and before this nothing in the codebase had ever timed a
// generation — the estimate on that screen was folklore. Rows without it are untouched.
export function logUsage({ route, model, inputTokens = 0, outputTokens = 0, requests = 0, userId, durationMs }) {
  try {
    const estCost = computeCost({ model, inputTokens, outputTokens, requests });
    const effectiveUserId = userId ?? currentUserId();
    const db = getAdminDb();
    db.collection('apiUsage').add({
      ts: Date.now(),
      route, model, inputTokens, outputTokens, requests, estCost, userId: effectiveUserId,
      // Conditional: Firestore rejects an explicit `undefined`, so an absent duration must be an
      // absent FIELD rather than a field set to nothing.
      ...(Number.isFinite(durationMs) ? { durationMs: Math.round(durationMs) } : {}),
    }).catch((e) => console.warn('[usageLog] write failed:', e.message));
  } catch (e) {
    console.warn('[usageLog] skipped:', e.message);
  }
}
