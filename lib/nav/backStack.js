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
