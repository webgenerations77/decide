import { Resend } from 'resend';

const MAX = { message: 4000, field: 200 };

// Validates a feedback payload. Returns { ok:true, data } or { ok:false, error }.
// Over-cap fields are REJECTED (not truncated) so garbage never reaches Resend.
export function validateFeedback(body = {}) {
  const {
    page = '', feedbackType = '', message = '',
    rating = null, userEmail = '', userName = '', timestamp = '',
  } = body;

  const msg = String(message ?? '');
  if (!msg.trim()) return { ok: false, error: 'message is required' };
  if (msg.length > MAX.message) return { ok: false, error: 'message too long' };

  for (const [k, v] of Object.entries({ page, feedbackType, userEmail, userName, timestamp })) {
    if (String(v ?? '').length > MAX.field) return { ok: false, error: `${k} too long` };
  }

  const email = String(userEmail ?? '');
  return {
    ok: true,
    data: {
      page: String(page) || 'unknown',
      feedbackType: String(feedbackType) || 'General Impression',
      message: msg.trim(),
      rating: (() => { const r = Number(rating); return Number.isInteger(r) && r >= 1 && r <= 5 ? r : null; })(),
      userEmail: email,
      userName: String(userName) || (email.split('@')[0] || 'a beta tester'),
      timestamp: String(timestamp) || new Date().toISOString(),
    },
  };
}

// Shared-secret gate. FAILS OPEN when FEEDBACK_SHARED_SECRET is unset (keeps dev/beta working).
// NOTE: the client's copy of this secret ships in the EXPO_PUBLIC bundle and is extractable —
// this raises the bar against casual abuse, it is NOT cryptographic protection.
export function gateFeedbackRequest(secretHeader) {
  const expected = process.env.FEEDBACK_SHARED_SECRET;
  if (!expected) return { ok: true };
  return { ok: secretHeader === expected };
}

// Best-effort in-memory rate limit: 5 sends / 10 min per key. State lives only within a warm
// serverless instance (resets on cold start) — it stops obvious tight-loop spam, not a
// distributed attacker. When the shared secret is set, all clients share one key/bucket.
// `hits` is bounded: once it exceeds SWEEP_AT keys, a sweep evicts every fully-expired key.
const RATE = { max: 5, windowMs: 10 * 60 * 1000 };
const SWEEP_AT = 1000;
const hits = new Map();

function freshTimestamps(arr, now) {
  return arr.filter((t) => now - t < RATE.windowMs);
}

export function checkFeedbackRate(key = 'anon') {
  const now = Date.now();
  // Opportunistic eviction: only when the map has grown large, drop keys whose window expired.
  if (hits.size > SWEEP_AT) {
    for (const [k, arr] of hits) {
      const live = freshTimestamps(arr, now);
      if (live.length) hits.set(k, live); else hits.delete(k);
    }
  }
  const fresh = freshTimestamps(hits.get(key) || [], now);
  if (fresh.length >= RATE.max) {
    hits.set(key, fresh);
    return { ok: false, limited: true };
  }
  fresh.push(now);
  hits.set(key, fresh);
  return { ok: true };
}

// Sends the feedback email via Resend. Throws on misconfig or send failure.
export async function sendFeedbackEmail(data) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_RECIPIENT_EMAIL;
  if (!apiKey || !to) throw new Error('RESEND_API_KEY and FEEDBACK_RECIPIENT_EMAIL must be set');

  // Configurable verified-domain sender; falls back to the Resend sandbox address.
  const from = process.env.FEEDBACK_FROM_EMAIL || 'onboarding@resend.dev';

  const resend = new Resend(apiKey);
  const ratingLine = data.rating ? `Rating: ${data.rating}/5\n` : '';
  const subject = `🧪 Beta Feedback — ${data.feedbackType} on ${data.page}`;
  // Email/name are client-supplied with no server-side identity — label them unverified.
  const text =
    `New feedback from ${data.userName} (claimed: ${data.userEmail || 'no email'} — unverified)\n\n` +
    `Page: ${data.page}\n` +
    `Type: ${data.feedbackType}\n` +
    ratingLine +
    `Submitted: ${data.timestamp}\n\n` +
    `---\n${data.message}\n`;

  const { error } = await resend.emails.send({ from, to, subject, text });
  if (error) throw new Error(error.message || 'Resend send failed');
}
