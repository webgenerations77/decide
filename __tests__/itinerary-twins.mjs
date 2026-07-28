// __tests__/itinerary-twins.mjs — run: node __tests__/itinerary-twins.mjs
//
// The itinerary handler exists TWICE: api/itinerary.js (Vercel, req/res) and
// app/api/itinerary+api.js (Expo dev, Request/Response). CLAUDE.md and
// docs/transport-open-questions.md both call keeping them in sync load-bearing, and it is the
// single most-repeated warning in this repo — because the failure is silent. Drift does not throw:
// it produces a feature that works in dev and is quietly missing in production, or a fix that only
// half-lands. That class of bug has shipped here before.
//
// Nothing enforced it until now. This does — structurally, not by diffing the files, because they
// are legitimately written in different styles (one minified-ish, one spread out) and a
// whole-file comparison would be noise.
//
// WHEN THIS FAILS: you changed one twin and not the other. Change both. If the asymmetry is
// deliberate, add it to KNOWN_ASYMMETRIC with a reason — do not delete the assertion.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROD = path.join(here, '..', 'api', 'itinerary.js');
const DEV = path.join(here, '..', 'app', 'api', 'itinerary+api.js');

let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const prod = fs.readFileSync(PROD, 'utf8');
const dev = fs.readFileSync(DEV, 'utf8');

console.log('itinerary twins — behaviour that must exist in BOTH');

// Each entry is a capability that would silently vanish from production (or from dev) if only one
// file were edited. Kept deliberately small: these are load-bearing behaviours, not every line.
const MIRRORED = [
  ['folds in the clarify mode branch',        /mode === 'clarify'/],
  ['folds in the transport-leg mode branch',  /mode === 'transport-leg'/],
  ['runs the smart engine',                   /runSmartEngine\(/],
  // Scoped to the CALL, not the file. A bare /startedAt/ passed even with the argument deleted,
  // because the token still appears where the timer is created and where duration is logged —
  // a marker loose enough to survive the drift it exists to catch is worse than none.
  ['passes startedAt INTO the smart engine',  /runSmartEngine\(\{[\s\S]{0,600}?startedAt/],
  ['starts the wall-clock before work begins', /const startedAt = Date\.now\(\)/],
  ['marks the start so a dead request is countable', /model: 'generation-start'/],
  ['records wall-clock duration on success',  /model: 'generation', durationMs/],
  ['falls back locally when the engine returns nothing', /buildFallbackItinerary\(/],
  ['annotates leg distances',                 /annotateRoute\(/],
  ['builds transport with the getting-around constraint', /buildTransport\(/],
  ['clamps the search radius before Places',  /clampSearchMiles\(/],
];

for (const [label, re] of MIRRORED) {
  const inProd = re.test(prod);
  const inDev = re.test(dev);
  assert(label, inProd && inDev, `prod=${inProd} dev=${inDev}`);
}

console.log('\npreferences destructured identically');

// The highest-risk drift surface: a preference read by one twin and ignored by the other means a
// setting that silently does nothing in production.
const prefKeys = (src) => {
  const m = src.match(/const \{([^}]*)\} = preferences/);
  if (!m) return null;
  return new Set(
    m[1].split(',')
      .map((s) => s.split('=')[0].trim())
      .filter(Boolean)
      .sort(),
  );
};

const pProd = prefKeys(prod);
const pDev = prefKeys(dev);
assert('both twins destructure preferences', !!pProd && !!pDev);

// `sensitivities` is destructured by the dev twin and never referenced again — a dead binding, not
// a behavioural difference. Allergen handling is client-side (StopCard's `sensitivities` prop).
// Listed rather than silently tolerated so a NEW asymmetry still fails this test.
const KNOWN_ASYMMETRIC = new Set(['sensitivities']);

const onlyProd = [...(pProd ?? [])].filter((k) => !pDev?.has(k) && !KNOWN_ASYMMETRIC.has(k));
const onlyDev = [...(pDev ?? [])].filter((k) => !pProd?.has(k) && !KNOWN_ASYMMETRIC.has(k));

assert('no preference read only by the prod twin', onlyProd.length === 0, onlyProd.join(', '));
assert('no preference read only by the dev twin', onlyDev.length === 0, onlyDev.join(', '));

// Guard the exception itself: if `sensitivities` ever starts being USED in dev, it stops being a
// harmless dead binding and becomes real drift that this allowance would hide.
const devUses = (dev.match(/sensitivities/g) || []).length;
assert('the one allowed asymmetry is still an unused binding', devUses <= 1, `${devUses} references`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
