// Authorized beta testers, keyed by LOWERCASED email → role.
// Add a tester by adding one line here, OR list their email in the EXPO_PUBLIC_BETA_TESTER_EMAILS
// env var (comma-separated) when you'd rather not commit their address to source. All gating is
// role-based (see utils/betaTester.js); never compare against an email literal anywhere else in the app.
const envTesterEmails = (process.env.EXPO_PUBLIC_BETA_TESTER_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const BETA_TESTERS = {
  'dwaynephil@gmail.com': 'beta_tester',
  'thecindycooley@gmail.com': 'beta_tester',
  'test@frank.com': 'beta_tester',  // internal QA test account (creds in .env: TEST_ACCOUNT_*)
  ...Object.fromEntries(envTesterEmails.map((email) => [email, 'beta_tester'])),
};
