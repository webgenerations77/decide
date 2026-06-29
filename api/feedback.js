import { validateFeedback, sendFeedbackEmail } from './feedbackEmail.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return res.json({ status: 'ok', message: 'Feedback API is running' });
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

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
