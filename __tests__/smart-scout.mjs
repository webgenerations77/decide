// __tests__/smart-scout.mjs — run: node __tests__/smart-scout.mjs
import { buildScoutPrompt, validateHunts } from '../lib/smart/scout.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const ctx = { location: 'Ocean City, MD', prefs: { activityStyles: ['arcades'], cuisines: [] }, tripNote: 'we love pinball' };
const prompt = buildScoutPrompt(ctx);
assert('prompt includes the trip note', prompt.includes('pinball'));
assert('prompt includes location', prompt.includes('Ocean City, MD'));

const hunts = validateHunts({ hunts: [
  { interest: 'pinball', why: 'mentioned', priority: 9, suggestedQuery: 'pinball ocean city' },
  { bogus: true },
] });
assert('validateHunts keeps valid, drops invalid', hunts.length === 1 && hunts[0].interest === 'pinball');
assert('validateHunts coerces priority to number', typeof hunts[0].priority === 'number');
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
