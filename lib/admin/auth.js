import { extractBearer } from './requireAdmin.js';
import { getAdminAuth } from '../firebaseAdmin.cjs';

// Best-effort identity extraction for otherwise-public endpoints. Verifies the
// Firebase ID token and returns its uid, or null on any miss. Never throws —
// callers use it for usage attribution only and must not reject on failure.
export async function getUidFromAuth(authHeader) {
  const token = extractBearer(authHeader);
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded?.uid ?? null;
  } catch {
    return null;
  }
}

/**
 * Identity for endpoints that must REJECT an unverified caller, not merely attribute it.
 *
 * Returns { uid, email } or null. Separate from getUidFromAuth because the two have opposite
 * failure contracts and collapsing them would be a security bug waiting to happen: that one is
 * documented as never-rejecting and is used for log attribution, so quietly giving it a
 * throw/reject behaviour would change every caller at once. The email is needed for the admin
 * exemption in lib/apiQuota.js, which reads the same constants/admins.js the client does.
 */
export async function getAuthIdentity(authHeader) {
  const token = extractBearer(authHeader);
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (!decoded?.uid) return null;
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}
