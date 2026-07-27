import { listUsersWithRoles, setUserRole, setUserDisabled, findUserByEmail } from './users.js';
import { listInvites, createInvite, deleteInvite, sendInviteEmail, normalizeEmail, isValidEmail } from './invites.js';

// Shared request logic for /api/admin/users, used by BOTH twins (the Vercel handler in
// api/admin/users.js and the Expo route in app/api/admin/users+api.js). Keeping it here
// means a change lands in both at once — the twins only translate req/res shapes.
//
// Everything hangs off this one endpoint because api/ is at 11 of Vercel's 12-function
// cap; adding a file there freezes prod (see CLAUDE.md).

// GET: ?data=invites → pending invites. Everything else stays as it was.
export async function handleGet({ uid, data }) {
  if (data === 'invites') {
    return { status: 200, body: { invites: await listInvites() } };
  }
  return null; // caller handles the existing uid/stats/history/list branches
}

// POST actions. No `action` field falls through to the legacy { uid, role } contract so
// the existing dashboard role toggle keeps working untouched.
export async function handlePost(body = {}, ctx = {}) {
  const action = body.action;

  if (!action) {
    if (!body.uid) return { status: 400, body: { error: 'uid_required' } };
    await setUserRole(body.uid, body.role);
    return { status: 200, body: { ok: true } };
  }

  switch (action) {
    case 'invite': {
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) return { status: 400, body: { error: 'invalid_email' } };

      await createInvite({ email, role: body.role || 'beta_tester', invitedBy: ctx.adminEmail ?? null });

      // If they already have an account, apply the role immediately — no need to wait
      // for a sign-in that already happened.
      const existing = await findUserByEmail(email);
      if (existing) await setUserRole(existing.uid, body.role || 'beta_tester');

      // The invite row is already written, so a send failure is partial success, not total.
      // Report it rather than rolling back — the admin can resend without re-inviting.
      let emailed = false;
      let emailError = null;
      if (body.sendEmail !== false) {
        try {
          await sendInviteEmail({ email, invitedByName: ctx.adminName || 'The Decide team' });
          emailed = true;
        } catch (e) {
          emailError = e.message;
        }
      }
      return { status: 200, body: { ok: true, email, existingUser: !!existing, emailed, emailError } };
    }

    case 'resend': {
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) return { status: 400, body: { error: 'invalid_email' } };
      try {
        await sendInviteEmail({ email, invitedByName: ctx.adminName || 'The Decide team' });
        return { status: 200, body: { ok: true, emailed: true } };
      } catch (e) {
        return { status: 502, body: { error: 'send_failed', message: e.message } };
      }
    }

    // Revoke beta access AND block sign-in. Reversible via 'enable'; account and
    // history are left intact.
    case 'remove': {
      const email = body.email ? normalizeEmail(body.email) : null;
      let uid = body.uid ?? null;
      if (!uid && email) {
        const found = await findUserByEmail(email);
        uid = found?.uid ?? null;
      }
      if (email) await deleteInvite(email);
      if (uid) {
        await setUserRole(uid, null);
        await setUserDisabled(uid, true);
      }
      if (!uid && !email) return { status: 400, body: { error: 'uid_or_email_required' } };
      return { status: 200, body: { ok: true, uid, email, accountDisabled: !!uid } };
    }

    case 'enable': {
      if (!body.uid) return { status: 400, body: { error: 'uid_required' } };
      await setUserDisabled(body.uid, false);
      if (body.role) await setUserRole(body.uid, body.role);
      return { status: 200, body: { ok: true } };
    }

    case 'deleteInvite': {
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) return { status: 400, body: { error: 'invalid_email' } };
      await deleteInvite(email);
      return { status: 200, body: { ok: true, email } };
    }

    default:
      return { status: 400, body: { error: 'unknown_action', action } };
  }
}

export { listUsersWithRoles };
