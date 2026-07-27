import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { BETA_TESTERS } from '../constants/betaTesters';
import { resolveRole } from '../utils/resolveRole';

export { resolveRole };

// Reads the pending invite an admin created before this person ever signed in
// (betaInvites/{email}, written by lib/admin/invites.js). Returns null on any failure.
//
// REQUIRES a Firestore rule letting a signed-in user read ONLY their own invite:
//   match /betaInvites/{inviteEmail} {
//     allow get: if request.auth != null && request.auth.token.email == inviteEmail;
//   }
// Without it this read is denied and we fall through to the hardcoded map — the invite
// simply won't take effect, so the failure is quiet rather than breaking sign-in.
async function fetchInviteRole(email) {
  const key = email?.toLowerCase?.().trim();
  if (!key) return null;
  try {
    const snap = await getDoc(doc(db, 'betaInvites', key));
    return snap.exists() ? (snap.data().role ?? null) : null;
  } catch {
    return null;
  }
}

// I/O wrapper: read users/{uid}; with no doc, check for a pending invite; on any
// failure fall back to the hardcoded map.
export async function fetchUserRole(uid, email) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return resolveRole({
        firestoreRole: snap.data().role ?? null,
        fallbackMap: BETA_TESTERS,
        email,
        hasDoc: true,
      });
    }
    // No doc yet — an invite created before their first sign-in wins over the seed map.
    const invited = await fetchInviteRole(email);
    if (invited) return invited;
    return resolveRole({ firestoreRole: undefined, fallbackMap: BETA_TESTERS, email, hasDoc: false });
  } catch (e) {
    console.warn('[rolesService] fetch failed, using fallback map:', e.message);
    return resolveRole({ firestoreRole: undefined, fallbackMap: BETA_TESTERS, email, hasDoc: false });
  }
}
