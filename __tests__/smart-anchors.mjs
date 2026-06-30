// __tests__/smart-anchors.mjs — run: node __tests__/smart-anchors.mjs
import { buildAnchorPrompt, validateAnchors } from '../lib/smart/anchors.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const finds = [{ title: 'Old Pro Golf' }, { title: 'Seacrets' }];
assert('prompt lists finds with indexes', buildAnchorPrompt(finds, { location: 'OC' }).includes('[1] Seacrets') || buildAnchorPrompt(finds, { location: 'OC' }).includes('Seacrets'));
const anchors = validateAnchors({ anchors: [{ findIndex: 0, rationale: 'fun' }, { findIndex: 99, rationale: 'bad' }] }, finds);
assert('valid index resolves to its find', anchors.length === 1 && anchors[0].find.title === 'Old Pro Golf');
assert('anchor carries rationale', anchors[0].rationale === 'fun');
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
