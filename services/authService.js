import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { auth } from './firebase';
import { BETA_TESTERS } from '../constants/betaTesters';
import { ADMINS } from '../constants/admins';

// Gmail treats "." and "+tag" in the local part as insignificant, and googlemail.com == gmail.com.
// A Google account whose email is stored as e.g. "dwayne.phil@gmail.com" is the SAME inbox as the
// invited "dwaynephil@gmail.com" but a different STRING — a raw Set match locked those testers out
// after a successful sign-in. Normalize both the allowlist and the incoming email so they compare
// by identity, not by exact spelling.
function normalizeEmail(email) {
  const e = (email || '').toLowerCase().trim();
  const at = e.lastIndexOf('@');
  if (at < 0) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.split('+')[0].replace(/\./g, '');
  return `${local}@${domain}`;
}

// Sign-in / sign-up allowlist = every invited beta tester + every admin. Derived from the single
// sources of truth (constants/betaTesters.js, constants/admins.js) so it can never drift out of
// sync — a hand-maintained copy here previously locked out beta testers who weren't also listed twice.
const ALLOWED_EMAILS = new Set(
  [...Object.keys(BETA_TESTERS), ...Object.keys(ADMINS)].map(normalizeEmail)
);

function isAllowed(email) {
  return !!email && ALLOWED_EMAILS.has(normalizeEmail(email));
}

function checkAllowed(email) {
  if (!isAllowed(email)) {
    throw { code: 'auth/unauthorized', message: 'Sign-ups are currently limited to invited users only.' };
  }
}

export function signUp(email, password) {
  checkAllowed(email);
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOut() {
  return firebaseSignOut(auth);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogleCredential(idToken) {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  if (!isAllowed(result.user.email)) {
    await firebaseSignOut(auth);
    throw { code: 'auth/unauthorized', message: 'This Google account isn\'t on the invite list yet.' };
  }
  return result;
}
