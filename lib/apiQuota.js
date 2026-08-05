import { getAdminDb } from './firebaseAdmin.cjs';
import { ADMINS } from '../constants/admins.js';

/**
 * Server-side abuse ceiling for the paid endpoints.
 *
 * ⚠ THIS IS NOT THE PRODUCT LIMIT. services/subscriptionService.js caps a free traveller at 3
 * plans a month; that cap lives on the client, in AsyncStorage, and is the rule the UI explains
 * and the paywall sells against. It is also trivially defeated — clear app storage, or skip the
 * app entirely and POST to the endpoint. Before this module the endpoint was open to the whole
 * internet with no cap of any kind, so a plan that costs ~$0.22 loaded could be bought by anyone
 * with curl, indefinitely.
 *
 * Mirroring the client's 3/month here would be WRONG and would break a working feature: a review
 * bonus grants up to MAX_REVIEW_BONUS_PER_PERIOD (3) extra plans, banked in AsyncStorage where the
 * server cannot see them. A legitimate free user can therefore reach 6 in a month, and a server
 * that stopped at 3 would 403 someone who had earned their fourth. The bonus is client-held by
 * design, so the server cannot reconstruct the true allowance — it can only refuse to be the
 * unlimited one.
 *
 * So: the ceiling is set far above any honest usage (25/month ≈ 4x the maximum legitimate free
 * allowance) and exists purely to bound worst-case spend per account, ~$5.50/month instead of
 * unbounded. The hourly burst cap is the other half — a month's ceiling still allows all 25 to be
 * spent in ninety seconds by a script, which is the shape abuse actually takes.
 *
 * Enforcement order matters: the 401 in the handler is the real defence (it makes an account, and
 * therefore an email and a Firebase sign-up, the price of entry). This is the backstop for a
 * signed-in account behaving badly.
 */
const PLAN_CEILING_PER_MONTH = 25;
const BURST_PER_HOUR = 8;

const HOUR_MS = 3600000;

const monthKey = () => new Date().toISOString().slice(0, 7); // YYYY-MM (UTC)

/** Admins are never limited — same rule as the client, read from the same constants file. */
export function isAdminEmail(email) {
  const e = email?.toLowerCase?.().trim();
  return Boolean(e && ADMINS[e] === 'admin');
}

/**
 * Charge one unit against a user's quota and say whether to proceed.
 *
 * `weight` is how much of the MONTHLY plan ceiling this request consumes. A full generation is 1.
 * The cheap side-modes (clarify, transport-leg) and swap pass 0: they cost real money but a
 * fraction of a plan, and spending a traveller's monthly plan allowance on a follow-up question
 * would be indefensible. They still pay into the HOURLY burst counter, which is what actually
 * stops a script — so a zero-weight call is rate-limited without being quota-limited.
 *
 * ⚠ FAILS OPEN on any Firestore error, deliberately. A quota store that is unreachable must never
 * become an outage: the alternative is that a Firestore blip locks every paying traveller out of
 * the product's only feature. The cost of failing open is bounded by the 401 in front of it —
 * an attacker still needs a verified account — while the cost of failing closed is total. This
 * is the opposite of the transport module's fail-conservative rule, and for the opposite reason:
 * there, a wrong answer strands someone mid-trip; here, a wrong answer is a refund.
 */
/**
 * The whole decision, as a pure function of the stored counters and the clock.
 *
 * Split out from the transaction so it can be unit-tested exhaustively without Firestore — the
 * same split lib/transport/modes.js uses against routes.js. Returns the verdict AND the row to
 * write, so the caller does no arithmetic of its own and the two cannot drift.
 */
export function evaluateQuota({ cur = {}, now, month, weight = 1 }) {
  const plans = cur.month === month ? (cur.plans || 0) : 0;
  const hourStart = typeof cur.hourStart === 'number' ? cur.hourStart : 0;
  const withinHour = now - hourStart < HOUR_MS;
  const hourCount = withinHour ? (cur.hourCount || 0) : 0;

  if (hourCount + 1 > BURST_PER_HOUR) {
    return { allowed: false, reason: 'burst', retryAfter: Math.max(1, Math.ceil((hourStart + HOUR_MS - now) / 1000)) };
  }
  if (weight > 0 && plans + weight > PLAN_CEILING_PER_MONTH) {
    return { allowed: false, reason: 'monthly' };
  }
  return {
    allowed: true,
    plans: plans + weight,
    next: {
      month,
      plans: plans + weight,
      hourStart: withinHour ? hourStart : now,
      hourCount: hourCount + 1,
      updatedAt: now,
    },
  };
}

export async function checkAndConsumeQuota({ uid, email, weight = 1 }) {
  if (isAdminEmail(email)) return { allowed: true, exempt: true };
  if (!uid) return { allowed: true, exempt: false }; // handler gates this; never reached in prod

  let db;
  try {
    db = getAdminDb();
  } catch (err) {
    console.error('[apiQuota] Firestore unavailable, failing open:', err?.message);
    return { allowed: true, degraded: true };
  }

  const ref = db.collection('apiQuota').doc(uid);
  const now = Date.now();
  const month = monthKey();

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      // A new month resets the plan counter; a new hour resets the burst window. Both are stored
      // as the period they belong to rather than a rolling timestamp, so a clock skew between
      // serverless instances cannot resurrect a spent allowance.
      const verdict = evaluateQuota({ cur: snap.exists ? snap.data() : {}, now, month, weight });
      if (!verdict.allowed) return verdict;
      tx.set(ref, verdict.next, { merge: true });
      return { allowed: true, plans: verdict.plans };
    });
  } catch (err) {
    console.error('[apiQuota] transaction failed, failing open:', err?.message);
    return { allowed: true, degraded: true };
  }
}

export const QUOTA_LIMITS = { PLAN_CEILING_PER_MONTH, BURST_PER_HOUR };
