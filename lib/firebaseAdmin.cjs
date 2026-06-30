// CommonJS on purpose. firebase-admin is a stateful package: importing it through
// its ESM subpath entry points (firebase-admin/app, /auth, /firestore) made Vercel's
// serverless loader instantiate its internals in BOTH the ESM and CJS module graphs,
// so the FirebaseApp got created in one graph while the credential/token machinery ran
// in the other — app.INTERNAL.getToken() returned undefined and every authenticated
// call threw "Cannot read properties of undefined (reading 'then')". Using
// createRequire() forced a single graph but wasn't seen by Vercel's static file tracer,
// so firebase-admin failed to load at runtime. A real .cjs module with a static
// require('firebase-admin') is both single-graph AND traceable.
const admin = require('firebase-admin');

function normalizePrivateKey(raw) {
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

function getAdminAuth() { return admin.auth(getApp()); }
function getAdminDb()   { return admin.firestore(getApp()); }

module.exports = { normalizePrivateKey, getAdminAuth, getAdminDb };
