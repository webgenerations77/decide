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

// Defensive normalization for FIREBASE_PRIVATE_KEY. The value is easy to mangle when
// pasted into a host's env UI (e.g. Vercel): people commonly include the surrounding
// quotes from the service-account JSON, or the \n escapes get double-escaped. Any of
// these reaches jwt.sign() as a non-PEM string and fails with
// "secretOrPrivateKey must be an asymmetric key when using RS256". Strip wrapping
// quotes, collapse double-escaped newlines, then turn \n escapes into real newlines.
function normalizePrivateKey(raw) {
  let k = (raw || '').trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1);
  }
  return k.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
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
