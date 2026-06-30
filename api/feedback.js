import {
  validateFeedback, sendFeedbackEmail, gateFeedbackRequest, checkFeedbackRate,
} from '../lib/feedbackEmail.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return res.json({ status: 'ok', message: 'Feedback API is running' });
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const secret = req.headers['x-feedback-secret'];
  if (!gateFeedbackRequest(secret).ok) return res.status(401).json({ success: false, error: 'unauthorized' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'anon';
  const rateKey = process.env.FEEDBACK_SHARED_SECRET ? `s:${secret}` : `ip:${ip}`;
  if (!checkFeedbackRate(rateKey).ok) return res.status(429).json({ success: false, error: 'rate limited' });

  const { ok, data, error } = validateFeedback(req.body);
  if (!ok) return res.status(400).json({ success: false, error });

  try {
    await sendFeedbackEmail(data);
    return res.json({ success: true });
  } catch (e) {
    console.error('[feedback] send failed:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
