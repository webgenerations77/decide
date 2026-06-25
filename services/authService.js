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

const ALLOWED_EMAILS = [
  'webgenerations77@gmail.com',
  'thecindycooley@gmail.com',
];

function checkAllowed(email) {
  if (!ALLOWED_EMAILS.includes(email.toLowerCase())) {
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
  if (!ALLOWED_EMAILS.includes(result.user.email.toLowerCase())) {
    await firebaseSignOut(auth);
    throw { code: 'auth/unauthorized', message: 'Sign-ups are currently limited to invited users only.' };
  }
  return result;
}
