import { selectSources } from '../lib/smart/sourceRegistry.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);
assert('breweries → brewery source', selectSources('breweries').some((s) => s.key === 'brewery'));
assert('surf → surf source', selectSources('surf').some((s) => s.key === 'surf'));
assert('tides → tides source', selectSources('tides').some((s) => s.key === 'tides'));
assert('sunset → goldenhour source', selectSources('sunset').some((s) => s.key === 'goldenhour'));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
