import { ADMINS } from '../constants/admins.js';

// Admin role for a Firebase user, or null. Email match is lowercased + trimmed.
export function getAdminRole(user) {
  const email = user?.email?.toLowerCase?.().trim();
  if (!email) return null;
  return ADMINS[email] || null;
}

export function isAdmin(user) {
  return getAdminRole(user) === 'admin';
}
