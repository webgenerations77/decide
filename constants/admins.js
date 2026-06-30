// Authorized admins, keyed by LOWERCASED email → role.
// Admin gating is synchronous and hardcoded on purpose (never a network read).
// Add an admin by adding one line here; never compare an email literal elsewhere.
export const ADMINS = {
  'webgenerations77@gmail.com': 'admin',
};
