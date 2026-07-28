// __tests__/project-invariants.mjs — run: node __tests__/project-invariants.mjs
//
// CLAUDE.md's load-bearing claims, made executable.
//
// WHY THIS EXISTS: in one session that doc produced three confidently-wrong claims — that
// per-stop feedback reached the synthesis prompt (it was written and never read), that the
// transport reach warning was accurate in a metro (it fired on subway rides), and that
// cross-device history delete did not exist (it was fully built). Each was plausible, each cost
// real time, and each was the kind of thing nobody re-checks because it is written down.
//
// A rule worth writing in a doc is usually worth asserting. These are the claims where a
// violation causes a real bug rather than a style nit, so each assertion names the consequence.
//
// ⚠ WHEN ONE FAILS, the doc and the code disagree. Decide which is right and fix THAT — do not
// weaken the assertion to make it pass.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

const read = (p) => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return null; } };
const exists = (p) => fs.existsSync(path.join(ROOT, p));

/** Every .js under a directory, recursively, skipping build output and deps. */
function walk(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else if (e.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

/**
 * Strip comments so a rule about USER-FACING COPY isn't tripped by a comment discussing the rule.
 * `//` is only treated as a comment when not preceded by `:`, so URLs survive. Imperfect by
 * design — it under-reports rather than failing spuriously, because a flaky invariant test gets
 * disabled and then protects nothing.
 */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const CLIENT_DIRS = ['components', 'screens', 'app'];
const clientFiles = CLIENT_DIRS.flatMap((d) => walk(d)).filter((f) => !f.includes(`api${path.sep}`));

console.log('Vercel deploy limits');
// Hit for real on 2026-07-01: batch-4 added 2 files, 13 > 12, and prod froze.
const apiFiles = walk('api');
assert(`api/ holds at most 12 functions (Hobby cap) — found ${apiFiles.length}`,
  apiFiles.length <= 12, 'a 13th file freezes production deploys');

console.log('\nmirrored API twins');
// Drift does not throw; it ships a feature that works in dev and is missing in production.
for (const f of apiFiles) {
  const rel = f.replace(/^api[\\/]/, '').replace(/\.js$/, '');
  assert(`api/${rel}.js has its dev twin`, exists(path.join('app', 'api', `${rel}+api.js`)),
    'a handler that exists on only one side behaves differently in dev and prod');
}

console.log('\nmodule singletons anchored on globalThis');
// This project bundles the same module twice across the ESM/CJS boundary. A plain module-level
// singleton gets one copy per graph: usageContext logged every request as anonymous, and the
// transport cache would silently double API spend.
for (const [file, what] of [['lib/usageContext.js', 'request-scoped user id'], ['lib/transport/routes.js', 'transport cache']]) {
  const src = read(file);
  assert(`${what} is anchored on globalThis`, !!src && /globalThis\./.test(src),
    'a second module copy gets its own state');
}
assert('firebaseAdmin stays CommonJS', exists('lib/firebaseAdmin.cjs'),
  'the ESM subpath entries split firebase-admin across two graphs and every authed call throws');

console.log('\nnative modules go through their service wrapper');
// Importing expo-haptics directly bypasses the user's haptics toggle AND the web fallback.
const rawHaptics = [...clientFiles, ...walk('services')]
  .filter((f) => !f.endsWith(path.join('services', 'hapticsService.js')))
  .filter((f) => /from ['"]expo-haptics['"]/.test(read(f) ?? ''));
assert('expo-haptics is only imported by hapticsService', rawHaptics.length === 0,
  rawHaptics.join(', ') + ' — bypasses the settings toggle and the web fallback');

console.log('\nmobile-web modal rule');
// "slide" applies a transform, which traps position:fixed and makes overlays drift on mobile web.
const sliders = clientFiles.filter((f) => /animationType=["']slide["']/.test(read(f) ?? ''));
assert('no Modal uses animationType="slide"', sliders.length === 0,
  sliders.join(', ') + ' — its transform traps position:fixed');

console.log('\ntheme tokens');
// A literal hex cannot respond to the light/dark switch, so it survives as a wrong colour.
const hexOffenders = clientFiles.filter((f) => /(['"])#[0-9a-fA-F]{3,8}\1/.test(stripComments(read(f) ?? '')));
assert('no hardcoded hex in client components', hexOffenders.length === 0,
  hexOffenders.join(', ') + ' — must come from constants/theme.js');

console.log('\nuser-facing copy');
// The persona is internal and the product is not ready to be described as AI-powered.
//
// ⚠ ONE DOCUMENTED EXCEPTION. app/terms.js discloses "AI-assisted recommendations" because a
// Terms of Service has to describe the service accurately. Forcing vagueness into legal text to
// satisfy a branding rule is the wrong trade — a reader deciding whether to accept the terms is
// entitled to know how recommendations are produced. The rule still binds everywhere else, and
// this list is deliberately one file long: if it grows, the rule is being eroded rather than
// excepted.
const COPY_EXEMPT = new Map([['AI', [path.join('app', 'terms.js')]]]);

const forbidden = [[/\bCheddar\b/, 'Cheddar'], [/\b(AI|artificial intelligence)\b/i, 'AI']];
for (const [re, label] of forbidden) {
  const exempt = COPY_EXEMPT.get(label) ?? [];
  const offenders = clientFiles.filter((f) => {
    if (exempt.includes(f)) return false;
    const src = stripComments(read(f) ?? '');
    // Only inside string literals — a variable or import named this way is not shown to anyone.
    const strings = src.match(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g) ?? [];
    return strings.some((s) => re.test(s) && !/openai|['"`]ai['"`]/i.test(s));
  });
  assert(`"${label}" never appears in client-side copy`, offenders.length === 0, offenders.join(', '));
}
assert('the copy exemption list stays a documented handful, not a loophole',
  [...COPY_EXEMPT.values()].flat().length <= 2);
// An exemption for a file that no longer says it is dead weight that hides a future regression.
for (const [label, files] of COPY_EXEMPT) {
  for (const f of files) {
    assert(`the "${label}" exemption for ${f} is still needed`,
      new RegExp(`\\b${label}\\b`, 'i').test(read(f) ?? ''),
      'remove the exemption rather than leaving a hole open');
  }
}

console.log('\nthe PWA is the shipping product');
// app.json's icon/splash are consumed by EAS and are invisible to the installed web app.
assert('web output is "single"', /"output"\s*:\s*"single"/.test(read('app.json') ?? ''),
  'app/+html.js only applies to static/server output');
assert('app/+html.js is absent', !exists('app/+html.js'),
  'it is silently ignored under output:"single" — head tags belong in public/index.html');
assert('PWA manifest exists', exists('public/manifest.json'), 'the installed app has no icons without it');
assert('PWA icons directory exists', exists('public/icons'), 'manifest references would 404');
assert('the icon generator the docs tell you to run exists', exists('scripts/generate-icons.js'),
  'CLAUDE.md instructs running it');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
