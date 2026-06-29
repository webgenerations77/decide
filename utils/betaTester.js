import { BETA_TESTERS } from '../constants/betaTesters';

// Beta role for a Firebase user, or null. Email match is lowercased + trimmed.
export function getRole(user) {
  const email = user?.email?.toLowerCase?.().trim();
  if (!email) return null;
  return BETA_TESTERS[email] || null;
}

export function isBetaTester(user) {
  return getRole(user) === 'beta_tester';
}
