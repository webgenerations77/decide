import { getAdminAuth, getAdminDb } from '../firebaseAdmin.js';
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
