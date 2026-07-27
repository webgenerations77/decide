import { Resend } from 'resend';
import { getAdminDb } from '../firebaseAdmin.cjs';

// Pre-authorization for people who have NOT signed in yet.
//
// Roles live on users/{uid}, but a uid only exists after a Google sign-in — so an admin
// cannot grant a role to a stranger. An invite is keyed by EMAIL instead: it sits in
// betaInvites/{email} until that person signs in, at which point role resolution picks it
// up (services/rolesService.js). This is the dynamic replacement for the hardcoded
// constants/betaTesters.js map.
const COLLECTION = 'betaInvites';

export function normalizeEmail(raw) {
  return String(raw ?? '').trim().toLowerCase();
}

// Deliberately permissive — Google is the identity provider, so this only catches typos.
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function listInvites() {
  const snap = await getAdminDb().collection(COLLECTION).get();
  return snap.docs.map((d) => ({ email: d.id, ...d.data() }));
}

export async function createInvite({ email, role = 'beta_tester', invitedBy = null }) {
  const key = normalizeEmail(email);
  if (!isValidEmail(key)) throw new Error('invalid_email');
  await getAdminDb().collection(COLLECTION).doc(key).set(
    { email: key, role, invitedBy, invitedAt: Date.now(), status: 'pending' },
    { merge: true },
  );
  return key;
}

export async function deleteInvite(email) {
  const key = normalizeEmail(email);
  await getAdminDb().collection(COLLECTION).doc(key).delete();
  return key;
}

// Sends the invite via Resend. Throws on misconfig or send failure so the caller can
// report partial success — the invite row is written even when the email fails.
export async function sendInviteEmail({ email, invitedByName = 'The Decide team' }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY must be set');

  // Same verified-domain sender the feedback pipeline uses. The Resend sandbox address
  // only delivers to the account owner, so an unset value means testers get nothing.
  const from = process.env.FEEDBACK_FROM_EMAIL;
  if (!from) throw new Error('FEEDBACK_FROM_EMAIL must be set to a verified-domain sender');

  const appUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://decide.app';
  const resend = new Resend(apiKey);

  const text =
    `You're in.\n\n` +
    `${invitedByName} added you to the Decide beta — we plan your whole day for you: ` +
    `where to eat, what to do, in what order, drive times sorted.\n\n` +
    `Open Decide and tap "Continue with Google":\n${appUrl}\n\n` +
    `Important: sign in with THIS email address (${email}) or we won't recognise you.\n\n` +
    `First time in, we'll ask a few quick questions to learn your taste. Takes two minutes.\n\n` +
    `— The Decide team\n`;

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "You're in — welcome to the Decide beta 🧭",
    text,
  });
  if (error) throw new Error(error.message || 'Resend send failed');
}
