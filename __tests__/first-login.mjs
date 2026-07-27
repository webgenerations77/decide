// __tests__/first-login.mjs — run: node __tests__/first-login.mjs
// Verifies the pure routing helpers behind app/_layout.js's first-login + beta-guide flow.
import { isQaResetAccount, shouldShowBetaGuide } from '../lib/firstLogin.js';

let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

console.log('\nisQaResetAccount:');
assert('exact match → true', isQaResetAccount('test@frank.com') === true);
assert('different case → true', isQaResetAccount('Test@Frank.com') === true);
assert('surrounding whitespace → true', isQaResetAccount('  test@frank.com  ') === true);
assert('other tester → false', isQaResetAccount('dwaynephil@gmail.com') === false);
assert('null → false', isQaResetAccount(null) === false);
assert('undefined → false', isQaResetAccount(undefined) === false);

console.log('\nshouldShowBetaGuide:');
assert('onboarded + always unset → show', shouldShowBetaGuide({ onboarded: 'true', guideAlways: null }) === true);
assert('onboarded + always true → show', shouldShowBetaGuide({ onboarded: 'true', guideAlways: 'true' }) === true);
assert('onboarded + always false → hidden', shouldShowBetaGuide({ onboarded: 'true', guideAlways: 'false' }) === false);
assert('not onboarded yet → hidden', shouldShowBetaGuide({ onboarded: null, guideAlways: null }) === false);
assert('onboarded false string → hidden', shouldShowBetaGuide({ onboarded: 'false', guideAlways: null }) === false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
