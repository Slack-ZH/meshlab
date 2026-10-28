// Browser-test fixture, served only by a Playwright route. Never included in dist.
let callback, auth = { currentUser: null };
const notify = () => callback?.(auth.currentUser);
export const initializeApp = c => c;
export const getAuth = () => auth;
export const onIdTokenChanged = (a, cb) => { callback = cb; queueMicrotask(notify); };
export async function signInWithEmailAndPassword(a, email, password) {
  if (password === 'wrong') throw Object.assign(new Error('bad login'), { code: 'auth/invalid-credential' });
  auth.currentUser = { uid: email, email, emailVerified: true }; notify(); return { user: auth.currentUser };
}
export async function createUserWithEmailAndPassword(a, email) {
  auth.currentUser = { uid: email, email, emailVerified: false }; notify(); return { user: auth.currentUser };
}
export async function sendEmailVerification() { window.__verificationSent = true; }
export async function sendPasswordResetEmail() { window.__resetSent = true; }
export async function signOut() { auth.currentUser = null; notify(); }
export async function reload(user) { user.emailVerified = Boolean(window.__emailVerified); }
export async function getIdToken() { return 'test-id-token'; }
