#!/usr/bin/env node
/**
 * Build the embeddable Cert to Table trailer for Decide's loading screen.
 *
 *   node scripts/build-house-ad.js
 *
 * WHY THIS EXISTS: the published trailer is a 3.1MB self-contained page built to be watched
 * deliberately — landscape, fullscreen, with a voiceover, behind a tap gate, running ~81
 * seconds. Decide's loading screen is portrait, silent, and lasts about 45. Dropping the
 * original into an iframe would show a "Tap to play / Rotate to landscape" card and nothing
 * else. This script derives an EMBED CUT that plays on its own, silently, and finishes.
 *
 * WHAT IT CHANGES, and why each one is load-bearing:
 *   1. Keeps the voiceover for the six surviving scenes and drops the other five (0.60MB of
 *      narration for scenes nobody reaches).
 *   2. Starts the synthesised score. It costs no bytes — it is generated live in the browser.
 *   3. Trims 11 scenes to 6 (~35s) so the CLOSING CTA actually lands inside the wait. The full
 *      cut reached scene 7 of 11 before the plan arrived — the payoff never played.
 *   4. Drops the five screenshots only the cut scenes used.
 *   5. Loops instead of ending on a replay card.
 *   6. Auto-starts, with no tap gate, no fullscreen request and no orientation lock.
 *
 * ⚠ EVERY REPLACEMENT IS ASSERTED. If the upstream trailer is republished with different
 * code, this script FAILS LOUDLY rather than silently emitting a broken or silent-black ad.
 * That is the entire point of generating it instead of hand-editing a 3MB file.
 *
 * The output is committed (public/ is copied verbatim into dist on export). Re-run this when
 * the trailer changes; do not edit the generated file by hand.
 */

const fs = require('fs');
const path = require('path');

const SRC_URL = 'https://raw.githubusercontent.com/webgenerations77/stchq/main/demo-trailer.published.html';
const OUT = path.join(__dirname, '..', 'public', 'ads', 'certotable-embed.html');

// The six scenes that survive, keyed by their `clip` id. Chosen so the cut opens, shows the
// product, states the price and CLOSES — a trailer that never reaches its own call to action
// is an ad that does not ask for anything.
const KEEP_SCENES = ['open', 'learn', 'quiz', 'exam', 'pricing', 'cta'];
// Screenshots those scenes reference. Anything else is dead weight at ~90KB each.
const KEEP_SHOTS = ['lesson_top', 'flashcard', 'quiz', 'exam'];

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)}MB`;

/** Replace exactly once, or fail the build with a message naming what drifted. */
function mustReplace(src, pattern, replacement, what) {
  const matches = src.match(pattern);
  if (!matches) {
    throw new Error(
      `[build-house-ad] Could not find "${what}" in the upstream trailer.\n` +
      `The published trailer has changed shape. Re-read it and update this script — do NOT ` +
      `ship the embed until this passes, or the loading screen will show a broken ad.`
    );
  }
  return src.replace(pattern, replacement);
}

async function main() {
  console.log(`Fetching ${SRC_URL}`);
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error(`[build-house-ad] fetch failed: ${res.status} ${res.statusText}`);
  let html = await res.text();
  const before = html.length;
  console.log(`  source ${mb(before)}`);

  // ── 1. Keep the voiceover, but ONLY for the scenes that survive the trim. The five dropped
  //       clips are 0.60MB of narration for scenes nobody will see.
  const voMatch = html.match(/const VO = \{open:[\s\S]*?\};(?=\s*\/\/ \{id:\{d,src\}\})/);
  if (!voMatch) throw new Error('[build-house-ad] Could not find the VO (voiceover) table.');
  const voKept = [];
  for (const m of voMatch[0].matchAll(/(\w+):\{d:([\d.]+),src:"(data:audio\/[^"]+)"\}/g)) {
    if (KEEP_SCENES.includes(m[1])) voKept.push(`${m[1]}:{d:${m[2]},src:"${m[3]}"}`);
  }
  if (voKept.length !== KEEP_SCENES.length) {
    throw new Error(`[build-house-ad] Expected ${KEEP_SCENES.length} VO clips, kept ${voKept.length}.`);
  }
  html = html.replace(voMatch[0], `const VO = {${voKept.join(',')}};`);

  // ── 2. Drop screenshots no surviving scene references.
  const shotsMatch = html.match(/const SHOTS = \{[\s\S]*?\};(?=\s*\/\/ \{name:dataURI\})/);
  if (!shotsMatch) throw new Error('[build-house-ad] Could not find the SHOTS table.');
  const kept = [];
  for (const m of shotsMatch[0].matchAll(/(\w+):"(data:image\/[^"]+)"/g)) {
    if (KEEP_SHOTS.includes(m[1])) kept.push(`${m[1]}:"${m[2]}"`);
  }
  if (kept.length !== KEEP_SHOTS.length) {
    throw new Error(`[build-house-ad] Expected ${KEEP_SHOTS.length} shots, kept ${kept.length}.`);
  }
  html = html.replace(shotsMatch[0], `const SHOTS = {${kept.join(',')}};`);

  // ── 3. The instructor headshot lives in the markup, not SHOTS, and its scene is cut — so it
  //       would still download ~129KB only to never be shown. Swap it for a transparent pixel.
  html = mustReplace(
    html,
    /data:image\/webp;base64,[A-Za-z0-9+/=]+/,
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'the instructor headshot',
  );

  // ── 4. Start UNMUTED. Asserted rather than rewritten: the flag is already `false` upstream,
  //       so this only pins the shape so a future upstream change cannot silently flip it.
  //
  //       Whether sound actually comes out is the browser's call, not ours. Chrome allows
  //       autoplay with sound when the page has sticky user activation — the tap on "Build my
  //       day" immediately before this screen — and separately grants it to INSTALLED PWAs,
  //       which is how Decide ships. iOS Safari is stricter and will simply stay silent.
  //       That degradation is safe: `voEl.play()` is already `.catch()`ed upstream and the
  //       scene timeline is driven by requestAnimationFrame, so the ad still plays, just mute.
  if (!/muted=false, started=false/.test(html)) {
    throw new Error('[build-house-ad] Could not find the muted/started state flags.');
  }

  // ── 5. Trim the timeline. Spliced in place because TL is a const binding; durations are
  //       computed on the line above, so this must land after it.
  html = mustReplace(
    html,
    /(TL\.forEach\(\(t\) => \{ t\.dur = Math\.max\(\(VO\[t\.clip\]\?\.d \|\| 0\) \+ TAIL, t\.floor\); \}\);)/,
    `$1
  /* EMBED: keep only the scenes that fit a ~45s wait, so the closing CTA actually plays. */
  { const K = ${JSON.stringify(KEEP_SCENES)};
    TL.splice(0, TL.length, ...TL.filter((t) => K.includes(t.clip)));
    if (!TL.length) throw new Error('EMBED: scene filter removed every scene'); }`,
    'the TL duration pass',
  );

  // ── 5b. ⚠ THE MATCHING DOM PRUNE. Trimming TL alone is NOT enough and silently produces a
  //        desynced ad: the player does `scenes = [...querySelectorAll('.scene')]` and then
  //        indexes it with the TL index, so a 6-entry TL against 11 DOM sections plays scene
  //        visuals 1-6 underneath the subtitles of a different six. It looks plausible and is
  //        completely wrong — "THE PROBLEM" rendered under the "Learn" caption.
  //
  //        Runs in its own <script> placed BEFORE the player, so the player's querySelectorAll
  //        already sees the pruned set. Clip order is read from the source rather than
  //        hardcoded, so an upstream reorder cannot silently mis-drop a scene.
  const tlBlock = html.match(/const TL = \[[\s\S]*?\n  \];/);
  if (!tlBlock) throw new Error('[build-house-ad] Could not find the TL array to read clip order.');
  const clipOrder = [...tlBlock[0].matchAll(/clip:'(\w+)'/g)].map((m) => m[1]);
  const missing = KEEP_SCENES.filter((k) => !clipOrder.includes(k));
  if (missing.length) {
    throw new Error(`[build-house-ad] KEEP_SCENES names scenes not in the trailer: ${missing.join(', ')}`);
  }
  const dropIdx = clipOrder.map((c, i) => (KEEP_SCENES.includes(c) ? -1 : i)).filter((i) => i >= 0);
  console.log(`  scene order: ${clipOrder.join(', ')}`);
  console.log(`  dropping DOM scenes at: ${dropIdx.join(', ')}`);

  html = mustReplace(
    html,
    /<script>/,
    `<script>
/* EMBED PRUNE — generated. Keeps the DOM scenes aligned with the trimmed timeline. */
(() => {
  const DROP = ${JSON.stringify(dropIdx)}, EXPECT = ${clipOrder.length};
  const s = [...document.querySelectorAll('.scene')];
  // Bail rather than mangle: if the trailer's scene count has changed, the indexes below are
  // meaningless and a desynced ad is worse than an untrimmed one.
  if (s.length !== EXPECT) { console.warn('[embed] scene count changed; not pruning'); return; }
  DROP.slice().sort((a, b) => b - a).forEach((i) => s[i] && s[i].remove());
})();
</script>
<script>`,
    'the opening <script> tag (scene prune)',
  );

  // ── 6. Auto-start and loop. Appended INSIDE the player's IIFE (replacing its final close) so
  //       it can reach the scoped bindings directly rather than poking at the DOM.
  //       `finish` is a function declaration, so reassigning it is legal and `tick()` — which
  //       calls it by name — picks up the new one.
  const embedBoot = `
  /* ══ EMBED MODE — generated by scripts/build-house-ad.js, do not hand-edit ══
     Loops instead of ending on a replay card, and starts without the tap gate.

     WITH SOUND: Music.init() builds the synthesised score (no payload — it is generated in
     the browser) and \`started = true\` lets playVO run the narration. If the browser refuses
     autoplay-with-sound the AudioContext simply stays suspended and voEl.play() rejects into
     an existing catch — the ad still plays, silently. Nothing here forces audio; it asks. */
  finish = function(){ goTo(0); play(); };
  started = true;
  gate.classList.add('hide');
  Music.init();
  goTo(0);
  play();
  if (!reduced) startFX();
})();`;
  const lastClose = html.lastIndexOf('})();');
  if (lastClose === -1) throw new Error('[build-house-ad] Could not find the player IIFE close.');
  html = html.slice(0, lastClose) + embedBoot + html.slice(lastClose + '})();'.length);

  // ── 7. Hide the deliberate-viewing chrome. At ~380px wide the transport controls, the tap
  //       gate and the rotate prompt are unreadable clutter competing with a countdown.
  //
  //       NOTE: the trailer is a document FRAGMENT — it has no <html>, <head> or <body>, just
  //       a <title>, two <style> blocks and the player. So this anchors on the opening <script>
  //       tag, which puts the rule after both existing stylesheets.
  html = mustReplace(
    html,
    /<script>/,
    `<style>
  /* EMBED: this is an ad in a small slot, not a player. Hide everything that exists for
     deliberate viewing — transport controls, the scrub rail, the tap gate, the rotate prompt —
     and never a scrollbar, which an iframe will happily show. */
  .controls, .rail, .gate, .rotate { display: none !important; }
  html, body { overflow: hidden !important; margin: 0 !important; }

  /* The subtitle is closed-captioning for a voiceover this cut does not have, and at ~250px
     tall its default \`bottom: clamp(42px,7vh,60px)\` lands it on top of the scene's own
     artwork. Scaled down and seated just above the fineprint. Kept rather than hidden because
     it carries the message on the scenes whose visuals are only a phone screenshot. */
  .subtitle {
    bottom: 6px !important;
    font-size: 11px !important;
    line-height: 1.3 !important;
    width: 92% !important;
    max-width: 92% !important;
    text-align: center !important;
    text-shadow: 0 1px 4px rgba(0,0,0,.95) !important;
  }

  /* The legal disclaimer STAYS — it is a required statement about ServSafe® affiliation and is
     not ours to drop to make an ad prettier. It is moved to the top edge instead, which every
     scene leaves empty, because at this size the bottom is contested by the caption and the two
     were rendering on top of each other. Same words, same frame, still legible. */
  .fineprint {
    top: 0 !important;
    bottom: auto !important;
    padding: 4px 10px !important;
    font-size: 8px !important;
    line-height: 1.35 !important;
    gap: 8px !important;
  }
</style>
<script>`,
    'the opening <script> tag (embed stylesheet)',
  );

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  const after = fs.statSync(OUT).size;
  console.log(`  wrote  ${path.relative(process.cwd(), OUT)}`);
  console.log(`  ${mb(before)} -> ${mb(after)} (${Math.round((1 - after / before) * 100)}% smaller)`);
  console.log(`  scenes: ${KEEP_SCENES.join(', ')}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
