import { auth } from './firebase';

async function authHeader() {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getUsage(range = 'day') {
  const res = await fetch(`/api/admin/usage?range=${range}`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`usage_${res.status}`);
  return res.json();
}

export async function getUsers() {
  const res = await fetch('/api/admin/users', { headers: await authHeader() });
  if (!res.ok) throw new Error(`users_${res.status}`);
  return (await res.json()).users;
}

export async function setUserRole(uid, role) {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ uid, role }),
  });
  if (!res.ok) throw new Error(`set_role_${res.status}`);
  return res.json();
}

// ─── Beta invites ─────────────────────────────────────────────────────────────
// All of these POST to /api/admin/users with an `action` — api/ sits at 11 of Vercel's
// 12-function cap, so new capability rides on the existing endpoint (see CLAUDE.md).
async function adminAction(body, label) {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || json.error || `${label}_${res.status}`);
  return json;
}

export async function getInvites() {
  const res = await fetch('/api/admin/users?data=invites', { headers: await authHeader() });
  if (!res.ok) throw new Error(`invites_${res.status}`);
  return (await res.json()).invites;
}

// Returns { ok, email, existingUser, emailed, emailError } — `emailed:false` with an
// `emailError` means the invite was saved but the email did not go out.
export async function inviteUser(email, { sendEmail = true } = {}) {
  return adminAction({ action: 'invite', email, sendEmail }, 'invite');
}

export async function resendInvite(email) {
  return adminAction({ action: 'resend', email }, 'resend');
}

// Revokes the beta role AND disables sign-in. Reversible via enableUser().
export async function removeUser({ uid = null, email = null }) {
  return adminAction({ action: 'remove', uid, email }, 'remove');
}

export async function enableUser(uid, role = null) {
  return adminAction({ action: 'enable', uid, role }, 'enable');
}

export async function deleteInvite(email) {
  return adminAction({ action: 'deleteInvite', email }, 'delete_invite');
}

export async function getUserStats(uid) {
  const res = await fetch(`/api/admin/users?uid=${encodeURIComponent(uid)}`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`user_stats_${res.status}`);
  return res.json();
}

export async function getUserHistory(uid) {
  const res = await fetch(`/api/admin/users?uid=${encodeURIComponent(uid)}&data=history`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`user_history_${res.status}`);
  return res.json(); // { itineraries, decisions }
}

