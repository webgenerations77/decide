import {
  validateFeedback, sendFeedbackEmail, gateFeedbackRequest, checkFeedbackRate,
} from '../../api/feedbackEmail.js';

export async function POST(request) {
  const secret = request.headers.get('x-feedback-secret');
  if (!gateFeedbackRequest(secret).ok) {
    return Response.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'anon';
  const rateKey = process.env.FEEDBACK_SHARED_SECRET ? `s:${secret}` : `ip:${ip}`;
  if (!checkFeedbackRate(rateKey).ok) {
    return Response.json({ success: false, error: 'rate limited' }, { status: 429 });
  }

  let body = {};
  try { body = await request.json(); } catch {}

  const { ok, data, error } = validateFeedback(body);
  if (!ok) return Response.json({ success: false, error }, { status: 400 });

  try {
    await sendFeedbackEmail(data);
    return Response.json({ success: true });
  } catch (e) {
    console.error('[feedback] send failed:', e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
