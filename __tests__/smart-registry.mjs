import { selectSources, matchesInterest, INTEREST_OSM_TAGS } from '../lib/smart/sourceRegistry.js';

let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

assert('pinball matches the pinball source', selectSources('pinball').some((s) => s.key === 'pinball'));
assert('arcades resolves to overpass via OSM tag', !!INTEREST_OSM_TAGS['arcades'] && selectSources('arcades').some((s) => s.key === 'overpass'));
assert('match is fuzzy/case-insensitive', matchesInterest({ match: ['pinball'] }, 'PINBALL machines'));
assert('unknown interest falls back to search', selectSources('underwater basket weaving').length === 1 && selectSources('underwater basket weaving')[0].key === 'search');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
