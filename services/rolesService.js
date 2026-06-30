import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { BETA_TESTERS } from '../constants/betaTesters';
import { resolveRole } from '../utils/resolveRole';

export { resolveRole };

// I/O wrapper: read users/{uid}; on any failure fall back to the hardcoded map.
export async function fetchUserRole(uid, email) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return resolveRole({
      firestoreRole: snap.exists() ? (snap.data().role ?? null) : undefined,
      fallbackMap: BETA_TESTERS,
      email,
      hasDoc: snap.exists(),
    });
  } catch (e) {
    console.warn('[rolesService] fetch failed, using fallback map:', e.message);
    return resolveRole({ firestoreRole: undefined, fallbackMap: BETA_TESTERS, email, hasDoc: false });
  }
}
