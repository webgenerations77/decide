import { Resend } from 'resend';

// Validates a feedback payload. Returns { ok:true, data } or { ok:false, error }.
export function validateFeedback(body = {}) {
  const {
    page = '', feedbackType = '', message = '',
    rating = null, userEmail = '', userName = '', timestamp = '',
  } = body;
  if (!message || !message.trim()) return { ok: false, error: 'message is required' };
  return {
    ok: true,
    data: {
      page: page || 'unknown',
      feedbackType: feedbackType || 'General Impression',
      message: message.trim(),
      rating: rating || null,
      userEmail,
      userName: userName || (userEmail.split('@')[0] || 'a beta tester'),
      timestamp: timestamp || new Date().toISOString(),
    },
  };
}

// Sends the feedback email via Resend. Throws on misconfig or send failure.
export async function sendFeedbackEmail(data) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_RECIPIENT_EMAIL;
  if (!apiKey || !to) throw new Error('RESEND_API_KEY and FEEDBACK_RECIPIENT_EMAIL must be set');

  const resend = new Resend(apiKey);
  const ratingLine = data.rating ? `Rating: ${data.rating}/5\n` : '';
  const subject = `🧪 Beta Feedback — ${data.feedbackType} on ${data.page}`;
  const text =
    `New feedback from ${data.userName} (${data.userEmail})\n\n` +
    `Page: ${data.page}\n` +
    `Type: ${data.feedbackType}\n` +
    ratingLine +
    `Submitted: ${data.timestamp}\n\n` +
    `---\n${data.message}\n`;

  const { error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to,
    subject,
    text,
  });
  if (error) throw new Error(error.message || 'Resend send failed');
}
