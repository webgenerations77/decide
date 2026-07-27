import { getAdminAuth, getAdminDb } from '../firebaseAdmin.cjs';
import { BETA_TESTERS } from '../../constants/betaTesters.js';

// List all Firebase users, merge their Firestore role, and lazily seed a users/{uid}
// doc for any hardcoded beta tester that has an account but no doc yet.
export async function listUsersWithRoles() {
  const db = getAdminDb();
  const { users } = await getAdminAuth().listUsers(1000);
  const out = [];
  for (const u of users) {
    const ref = db.collection('users').doc(u.uid);
    const snap = await ref.get();
    let role;
    if (snap.exists) {
      role = snap.data().role ?? null;
    } else {
      const seeded = BETA_TESTERS[u.email?.toLowerCase?.().trim()] || null;
      if (seeded) await ref.set({ email: u.email, role: seeded, status: 'active', updatedAt: Date.now() });
      role = seeded;
    }
    out.push({
      uid: u.uid,
      email: u.email || null,
      role,
      status: u.disabled ? 'disabled' : 'active',
      createdAt: u.metadata?.creationTime || null,
      lastSignIn: u.metadata?.lastSignInTime || null,
    });
  }
  return out;
}

// role must be 'beta_tester' (grant) or null (revoke).
export async function setUserRole(uid, role) {
  const value = role === 'beta_tester' ? 'beta_tester' : null;
  await getAdminDb().collection('users').doc(uid)
    .set({ role: value, updatedAt: Date.now() }, { merge: true });
}

// Blocks/unblocks sign-in without destroying the account or its history. Reversible:
// re-enabling restores access with everything intact.
export async function setUserDisabled(uid, disabled) {
  await getAdminAuth().updateUser(uid, { disabled: !!disabled });
  await getAdminDb().collection('users').doc(uid)
    .set({ status: disabled ? 'disabled' : 'active', updatedAt: Date.now() }, { merge: true });
}

// Look up a Firebase account by email. Returns null when they've never signed in —
// which is the normal case for a fresh invite.
export async function findUserByEmail(email) {
  try {
    const u = await getAdminAuth().getUserByEmail(String(email).trim().toLowerCase());
    return { uid: u.uid, email: u.email, disabled: u.disabled };
  } catch {
    return null;
  }
}
