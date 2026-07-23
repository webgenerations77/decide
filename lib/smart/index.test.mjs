import test from 'node:test';
import assert from 'node:assert/strict';
import { runSmartEngine } from './index.js';

const ctx = {
  travelDates: { start: '2026-07-25' },
  dayOfWeek: 'Saturday',
  location: 'Berlin, MD',
};

function scoutFind(overrides = {}) {
  return {
    title: 'Riverside Summer Concert',
    category: 'music',
    interest: 'live music',
    url: 'https://example.com/concert',
    ...overrides,
  };
}

function baseDeps(overrides = {}) {
  return {
    runScout: async () => ['hunt-1'],
    runDiscovery: async () => [scoutFind()],
    runEvents: async () => [],
    annotateEventTimes: async (finds) => finds,
    pickAnchors: async () => [],
    runSynthesis: async () => [{ name: 'Stop 1' }],
    ...overrides,
  };
}

test('call order: verifyEventTimes runs after annotateEventTimes and before pickAnchors', async () => {
  const order = [];
  const deps = baseDeps({
    annotateEventTimes: async (finds) => { order.push('annotateEventTimes'); return finds; },
    verifyEventTimes: async (finds) => { order.push('verifyEventTimes'); return finds; },
    pickAnchors: async () => { order.push('pickAnchors'); return []; },
  });

  const result = await runSmartEngine({ ctx, places: {} }, deps);

  assert.deepEqual(order, ['annotateEventTimes', 'verifyEventTimes', 'pickAnchors']);
  assert.equal(result.itinerary.length, 1);
});

test('propagation: a find mutated by verifyEventTimes is visible to runSynthesis', async () => {
  let synthesisFinds = null;
  const deps = baseDeps({
    verifyEventTimes: async (finds) => {
      finds.forEach((f) => { f.verifiedTime = '18:40'; });
      return finds;
    },
    runSynthesis: async ({ finds }) => {
      synthesisFinds = finds;
      return [{ name: 'Stop 1' }];
    },
  });

  await runSmartEngine({ ctx, places: {} }, deps);

  assert.ok(synthesisFinds);
  assert.equal(synthesisFinds.length, 1);
  assert.equal(synthesisFinds[0].verifiedTime, '18:40');
});

test('timeout fail-open: a never-resolving verifyEventTimes does not hang runSmartEngine', async () => {
  const deps = baseDeps({
    verifyEventTimes: () => new Promise(() => {}), // never resolves
    verifyTimeoutMs: 20,
  });

  const result = await runSmartEngine({ ctx, places: {} }, deps);

  assert.deepEqual(result.itinerary, [{ name: 'Stop 1' }]);
  assert.equal(result.hadLiveData, true);
});
