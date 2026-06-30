import admin from 'firebase-admin';

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
  app = admin.apps.length
    ? admin.apps[0]
    : admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export function getAdminAuth() { return admin.auth(getApp()); }
export function getAdminDb()   { return admin.firestore(getApp()); }
