// Other Spinach Creations apps, shown in the loading screen's top slot.
//
// HOUSE ADS ONLY — this is deliberately not an ad network and must not become one. There is no
// SDK, no tracking, no remote fetch and no consent surface: the whole registry is this file plus
// a bundled image. That is what keeps the loading screen free of a privacy policy, a cookie
// banner, layout shift, and the "generic free app" feel PRODUCT.md lists as an anti-reference.
// If a third-party network is ever wanted, it does not belong here — start a separate module and
// have that argument on its own terms.
//
// FRAMING: presented as "More from Spinach Creations", not as an ad unit. Same asset, different
// promise — one says "here is the rest of the family", the other says "we sold this space".
//
// ⚠ NO CLAIMS WE CANNOT BACK. Copy here follows the same honesty rule as lib/transport/: no
// pricing, no ratings, no "#1", no install counts. A tagline and a link, nothing that needs
// verifying. Also: never the word "AI" in user-facing copy (project-wide rule) — Cert to Table's
// own marketing leans on it, and the line below deliberately routes around that.

/**
 * Each entry:
 *   id       stable key
 *   name     the product
 *   tagline  ONE line. It sits beside a thumbnail on a loading screen — nobody reads two.
 *   cta      what tapping does, stated plainly
 *   media    require()'d bundled asset. Portrait phone-screenshot crop, ~11KB.
 *   url      opened in a NEW TAB — see HouseAd. Navigating away mid-generation kills the
 *            in-flight itinerary request, which is the one bug this feature could cause.
 */
export const HOUSE_ADS = [
  {
    id: 'cert_to_table',
    name: 'Cert to Table',
    // Their own trailer's headline. Short enough to survive a narrow phone.
    tagline: 'Hospitality certification, reinvented',
    cta: 'Watch the trailer',
    media: require('../assets/ads/certotable.jpg'),
    // Portrait, matching the 560×1244 source screenshot it was cropped from.
    mediaAspect: 168 / 373,
    // The full trailer: landscape, tap-gated, with sound. It asks for fullscreen and locks
    // orientation, so it can only ever be a destination — never an embed. That is why this
    // file points at a URL and ships a still, rather than inlining a 3.26MB trailer onto the
    // one screen that exists because the traveller is ALREADY waiting.
    url: 'https://webgenerations77.github.io/stchq/demo-trailer.published.html',
  },
];

/**
 * The ad to show this time.
 *
 * `seed` lets the caller keep one ad stable for the life of a single loading screen — picking
 * per render would swap the card mid-wait, which reads as a glitch. With one entry this is
 * academic; it matters the moment a second app is added.
 *
 * Returns null when there is nothing to show, which the loading screen treats as "fall back to
 * the live-facts card" rather than rendering an empty box.
 */
export function pickHouseAd(seed = 0) {
  if (!HOUSE_ADS.length) return null;
  const i = Math.abs(Math.floor(seed)) % HOUSE_ADS.length;
  return HOUSE_ADS[i] ?? null;
}
