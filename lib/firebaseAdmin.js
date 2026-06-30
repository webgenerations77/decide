import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function normalizePrivateKey(raw) {
  return (raw || '').replace(/\\n/g, '\n');
}

let app = null;

function getApp() {
  if (app) return app;
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('firebase_admin_unconfigured');
  }
  // Use the modular app API: the legacy `admin.apps` namespace is undefined when
  // firebase-admin v14 is imported as an ESM default, which crashes `.length`.
  const existing = getApps();
  app = existing.length
    ? existing[0]
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export function getAdminAuth() { return getAuth(getApp()); }
export function getAdminDb()   { return getFirestore(getApp()); }
