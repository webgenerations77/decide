import { createRequire } from 'node:module';

// firebase-admin is a stateful CJS package. Importing it through its ESM subpath
// entry points (firebase-admin/app, /auth, /firestore) makes Node load its internals
// into BOTH the ESM and CJS module graphs under Vercel's serverless function loader,
// producing two separate FirebaseApp registries. The app then gets created in one
// graph while the credential/token machinery runs in the other, so
// app.INTERNAL.getToken() returns undefined and every authenticated call (Auth
// listUsers, Firestore reads/writes) throws "Cannot read properties of undefined
// (reading 'then')". verifyIdToken keeps working because it only needs Google's
// public certs, not an access token — which is why auth *appeared* configured.
// Loading the single CJS instance via createRequire keeps everything in one graph.
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

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
  try {
    app = admin.app(); // reuse the default app if it already exists
  } catch {
    app = admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  }
  return app;
}

export function getAdminAuth() { return admin.auth(getApp()); }
export function getAdminDb()   { return admin.firestore(getApp()); }
