import { validateFeedback, sendFeedbackEmail } from '../../api/feedbackEmail.js';

export async function POST(request) {
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
