// lib/firstLogin.js — pure helpers for the first-login / beta-guide routing decisions
// made in app/_layout.js. Kept pure + framework-free so they're easy to unit test.

// Internal QA account: always treated as a brand-new user on login so the full
// onboarding -> beta guide -> home flow can be retested repeatedly.
export const QA_RESET_EMAIL = 'test@frank.com';

export function isQaResetAccount(email) {
  return (email || '').trim().toLowerCase() === QA_RESET_EMAIL;
}

// Should a beta tester/admin be sent to /beta-guide right now, given the two
// AsyncStorage flags read in app/_layout.js?
export function shouldShowBetaGuide({ onboarded, guideAlways }) {
  if (onboarded !== 'true') return false;
  if (guideAlways === 'false') return false;
  return true;
}
