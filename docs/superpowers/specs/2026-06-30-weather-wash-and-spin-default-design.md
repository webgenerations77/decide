# Weather Wash + Quick Spin Default — Design

**Date:** 2026-06-30
**Status:** Approved, implemented

## Summary

Two changes:

1. **Weather wash** — itinerary cards get a faint background gradient that reflects the
   day's forecast, drawn entirely from existing theme tokens (zero new deps, dark-mode
   safe, text legibility preserved). Applied to the History itinerary preview cards and
   the itinerary detail header.
2. **Quick Spin default** — the category selector defaults to **Food** instead of
   **Surprise Me**. Pill order is unchanged; Food just loads pre-selected.

We deliberately rejected the literal "stock photo of the weather behind the card" idea:
it forces a dark scrim that fights Decide's light/editorial system, looks generic
(ten sunny days = ten identical cards), and adds a network image load per card for pure
decoration. The gradient wash captures the same instinct on-brand and for free.

## Weather wash

### Helper — `lib/weatherWash.js` (pure, tested)

- `weatherBucket(weather)` → one of
  `clear | hot | partly | overcast | rain | snow | thunder | fog`, or `null`.
  Prefers the `condition` string (`wmoToCondition` output), mirroring `getWeatherEmoji`'s
  substring checks so the wash agrees with the emoji the card already shows. Falls back to
  the `emoji` when `condition` is absent (older saved plans + demo data carry only an
  emoji). `clear` + `temp_f >= 85` → `hot`. Temp is coerced with `Number()` because demo
  data carries string temps. `beyondForecast` or no signal → `null`.
- `weatherWash(weather, colors)` → `{ colors: [from, to] }` for `<LinearGradient>`, or
  `null`. Because it receives `colors` from `useTheme()`, the same call themes itself for
  light/dark automatically.

Token mapping (faint — pale tokens at low opacity, a tint *behind* content, never bold):

| Bucket | Gradient |
|---|---|
| `clear` | `sky100 → surface` |
| `hot` | `surfaceAlt → gold+'33'` |
| `partly` | `sky100 → surfaceAlt` |
| `overcast` / `fog` | `surfaceAlt → border` |
| `rain` | `sky200 → sky100` |
| `thunder` | `sky300 → sky200` |
| `snow` | `borderLight → surface` |
| `null` | no wash — card renders exactly as before |

### Integration

- **History `ItineraryEntry`** (`app/(tabs)/history.js`): `LinearGradient` as an
  absolute-fill first child of the `Card`, with the card background set transparent when a
  wash is present. Opacity `0.5` — whisper-light, because these are recall cards and
  scannability wins. `overflow: hidden` already clips to the rounded corners.
- **Detail header** (`app/itinerary/[id].js`): `LinearGradient` behind the back
  button / title / `WeatherPill` band. Opacity `0.85` — reads a touch stronger since it's
  the hero moment. The loading and not-found headers get no wash.

### Edge cases

No condition + no emoji, or `beyondForecast` → helper returns `null` → plain card. No
network, no image loads, no scrim, contrast untouched. Dark mode is automatic via theme
tokens.

### Testing

`weatherBucket` / `weatherWash` are pure → asserted in `__tests__/verify.mjs`
(`node __tests__/verify.mjs`): condition + emoji bucketing, the hot/clear interaction,
string-temp coercion, null fallbacks, and token mapping.

## Quick Spin default

`screens/SpinScreen.js`: initial category state `useState('surprise')` → `useState('food')`.
`food` is an existing category id, so nothing else changes. Side effect: the one-time
"How Surprise Me works" explainer now appears only when a user actually taps Surprise Me,
rather than on first launch — an improvement. Pill order is intentionally left as-is.

## Update — weather wash → weather illustration bands

The gradient-only wash shipped first (commit on `main`). On review the intent was an
actual *image* of the forecast, so the wash was upgraded to a flat SVG illustration band:

- **`components/itinerary/WeatherArt.js`** — renders a hand-authored SVG scene
  (sun / partly cloudy / overcast / rain / thunderstorm / snow) over the existing
  `weatherWash` sky gradient. All shapes use theme tokens, so dark mode is automatic;
  `react-native-svg` (already a dep) draws it, zero network, ~1KB. Returns `null` for no
  forecast. Bucketing + gradient stay in `lib/weatherWash.js` (still pure + tested).
- **History cards**: full-bleed 72px band across the card top (negates card padding;
  `overflow: hidden` clips to the rounded corners), content below on clean paper.
- **Detail header**: rounded, inset 120px hero band between the back button and the title.

Chosen over AI-generated raster because the environment has no `GEMINI_API_KEY`/Python, and
flat vector is the better fit anyway. Verified visually via an HTML preview of all scenes.

## Also in this batch (unrelated small changes)

- **Loading screen pacing** (`components/LoadingAnimation.js`): rotating info cards
  (weather / born-today / on-this-day) dwell longer — `ROTATE_MS` 3500 → 5500 (+2s each).
- **Bourdain quotes** (`lib/bourdainQuotes.js`, `app/(tabs)/plan.js`): the
  "Cheddar-curated, based on where you are" subtext under the DECIDE button is replaced by
  a rotating Anthony Bourdain quote. A persisted index advances once per app launch, so
  successive opens cycle the list in order. Shown on both the landing and generate screens.

## Out of scope

Place photos, animation, reordering the Spin pills.
