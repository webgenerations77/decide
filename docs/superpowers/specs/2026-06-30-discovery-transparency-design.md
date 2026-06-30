# Discovery Transparency — Design

**Date:** 2026-06-30
**Status:** Approved (brainstorm) — ready for implementation plan
**Backlog:** §6 #3 ("surface *what* the engine found and *why* in the itinerary UI")
**Approach:** 1 of 3 ("Receipts" disclosure — see Alternatives Considered)

---

## Goal

The Smart Discovery engine already does live web research (Firecrawl finds → Haiku picks
1–3 "anchors" that shape the day → Sonnet synthesis weaves them into stops). Today the UI
hides almost all of it: `ItineraryMeta` shows a single italic line, *"✨ Cheddar checked
what's happening this week,"* and the anchors/provenance are fetched but never shown.

This feature surfaces **what** Cheddar found and **why** it built the day around it, at two
levels — the trip header and the individual stops — to build user trust ("these are real,
time-sensitive finds, not hallucinations") and let users tap out to the source where we
have one.

Non-goal: changing the engine, the discovery algorithm, or how anchors are chosen. This is
a presentation feature over data the engine already returns.

---

## Data Available (today)

The itinerary API response already carries everything except one field (`anchors[].url`),
which this design adds.

**Trip level** — `data.discovery` (passed into `ItineraryMeta` as the `research` prop):
```
discovery: {
  hadLiveData: boolean,        // engine reached live sources
  findCount:   number,         // total live finds discovered
  anchorCount: number,         // anchors picked (0–3)
  anchors: [                   // the day's backbone, each with a plain-English rationale
    { title, interest, why /* = anchor.rationale */ }
  ]
}
```

**Stop level** — each stop that originated from an anchor/find already carries:
```
stop.provenance: { interest, sourceLabel, why }
```
`synthesis.js` emits `provenance` (prompt instructs it for anchor/find stops) and
`validateStops` preserves it (`...(s.provenance ? { provenance: s.provenance } : {})`).
**No engine change is required for stop-level surfacing.**

---

## Changes

### 1. API / data layer (both handlers — mirror exactly)

Add `url` to the anchor mapping so trip-level anchor rows can link to their source:

- `api/itinerary.js` (~line 267, Vercel/prod) and
- `app/api/itinerary+api.js` (~line 415, Expo)

```js
anchors: smart.anchors.map((a) => ({
  title:    a.find?.title,
  interest: a.find?.interest,
  why:      a.rationale,
  url:      a.find?.url || null,   // NEW
})),
```

`a.find.url` already exists on every find (`lib/smart/discovery.js` find shape:
`{ title, category, interest, url, snippet, sourceLabel }`). `url` may be `null`/empty.

No other backend change. Stop `provenance` is untouched.

### 2. Trip-level — new `components/itinerary/DiscoveryAnchors.js`

Extracted into its own component (rather than inlined in `ItineraryMeta`) so the disclosure
has one clear job, is independently testable, and keeps `ItineraryMeta` focused.

`ItineraryMeta.js` swaps its current `hadLiveData` one-liner (lines 37–39) for:
```jsx
<DiscoveryAnchors research={research} />
```

`DiscoveryAnchors({ research })` behavior:
- **`research?.anchors?.length > 0`** → a collapsible block:
  - Header row (always visible): **"✨ What Cheddar found this week (N)"** + a chevron,
    where N = `anchors.length`. Tapping toggles a local `useState(false)` `expanded` flag
    (collapsed by default so the header stays compact).
  - Expanded body: one row per anchor — `title` (semibold) on top, `why` (muted, smaller)
    beneath. A row whose anchor has a truthy `url` is a `TouchableOpacity` that calls
    `Linking.openURL(url)` (with a subtle affordance, e.g. a link/`open-outline` icon or
    cobalt title); a row without `url` is a plain `View`.
- **`research?.hadLiveData` true but `anchors` empty** → fall back to today's one-liner
  (*"✨ Cheddar checked what's happening this week"*).
- **`research` null / `hadLiveData` false** → render nothing (today's behavior).

Styling: `const styles = useMemo(() => makeStyles(colors), [colors])` via `useTheme()`;
themed tokens only (no raw hex); reuse the meta/chip visual language already in
`ItineraryMeta`. Verified in both light and dark.

### 3. Stop-level — provenance surfacing

**`components/itinerary/StopCard.js`** — when `stop.provenance` exists, render a small
**"📰 Live find"** chip among the existing badges (admission / live-music), reusing the
`liveMusicBadge`/`sky100` token pattern. This is the at-a-glance signal that the stop came
from live research; full detail lives in the modal.

**`components/itinerary/PlaceDetailModal.js`** — when `stop.provenance?.why` exists, add a
section styled like the existing "Cheddar's take" block:
- Label/eyebrow: **"📰 Why it's here"**
- Body: `provenance.why`
- Caption: `provenance.sourceLabel` (small, muted) when present.

Plain text — **no tappable source at stop level** (that is the deliberately-skipped fragile
piece; see Alternatives). Themed via the modal's existing `makeStyles(colors)`.

---

## Edge Cases

| Condition | Behavior |
|---|---|
| Demo / fallback plan (no `discovery`) | Nothing new renders anywhere. |
| `hadLiveData` true, 0 anchors | Trip-level falls back to the existing one-liner. |
| Anchor missing `why` | Show `title` only. |
| Anchor missing/null `url` | Row is non-tappable (plain `View`). |
| Stop has no `provenance` | No chip, no modal section. |
| `provenance` present but `why` empty | No stop chip / no modal section (require `why`). |

---

## Testing

Repo convention: **no unit tests for RN styling/UI.** Verification is:
1. `npx expo export --platform web` → clean build (no errors).
2. Manual smoke:
   - A plan that produced live anchors: trip header shows the disclosure with correct count;
     expand/collapse works; an anchor with a `url` opens the browser on tap; a stop with
     provenance shows the "📰 Live find" chip and the "Why it's here" section in its detail
     modal.
   - A plan with no live data (demo/fallback): nothing new renders.
   - Both light and dark themes render correctly (no raw hex, legible contrast).

---

## Files Touched

- `api/itinerary.js` — add `url` to anchor mapping.
- `app/api/itinerary+api.js` — add `url` to anchor mapping (mirror).
- `components/itinerary/DiscoveryAnchors.js` — **new** collapsible trip-level component.
- `components/itinerary/ItineraryMeta.js` — render `DiscoveryAnchors`, remove inline one-liner.
- `components/itinerary/StopCard.js` — "📰 Live find" provenance chip.
- `components/itinerary/PlaceDetailModal.js` — "Why it's here" provenance section.

---

## Alternatives Considered

- **Approach 2 — Full provenance, server-enriched.** Everything here plus tappable
  stop-level sources, achieved by matching each stop's `provenance` back to its find by
  title server-side and attaching `provenance.url`. Rejected for v1: adds matching logic in
  both handlers and widens the engine return shape for a secondary affordance. Revisit if
  users want to tap out from individual stops.
- **Approach 3 — Minimal inline.** Expand the one-liner into an always-visible
  "Built around: X, Y" label and fold `why` into each stop's `reason`. Rejected: it's a
  label, not transparency — no "why," no sources, no clear what-Cheddar-found moment.
- **Stop-level tappable URL via prompt.** Asking synthesis to copy each find's `url` into
  `provenance`. Rejected: models drop/garble URLs unreliably; server-side matching
  (Approach 2) is the correct mechanism if/when stop links are wanted.

---

## Out of Scope / Follow-ups

- Tappable stop-level sources (Approach 2).
- Surfacing `findCount` ("Cheddar scanned 23 sources") — possible future trust signal.
- Tying anchors visually to the *specific* stop they became (beyond the per-stop provenance
  chip) — e.g. highlighting the matching stop when an anchor row is tapped.
