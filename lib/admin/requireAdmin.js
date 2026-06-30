import { ADMINS } from '../../constants/admins.js';
import { getAdminAuth } from '../firebaseAdmin.cjs';

export function extractBearer(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const m = headerValue.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function decideAdmin(decodedToken) {
  const email = decodedToken?.email?.toLowerCase?.().trim();
  if (email && ADMINS[email]) return { ok: true, email };
  return { ok: false, status: 403, error: 'not_admin' };
}

export async function verifyAdminRequest(authHeader) {
  const token = extractBearer(authHeader);
  if (!token) return { ok: false, status: 401, error: 'missing_token' };
  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(token);
  } catch (e) {
    if (e.message === 'firebase_admin_unconfigured') return { ok: false, status: 500, error: 'admin_unconfigured' };
    return { ok: false, status: 401, error: 'invalid_token' };
  }
  return decideAdmin(decoded);
}
