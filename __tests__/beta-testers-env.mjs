// __tests__/beta-testers-env.mjs — run: node __tests__/beta-testers-env.mjs
// Verifies EXPO_PUBLIC_BETA_TESTER_EMAILS grants beta_tester without editing constants/betaTesters.js.
process.env.EXPO_PUBLIC_BETA_TESTER_EMAILS = ' Someone@Example.com , other@example.com,';

const { BETA_TESTERS } = await import('../constants/betaTesters.js');

let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

assert('env email is granted beta_tester (lowercased + trimmed)',
  BETA_TESTERS['someone@example.com'] === 'beta_tester');
assert('multiple env emails are all granted',
  BETA_TESTERS['other@example.com'] === 'beta_tester');
assert('hardcoded testers are unaffected',
  BETA_TESTERS['dwaynephil@gmail.com'] === 'beta_tester');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
