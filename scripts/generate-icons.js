/**
 * Regenerates every app icon from the brand compass mark.
 *
 *   npm i -D sharp --legacy-peer-deps     # not a committed dep — prod builds don't need it
 *   node scripts/generate-icons.js
 *
 * Outputs two families, because they are consumed by completely different systems:
 *
 *   assets/            native build icons, baked in by EAS. Invisible to the PWA.
 *   public/icons/      PWA icons, read from public/manifest.json at install time.
 *
 * Each target has its own safe zone, which is the whole reason this is a script and
 * not a hand-exported PNG:
 *   - iOS / store        full bleed, opaque (an alpha channel gets the build rejected)
 *   - Android adaptive   mark inside the centre 66.67% circle the launcher guarantees
 *   - PWA maskable       mark inside the centre 80% circle the maskable spec guarantees
 *   - PWA "any"          full bleed, used unmasked
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const PWA = path.join(ROOT, 'public', 'icons');

const NAVY = '#102A4C';
const WHITE = '#FFFFFF';
const ACCENT = '#FF8A3D';

const S = 1024;            // master canvas; everything downsamples from here
const C = S / 2;

/**
 * The compass, drawn to a given outer radius. Every proportion derives from `outer`
 * so the mark scales as one piece into each safe zone.
 */
function compass(outer) {
  const stroke = outer * 0.1455;       // ring weight (~2.4x the original brand-kit hairline)
  const r = outer - stroke / 2;        // stroke-centred radius
  const tip = outer * 0.704;           // needle half-length
  const half = tip * 0.25;             // base half-width — keeps the slender brand taper
  const hub = outer * 0.0986;
  return `
  <circle cx="${C}" cy="${C}" r="${r.toFixed(1)}" fill="none" stroke="${WHITE}" stroke-width="${stroke.toFixed(1)}"/>
  <g transform="rotate(20 ${C} ${C})">
    <path d="M${C} ${(C - tip).toFixed(1)} L${(C - half).toFixed(1)} ${C} L${(C + half).toFixed(1)} ${C} Z" fill="${ACCENT}"/>
    <path d="M${C} ${(C + tip).toFixed(1)} L${(C - half).toFixed(1)} ${C} L${(C + half).toFixed(1)} ${C} Z" fill="${WHITE}"/>
    <circle cx="${C}" cy="${C}" r="${hub.toFixed(1)}" fill="${WHITE}"/>
  </g>`;
}

const svg = (body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${body}</svg>`);

const onNavy = (outer) => svg(`<rect width="${S}" height="${S}" fill="${NAVY}"/>${compass(outer)}`);

// Safe-zone radii as a fraction of the canvas, per target.
const FULL_BLEED = 426;                 // clears the iOS squircle corner radius
const ANDROID_ADAPTIVE = S * 0.3333;    // launcher-guaranteed circle
const PWA_MASKABLE = S * 0.3700;        // inside the 80%-diameter maskable safe circle

async function write(input, file, size, { opaque = false } = {}) {
  let img = sharp(input).resize(size, size);
  if (opaque) img = img.removeAlpha();
  await img.png({ compressionLevel: 9 }).toFile(file);
  const m = await sharp(file).metadata();
  console.log(`  ${path.relative(ROOT, file).padEnd(38)} ${m.width}x${m.height}  alpha=${!!m.hasAlpha}`);
}

async function main() {
  fs.mkdirSync(PWA, { recursive: true });

  console.log('native (assets/) — consumed by EAS at build time:');
  // Opaque: the App Store rejects icons carrying an alpha channel.
  await write(onNavy(FULL_BLEED), path.join(ASSETS, 'icon.png'), S, { opaque: true });
  // Transparent: Android composites this over adaptiveIcon.backgroundColor.
  await write(svg(compass(ANDROID_ADAPTIVE)), path.join(ASSETS, 'android-adaptive-foreground.png'), S);

  console.log('pwa (public/) — read from manifest.json at install time:');
  for (const size of [192, 512]) {
    await write(onNavy(FULL_BLEED), path.join(PWA, `icon-${size}.png`), size, { opaque: true });
    await write(onNavy(PWA_MASKABLE), path.join(PWA, `icon-maskable-${size}.png`), size, { opaque: true });
  }
  // iOS home screen. Must be opaque — Safari does not composite transparency, it
  // renders it black, and it applies its own corner rounding.
  await write(onNavy(FULL_BLEED), path.join(ROOT, 'public', 'apple-touch-icon.png'), 180, { opaque: true });
}

main().catch((e) => { console.error(e); process.exit(1); });
