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
