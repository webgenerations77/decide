# Design — Browser Back Navigation for the DECIDE flow (web)

**Date:** 2026-07-23
**Branch:** feat/browser-back-nav
**Status:** design — approved (scope: DECIDE view-machine + close-modal-on-back)

## Problem

On web, the DECIDE tab's flow `landing → configuring → itinerary` lives in internal React state
(`view`, `setView(...)` in `app/(tabs)/plan.js:169`), not in routes. The browser records no history
for these transitions, so the back button jumps out of the whole flow instead of stepping through it.
Likewise, the screen's modals (week picker, date picker, `PlaceDetailModal`) don't respond to the
back button — back skips past an open sheet.

Nav audit (the memory asked for a broad audit): the DECIDE view-machine is the sole real offender.
Real routes (`/itinerary/[id]`, `/paywall`, `/auth/*`, `/terms`) push history correctly; the
`router.replace` cases (auth guard, onboarding, History→plan) omit history intentionally. Leave them.

## Goal

On web, the browser/hardware back button should dismiss the topmost "dismissible layer" in LIFO order:
an open modal first, then step the DECIDE view back (`itinerary → configuring → landing`), then (once
no layers remain) navigate away from the tab normally. No-op on native (RN Modals already handle
hardware back via `onRequestClose`; native nav is unchanged).

## Approach: one reusable web-only primitive + a single sentinel entry

### Rejected alternative: steps as URL params
Making the steps real routes/params (`?step=configuring`) would give native back for free but turns
`view` into URL-derived state — a large refactor of `plan.js` (every `setView`, the animation effect
keyed on `view`) and it changes the visible URL. Not worth the risk for web-only nav polish.

### Rejected alternative: one history entry per layer
Pushing one entry per active layer causes an async `pushState`/`history.back()` race whenever one
layer closes and another opens in the same interaction (e.g. week-picker → configuring): the naive
"-1 then +1" churn can interleave with the browser's async `popstate`. Avoided by the sentinel model.

### Chosen: LIFO layer stack + a single sentinel history entry

A module-level coordinator keeps a LIFO stack of active layers `{ id, onDismiss }`. **Exactly one
sentinel history entry** exists whenever the stack is non-empty (NOT one-per-layer). History
reconciliation is **deferred via `queueMicrotask`** and driven purely by the stack transitioning
empty ↔ non-empty:

- stack `0 → ≥1`: `history.pushState({__backSentinel:true}, '')` (same URL — expo-router does not re-route).
- stack stays `≥1`: **no history change** (this is what kills the swap-in-same-tick churn).
- stack `≥1 → 0` via in-app dismiss: `history.back()` to consume the sentinel (guarded so its `popstate` is ignored).
- **Real back press** (`popstate`, not internal): the sentinel was consumed by the browser → pop the top
  layer, call its `onDismiss`; if layers remain, re-arm the sentinel (schedule reconcile).

Because reconciliation is deferred to a microtask and coalesced, a same-tick close+open (stack stays
`≥1`) performs zero history operations.

## Components

### 1. `lib/nav/backStack.js` — pure coordinator (web-agnostic, injectable `win`)
Factory `createBackStack(win)` returning `{ push(onDismiss) → id, remove(id), _state() }`, where `win`
supplies `history.pushState`, `history.back`, `addEventListener('popstate', …)`. A default singleton
`backStack` binds to the real `window` (guarded: only constructed on web with a real `window`).

Internal state: `stack` (array), `hasSentinel` (bool), `reconcileScheduled` (bool), `internalPop` (bool).

- `ensureListener()` — add the single `popstate` listener once (idempotent).
- `scheduleReconcile()` — set `reconcileScheduled`, `queueMicrotask(reconcile)` if not already scheduled.
- `reconcile()`:
  - `want = stack.length > 0`
  - `want && !hasSentinel` → `pushState({__backSentinel:true},'')`; `hasSentinel = true`.
  - `!want && hasSentinel` → `internalPop = true`; `hasSentinel = false`; `history.back()`.
- `onPop(e)`:
  - `internalPop` → clear it, return (this was our own sentinel-consuming `back()`).
  - `stack.length === 0` → return (nothing of ours; user is leaving the tab).
  - else: `hasSentinel = false`; `layer = stack.pop()`; `layer.onDismiss()`; `scheduleReconcile()`.
- `push(onDismiss)` → `ensureListener()`; assign incrementing `id`; `stack.push({id,onDismiss})`;
  `scheduleReconcile()`; return `id`.
- `remove(id)` → `idx = findIndex`; if `-1` return (idempotent — already popped by `onPop`);
  `stack.splice(idx,1)`; `scheduleReconcile()`.

`onDismiss` must only update UI state (close the modal / step the view). It must NOT itself call
`history.back()` — the coordinator owns all history bookkeeping. When `onDismiss` flips React state and
the owning hook's cleanup later calls `remove(id)`, that `remove` is a no-op because `onPop` already
popped the layer (idempotent by id-presence).

**Non-LIFO in-app removal** (rare; the UI makes it near-impossible since a modal covers the view's
back controls): `remove` on a non-top id splices it from the array and reconciles by count only. It
does not attempt to excise a middle history entry. Documented limitation.

### 2. `hooks/useBackHandler.js` — thin React hook (web-only)
```js
export function useBackHandler(active, onDismiss) {
  const cb = useRef(onDismiss); cb.current = onDismiss;      // always call the latest
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!active) return;
    const id = backStack.push(() => cb.current());
    return () => backStack.remove(id);
  }, [active]);
}
```
Keying the effect on `active` only (not `onDismiss`) is deliberate: the ref keeps the callback fresh
without re-registering the layer on every render.

### 3. `app/(tabs)/plan.js` — wire five layers (additive; no handler/close-button changes)
```js
useBackHandler(view !== 'landing',    goToLanding);          // configuring → landing (full reset)
useBackHandler(view === 'itinerary',  resetToConfiguring);   // itinerary → configuring
useBackHandler(showWeekPicker,  () => setShowWeekPicker(false));
useBackHandler(showDatePicker,  () => setShowDatePicker(false));
useBackHandler(showDetailModal, () => setShowDetailModal(false));
```
Forward transitions (existing `setView('configuring'|'itinerary')`, `setShow*(true)`) auto-arm the
sentinel via the `active → true` effect. In-app closes (`goToLanding`, `resetToConfiguring`,
`setShow*(false)`) auto-consume it via the effect cleanup. `goToLanding`/`resetToConfiguring` are
reused verbatim as the view layers' `onDismiss`, so browser-back and the in-app buttons share one path.

Ordering note: the flow only ever reaches `itinerary` through `configuring` (generate is reachable
only from configuring), so the configuring layer always activates before the itinerary layer — the
stack depth mirrors the view depth. Modals activate on top of whatever view is active.

## Data flow (examples)

- **landing → configuring → itinerary, then Back ×2:** each forward step keeps stack non-empty (1, then
  2 layers) with a single sentinel. Back → pop itinerary layer → `resetToConfiguring` (view=configuring);
  stack still has the configuring layer → sentinel re-armed. Back → pop configuring layer →
  `goToLanding` (view=landing); stack empty → no sentinel. Next Back leaves the tab.
- **Open PlaceDetailModal on the itinerary, then Back:** modal layer pushed on top (stack 3, still one
  sentinel). Back → pop modal layer → `setShowDetailModal(false)`; view untouched; sentinel re-armed.
- **Week-picker → pick a day (→ configuring):** `handleDaySelect` sets `showWeekPicker=false` and
  `view='configuring'` in the same commit. Coordinator: remove(weekPicker) + push(configuring) →
  stack stays `≥1` → microtask reconcile sees no empty↔non-empty transition → **zero** history ops. ✔

## Error handling / safety
Web-only guard (`Platform.OS === 'web' && typeof window !== 'undefined'`). All coordinator ops are
synchronous array mutations + guarded history calls; nothing throws into React. `pushState` uses the
same URL, so expo-router's React-Navigation history sees no path change and does not re-route (this is
the primary integration risk and MUST be confirmed in a real browser). The internal-back guard prevents
our own sentinel-consuming `history.back()` from being mistaken for a user back press.

## Testing
- `lib/nav/backStack.test.mjs` (node:test) with a fake `win` (array-backed history + a `popstate`
  dispatcher; `back()` decrements the index and invokes the registered listener). Cases:
  - single layer: push arms sentinel (after microtask); real back pops + calls onDismiss + disarms.
  - two layers: back pops LIFO (top first), sentinel re-armed while ≥1 remains.
  - in-app remove of the last layer consumes the sentinel via a guarded `history.back()` (no onDismiss
    re-entry, no spurious pop).
  - **same-tick swap** (remove A + push B in one microtask window) performs zero history ops.
  - internal-back guard: the coordinator's own `back()` does not trigger a layer `onDismiss`.
  - `remove` of an already-popped id is a no-op.
  Flush microtasks in tests with `await Promise.resolve()` (or a small helper).
- The React hook and `plan.js` wiring are validated by `npx expo export --platform web` (green) plus
  **in-browser verification** (drive the flow, press back through modal → views → exit; confirm no
  double-press and no stray URL change). Native no-op confirmed by build (the hook early-returns).

## Out of scope (follow-ups)
- Adopting `useBackHandler` in other screens' modals (settings, admin) and nested sub-modals inside
  `PlaceDetailModal`/`StopCard` — the primitive is ready; wiring is per-modal.
- The time-picker dropdown popover (a `Modal` in a `plan.js` sub-component) — include only if trivial;
  otherwise follow-up.
- Non-LIFO in-app layer removal excising a middle history entry (documented limitation above).
- Tab-switch mid-flow then back: expo-router tabs keep the screen mounted so `view` usually survives;
  not specially handled.

## Verify gate
`npx expo export --platform web` → "Exported: dist". Lib tests: `node --test lib/nav/*.test.mjs`.
`node --check` is useless here (CLAUDE.md). No new `api/` files — cap stays 12/12
(`find api -name '*.js' | wc -l`). Real-browser back-button check before merge.
