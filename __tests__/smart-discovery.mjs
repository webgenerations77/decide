// __tests__/smart-discovery.mjs — run: node __tests__/smart-discovery.mjs
import { normalizeFind, dedupeFinds, discoveryCacheKey } from '../api/smart/discovery.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const f = normalizeFind({ title: 'X', interest: 'pinball', sourceLabel: 'Pinball Map' });
assert('normalizeFind fills defaults', f.category === 'activity' && f.lat === null && f.url === '');
const deduped = dedupeFinds([{ title: 'Joe Pizza', sourceLabel: 'a' }, { title: 'joe pizza', sourceLabel: 'b' }]);
assert('dedupeFinds collapses by title (case-insensitive)', deduped.length === 1);
assert('cache key includes interest hash', discoveryCacheKey('Ocean City', ['pinball']) !== discoveryCacheKey('Ocean City', ['surf']));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
