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

// Like makeFakeWin but back() fires popstate ASYNCHRONOUSLY (models real browsers).
function makeAsyncFakeWin() {
  const entries = [{ state: null }];
  let index = 0;
  const listeners = [];
  function emit() { const ev = { state: entries[index].state }; for (const fn of listeners) fn(ev); }
  return {
    history: {
      pushState(state) { entries.length = index + 1; entries.push({ state }); index++; },
      back() { setTimeout(() => { if (index > 0) index--; emit(); }, 0); },
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

test('async popstate: close-to-empty then reopen before the popstate resolves keeps ONE sentinel', async () => {
  const win = makeAsyncFakeWin();
  const bs = createBackStack(win);
  const id = bs.push(() => {});
  await tick();
  assert.equal(bs._state().hasSentinel, true);
  bs.remove(id);                 // stack empty -> reconcile -> back() (async popstate pending)
  await Promise.resolve();       // run the reconcile microtask: back() called, pendingPop=true
  bs.push(() => {});             // reopen BEFORE the deferred popstate
  await tick();                  // flush deferred popstate + reconcile
  assert.equal(bs._state().depth, 1);
  assert.equal(bs._state().hasSentinel, true);
  assert.equal(win.history.length, 2);   // exactly ONE sentinel, not two
  assert.equal(win.history._index(), 1);
});

test('stray user back after the stack emptied (listener attached) is ignored', async () => {
  const win = makeFakeWin();
  const bs = createBackStack(win);
  let dismissed = 0;
  const id = bs.push(() => { dismissed++; });
  await tick();
  win.history.back();            // real back pops the layer
  assert.equal(dismissed, 1);
  await tick();
  win.history.back();            // stray back, stack already empty
  await tick();
  assert.equal(dismissed, 1);    // no double-dismiss
  assert.equal(bs._state().depth, 0);
});
