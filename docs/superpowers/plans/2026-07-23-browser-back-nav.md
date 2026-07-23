# Browser Back-Nav (DECIDE flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On web, make the browser/hardware back button step through the DECIDE flow (`itinerary → configuring → landing`) and close open modals first, in LIFO order — no-op on native.

**Architecture:** One reusable web-only primitive `useBackHandler(active, onDismiss)` backed by a module-level coordinator (`lib/nav/backStack.js`) that keeps a LIFO stack of active dismissible layers and maintains a SINGLE sentinel history entry while the stack is non-empty. History reconciliation is deferred via `queueMicrotask` and driven only by the stack going empty↔non-empty, so a same-tick close+open causes zero history churn. `plan.js` wires five layers (2 view steps + 3 modals) declaratively.

**Tech Stack:** Expo SDK 56, React hooks, plain ESM lib, node:test, `window.history` (web only).

## Global Constraints

- **VERCEL FUNCTION CAP: max 12 `.js` under `api/`.** This feature adds NONE. Check: `find api -name '*.js' | wc -l` == 12.
- **Verify builds with `npx expo export --platform web`** (success = "Exported: dist"). `node --check` is USELESS here.
- **Lib tests via node:test**, file `lib/nav/backStack.test.mjs`. Run: `node --test lib/nav/*.test.mjs`.
- **Web-only guard everywhere:** the coordinator singleton is `null` off-web; the hook must early-return unless `Platform.OS === 'web'` and the singleton exists. Native behavior must be unchanged (RN Modals already handle hardware back via `onRequestClose`).
- **Single sentinel, microtask-deferred reconcile.** Never one-entry-per-layer. `pushState` uses the SAME URL (`''`) so expo-router does not re-route.
- **`onDismiss` only updates UI state** (close modal / step view). It must NEVER call `history.back()` — the coordinator owns all history bookkeeping.
- Drop/guard semantics: `remove(id)` of an already-popped id is a no-op; the coordinator's own sentinel-consuming `history.back()` is guarded so its `popstate` never triggers a layer `onDismiss`.

---

### Task 1: `lib/nav/backStack.js` coordinator + tests

**Files:**
- Create: `lib/nav/backStack.js`
- Test: `lib/nav/backStack.test.mjs`

**Interfaces:**
- Produces: `createBackStack(win)` → `{ push(onDismiss) → id, remove(id), _state() }` where `_state()` returns `{ depth, hasSentinel }`. `win` supplies `history.pushState(state)`, `history.back()`, `addEventListener('popstate', fn)`.
- Produces: `backStack` — a default singleton bound to the real `window`, or `null` when `typeof window === 'undefined'` (native/SSR).

- [ ] **Step 1: Write the failing test**

Create `lib/nav/backStack.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackStack } from './backStack.js';

// Flush microtasks (queueMicrotask) AND any chained ones via a macrotask turn.
const tick = () => new Promise((r) => setTimeout(r, 0));

// Fake window: array-backed history with an index + popstate listeners.
function makeFakeWin() {
  const entries = [{ state: null }]; // base entry
  let index = 0;
  const listeners = [];
  function emit() {
    const ev = { state: entries[index].state };
    for (const fn of listeners) fn(ev);
  }
  return {
    history: {
      pushState(state) { entries.length = index + 1; entries.push({ state }); index++; },
      back() { if (index > 0) index--; emit(); },
      get length() { return entries.length; },
      _index: () => index,
    },
    addEventListener(type, fn) { if (type === 'popstate') listeners.push(fn); },
  };
}

test('push arms a single sentinel after a microtask', async () => {
  const win = makeFakeWin();
  const bs = createBackStack(win);
  bs.push(() => {});
  assert.equal(bs._state().hasSentinel, false); // deferred
  await tick();
  assert.equal(bs._state().hasSentinel, true);
  assert.equal(win.history.length, 2); // base + one sentinel
});

test('real back pops the layer, calls onDismiss, disarms sentinel', async () => {
  const win = makeFakeWin();
  const bs = createBackStack(win);
  let dismissed = 0;
  bs.push(() => { dismissed++; });
  await tick();
  win.history.back(); // simulate user back
  assert.equal(dismissed, 1);
  assert.equal(bs._state().depth, 0);
  await tick();
  assert.equal(bs._state().hasSentinel, false);
});

test('two layers pop LIFO with one sentinel, re-armed while layers remain', async () => {
  const win = makeFakeWin();
  const bs = createBackStack(win);
  const order = [];
  bs.push(() => order.push('A')); await tick();
  bs.push(() => order.push('B')); await tick();
  assert.equal(win.history.length, 2); // still ONE sentinel for two layers
  win.history.back(); // pops B
  assert.deepEqual(order, ['B']);
  assert.equal(bs._state().depth, 1);
  await tick();
  assert.equal(bs._state().hasSentinel, true); // re-armed for A
  win.history.back(); // pops A
  assert.deepEqual(order, ['B', 'A']);
  await tick();
  assert.equal(bs._state().hasSentinel, false);
});

test('in-app remove of the last layer consumes the sentinel without calling onDismiss', async () => {
  const win = makeFakeWin();
  const bs = createBackStack(win);
  let dismissed = 0;
  const id = bs.push(() => { dismissed++; });
  await tick();
  assert.equal(win.history._index(), 1);
  bs.remove(id);
  await tick();
  assert.equal(dismissed, 0);              // remove must NOT fire onDismiss
  assert.equal(bs._state().depth, 0);
  assert.equal(bs._state().hasSentinel, false);
  assert.equal(win.history._index(), 0);   // sentinel consumed via guarded back()
});

test('same-tick close+open performs zero history ops', async () => {
  const win = makeFakeWin();
  const bs = createBackStack(win);
  const idA = bs.push(() => {}); await tick();
  const lenBefore = win.history.length;    // 2
  const idxBefore = win.history._index();  // 1
  bs.remove(idA);
  bs.push(() => {});                        // same synchronous tick, before flush
  await tick();
  assert.equal(bs._state().depth, 1);
  assert.equal(bs._state().hasSentinel, true);
  assert.equal(win.history.length, lenBefore);  // unchanged
  assert.equal(win.history._index(), idxBefore); // unchanged
});

test('user back with an empty stack is ignored (no throw)', async () => {
  const win = makeFakeWin();
  const bs = createBackStack(win);
  win.history.back(); // nothing of ours
  assert.equal(bs._state().depth, 0);
  assert.equal(bs._state().hasSentinel, false);
});

test('remove of an already-popped id is a no-op', async () => {
  const win = makeFakeWin();
  const bs = createBackStack(win);
  let dismissed = 0;
  const id = bs.push(() => { dismissed++; });
  await tick();
  win.history.back();            // onPop pops it
  assert.equal(dismissed, 1);
  assert.equal(bs._state().depth, 0);
  bs.remove(id);                 // already gone
  await tick();
  assert.equal(bs._state().depth, 0);
  assert.equal(bs._state().hasSentinel, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/nav/backStack.test.mjs`
Expected: FAIL with `Cannot find module './backStack.js'` (or export missing).

- [ ] **Step 3: Write minimal implementation**

Create `lib/nav/backStack.js`:

```js
// Web-only LIFO stack of dismissible "layers" (open modals + DECIDE view steps),
// backed by a SINGLE sentinel history entry that exists while the stack is
// non-empty. The browser back button pops the top layer and calls its onDismiss.
// History reconciliation is deferred to a microtask and driven only by the stack
// going empty<->non-empty, so a same-tick close+open causes no history churn.
// Pure factory (inject `win`) for testability.

export function createBackStack(win) {
  const stack = [];            // [{ id, onDismiss }]
  let nextId = 1;
  let hasSentinel = false;
  let reconcileScheduled = false;
  let internalPop = false;     // true while we consume our own sentinel via back()
  let listening = false;

  function ensureListener() {
    if (listening) return;
    win.addEventListener('popstate', onPop);
    listening = true;
  }

  function reconcile() {
    reconcileScheduled = false;
    const want = stack.length > 0;
    if (want && !hasSentinel) {
      hasSentinel = true;
      win.history.pushState({ __backSentinel: true }, '');
    } else if (!want && hasSentinel) {
      hasSentinel = false;
      internalPop = true;
      win.history.back();
    }
  }

  function scheduleReconcile() {
    if (reconcileScheduled) return;
    reconcileScheduled = true;
    queueMicrotask(reconcile);
  }

  function onPop() {
    if (internalPop) { internalPop = false; return; } // our own sentinel-consuming back()
    if (stack.length === 0) return;                   // not ours — user is leaving
    hasSentinel = false;                              // browser consumed our sentinel
    const layer = stack.pop();
    if (layer) layer.onDismiss();
    scheduleReconcile();                              // re-arm if layers remain
  }

  function push(onDismiss) {
    ensureListener();
    const id = nextId++;
    stack.push({ id, onDismiss });
    scheduleReconcile();
    return id;
  }

  function remove(id) {
    const idx = stack.findIndex((l) => l.id === id);
    if (idx === -1) return; // already popped by onPop — idempotent no-op
    stack.splice(idx, 1);
    scheduleReconcile();
  }

  return { push, remove, _state: () => ({ depth: stack.length, hasSentinel }) };
}

export const backStack =
  typeof window === 'undefined' ? null : createBackStack(window);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/nav/backStack.test.mjs`
Expected: PASS (7/7), output pristine.

- [ ] **Step 5: Commit**

```bash
git add lib/nav/backStack.js lib/nav/backStack.test.mjs
git commit -m "Add web back-stack coordinator (single sentinel, microtask reconcile) + tests"
```

---

### Task 2: `hooks/useBackHandler.js` web-only hook

**Files:**
- Create: `hooks/useBackHandler.js`

**Interfaces:**
- Consumes: `backStack` from `lib/nav/backStack.js`.
- Produces: `useBackHandler(active, onDismiss)` — while `active` is true (web only), registers a layer whose `onDismiss` runs the latest callback. No-op on native.

- [ ] **Step 1: Write the hook**

Create `hooks/useBackHandler.js`:

```js
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { backStack } from '../lib/nav/backStack';

// Web-only: while `active`, register a dismissible layer so the browser/hardware
// back button calls `onDismiss` (LIFO across all active layers). No-op on native,
// where RN Modals already handle hardware back via onRequestClose.
// The effect keys on `active` only; the ref keeps `onDismiss` fresh without
// re-registering the layer on every render (callers pass fresh closures).
export function useBackHandler(active, onDismiss) {
  const cb = useRef(onDismiss);
  cb.current = onDismiss;
  useEffect(() => {
    if (Platform.OS !== 'web' || !backStack || !active) return;
    const id = backStack.push(() => cb.current());
    return () => backStack.remove(id);
  }, [active]);
}
```

- [ ] **Step 2: Verify build**

Run: `npx expo export --platform web`
Expected: ends with "Exported: dist" (the new module compiles; it is imported by Task 3, but exporting it standalone must not error).

- [ ] **Step 3: Commit**

```bash
git add hooks/useBackHandler.js
git commit -m "Add useBackHandler hook (web-only wrapper over the back-stack)"
```

---

### Task 3: Wire `useBackHandler` into `plan.js`

**Files:**
- Modify: `app/(tabs)/plan.js` (add import near line 31; add five hook calls right after `resetToConfiguring`, i.e. after line 594)

**Interfaces:**
- Consumes: `useBackHandler` from `hooks/useBackHandler`; existing `view`/`setView`, `goToLanding`, `resetToConfiguring`, `showWeekPicker`/`setShowWeekPicker`, `showDatePicker`/`setShowDatePicker`, `showDetailModal`/`setShowDetailModal`.

- [ ] **Step 1: Add the import**

In `app/(tabs)/plan.js`, next to the existing hooks import (`import useViewportOverlay, { WEB_OVERLAY_FIX } from '../../hooks/useViewportOverlay';`, line 31), add:

```js
import { useBackHandler } from '../../hooks/useBackHandler';
```

- [ ] **Step 2: Add the five layer registrations**

In `app/(tabs)/plan.js`, immediately AFTER the `resetToConfiguring` function definition (which ends around line 594, the line `  };` closing `resetToConfiguring`) and BEFORE `const locationPillText = ...`, insert:

```js
  // Web: make the browser/hardware back button step through the DECIDE flow and
  // close open modals first (LIFO). No-op on native. See hooks/useBackHandler.js.
  useBackHandler(view !== 'landing',   goToLanding);          // configuring/itinerary -> landing
  useBackHandler(view === 'itinerary', resetToConfiguring);   // itinerary -> configuring
  useBackHandler(showWeekPicker,  () => setShowWeekPicker(false));
  useBackHandler(showDatePicker,  () => setShowDatePicker(false));
  useBackHandler(showDetailModal, () => setShowDetailModal(false));
```

(These are unconditional hook calls placed after all their dependencies are defined and before the single JSX `return` at line ~618 — the only early return in the component. Do not change any existing handler or close button; forward transitions auto-arm the sentinel and in-app closes auto-consume it.)

- [ ] **Step 3: Verify build + function count**

Run: `npx expo export --platform web`
Expected: ends with "Exported: dist".
Run: `find api -name '*.js' | wc -l`
Expected: `12`.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/plan.js"
git commit -m "plan: wire back button to step DECIDE views + close modals (web)"
```

---

### Task 4: Verify (build + real browser) & finish

**Files:** none (verification + integration).

- [ ] **Step 1: Full lib test + build sweep**

Run: `node --test lib/nav/*.test.mjs` → all pass (7/7).
Run: `node --test lib/history/*.test.mjs` and `node --test lib/smart/*.test.mjs` → confirm no regression.
Run: `npx expo export --platform web` → "Exported: dist".
Run: `find api -name '*.js' | wc -l` → `12`.

- [ ] **Step 2: Whole-branch review**

Request code review (superpowers:requesting-code-review) over the branch diff vs `main`. Focus: the coordinator's history bookkeeping (no path where `onDismiss` and the coordinator both touch history; the internal-back guard; the same-tick no-churn invariant), the web-only guards, and that the five `plan.js` registrations map to the correct dismiss actions with no missed forward transition.

- [ ] **Step 3: Real-browser verification (controller-run)**

Start the web app (`npx expo start --web`) and drive the DECIDE flow in a browser:
- landing → Today → configuring → Build my day → itinerary. Press browser Back: itinerary → configuring → landing → (next back) leaves the tab. Confirm each Back steps exactly one level (no double-press, no URL fl… path change beyond the sentinel).
- On the itinerary, open PlaceDetailModal; press Back → modal closes, view stays on itinerary.
- On landing, open the week picker; press Back → picker closes.
- Week picker → pick a day (→ configuring); press Back → configuring → landing (confirm the swap left no stray entry: exactly the expected number of Back presses).
Record the observed behavior. This step is the acceptance gate for a web-only nav feature; do not skip it.

- [ ] **Step 4: Finish the branch**

Per `feedback-finish-branch-merge-and-push`: merge `feat/browser-back-nav` to `main` locally (`--no-ff`), push `main`, push the branch. Verify the Vercel prod deployment reaches READY/green (no freeze). Then update memory ([[project-browser-back-nav]] → shipped) and write the session log.

---

## Self-Review

**Spec coverage:**
- coordinator (single sentinel, microtask reconcile, LIFO, guard) → Task 1 ✓
- web-only hook, native no-op → Task 2 ✓
- five layer registrations (2 views + 3 modals) → Task 3 ✓
- real-browser acceptance (expo-router non-re-route, no double-press) → Task 4 Step 3 ✓
- no new `api/` files / 12-cap → Global Constraints + Task 3/4 checks ✓
- out-of-scope (other screens' modals, sub-modals, time-picker dropdown, non-LIFO removal) → excluded ✓

**Placeholder scan:** none — every code step shows full code; every run step shows exact command + expected output.

**Type consistency:** `createBackStack(win)` → `{push, remove, _state}` used identically in tests and the hook (`backStack.push`/`.remove`); `_state()` shape `{depth, hasSentinel}` matches every assertion; `useBackHandler(active, onDismiss)` signature matches all five call sites; `onDismiss` is nullary. Consistent.
