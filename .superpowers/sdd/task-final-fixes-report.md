# Final-Review Fixes Report — feat/smart-engine

Date: 2026-06-28

---

## Fix I-1 — Revive live-data indicator in `app/(tabs)/plan.js`

**Before:** `setResearch(data.research ?? null);` (line 850)
**After:**  `setResearch(data.discovery ?? null);`

The API handler was returning the field as `discovery` but the client was reading `research`, so `research` state was always `null` and the live-data indicator (`research?.hadLiveData`) never lit up. One-character field name change restores the wiring. State variable name and indicator UI left untouched.

---

## Fix I-2 — Restore `admission_cost` on synthesis stops in `api/smart/synthesis.js`

### (a) buildSynthesisPrompt — add field to prompt
**Before:** `...and provenance (only for anchor/find stops).`
**After:**  `...admission_cost ("Free" | "$15/adult" | "Prices vary — check website" | null for food/shopping), and provenance (only for anchor/find stops).`

### (b) validateStops — pass field through
**Before:** (no `admission_cost` in mapped output object)
**After:**  Added `admission_cost: s.admission_cost ?? null,` in the `.map()` return alongside existing fields.

### (c) `__tests__/smart-synthesis.mjs` — new assertions
Added two assertions after the existing ones:
- `validateStops preserves admission_cost when present` — stop with `admission_cost: 'Free'` comes through as `'Free'`.
- `validateStops sets admission_cost null when absent` — stop without the field gets `null`.

Test result: 6 passed, 0 failed (up from 4 passed).

---

## Fix I-3 — Fix Overpass 406 in `api/smart/sourceRegistry.js`

**Before:**
```js
headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
```
**After:**
```js
headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Decide/1.0 (itinerary app)' },
```

### Live Overpass Probe Result
```
STATUS-OK {
  "version": 0.6,
  "generator": "Overpass API 0.7.62.11 87bfad18",
  "osm3s": {
    "timestamp_osm_base": "2026-06-28T23:05:00Z",
    "copyright": "The data included in this document is from www.op...
```
**Result: 200 with valid JSON — fix confirmed.**

---

## Fix M-4 — Stop stub finds inflating hadLiveData in `api/smart/sourceRegistry.js`

### (a) runGoldenHour — return [] when sunset missing
**Before:**
```js
const r = (await res.json()).results || {};
return [{
  title: 'Golden hour', ...
  when: r.sunset, url: '', snippet: `Sunset ${r.sunset ? new Date(r.sunset).toLocaleTimeString(...) : '—'}`,
  ...
}];
```
**After:**
```js
const r = (await res.json()).results || {};
if (!r.sunset) return [];
return [{
  title: 'Golden hour', ...
  when: r.sunset, url: '', snippet: `Sunset ${new Date(r.sunset).toLocaleTimeString(...)}`,
  ...
}];
```
When the API returns no sunset (e.g. polar day/night or error body), returns `[]` instead of a stub Find with a `—` snippet that would incorrectly count toward `hadLiveData`.

### (b) runSurf — guard wave_height_max interpolation
**Before:**
```js
snippet: `Max wave height ~${d.wave_height_max?.[i]}m`
```
**After:**
```js
snippet: d.wave_height_max?.[i] != null ? `Max wave height ~${d.wave_height_max[i]}m` : 'Wave data unavailable'
```
Prevents `~undefinedm` when a day's wave height value is null/undefined. Finds with real data still emit the height string; finds with missing data get a clean fallback label. All per-day finds are still returned.

---

## Test Outputs

### `node __tests__/smart-synthesis.mjs`
```
  ✓ synthesis is Cheddar, opinionated
  ✓ prompt injects the anchor
  ✓ validateStops keeps complete stops
  ✓ validateStops preserves provenance when present
  ✓ validateStops preserves admission_cost when present
  ✓ validateStops sets admission_cost null when absent

6 passed, 0 failed
```

### `node __tests__/smart-registry.mjs`
```
  ✓ pinball matches the pinball source
  ✓ arcades resolves to overpass via OSM tag
  ✓ match is fuzzy/case-insensitive
  ✓ unknown interest falls back to search

4 passed, 0 failed
```

### `node __tests__/smart-adapters.mjs`
```
  ✓ breweries → brewery source
  ✓ surf → surf source
  ✓ tides → tides source
  ✓ sunset → goldenhour source

4 passed, 0 failed
```

### `node --check "app/(tabs)/plan.js"`
No output — syntax valid.

---

## Files Changed
- `app/(tabs)/plan.js` — Fix I-1
- `api/smart/synthesis.js` — Fix I-2 (a) and (b)
- `api/smart/sourceRegistry.js` — Fix I-3 and M-4
- `__tests__/smart-synthesis.mjs` — Fix I-2 (c)
- `.superpowers/sdd/task-final-fixes-report.md` — this file
