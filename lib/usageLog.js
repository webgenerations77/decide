import { PRICING } from '../constants/pricing.js';
import { getAdminDb } from './firebaseAdmin.cjs';

export function computeCost({ model, inputTokens = 0, outputTokens = 0, requests = 0 }) {
  if (model === 'google-places') return requests * PRICING.googlePlacesPerRequest;
  const rate = PRICING.anthropic[model];
  if (!rate) return 0;
  return (inputTokens / 1e6) * rate.inPerMTok + (outputTokens / 1e6) * rate.outPerMTok;
}

// Fire-and-forget: never await in a request path; swallow all errors.
export function logUsage({ route, model, inputTokens = 0, outputTokens = 0, requests = 0, userId = null }) {
  try {
    const estCost = computeCost({ model, inputTokens, outputTokens, requests });
    const db = getAdminDb();
    db.collection('apiUsage').add({
      ts: Date.now(),
      route, model, inputTokens, outputTokens, requests, estCost, userId,
    }).catch((e) => console.warn('[usageLog] write failed:', e.message));
  } catch (e) {
    console.warn('[usageLog] skipped:', e.message);
  }
}
