import test from 'node:test';
import assert from 'node:assert/strict';
import { applySunsetGuard, classify } from './sunsetGuard.js';

// Window default 11:00 AM – 8:00 PM unless a ctx overrides it.
const ctx = (startTime = '11:00 AM', endTime = '8:00 PM') => ({ startTime, endTime });
const sun = (sunset, sunrise = '06:00') => ({ sunset, sunrise });

function stop(overrides = {}) {
  return {
    time: '6:00 PM',
    duration_mins: 60,
    category: 'outdoor',
    name: 'Evening stop',
    place_id: 'stop_1',
    lat: 38.3,
    lng: -75.2,
    reason: '',
    ...overrides,
  };
}

test('classify: sunset keyword beats generic outdoor', () => {
  assert.equal(classify(stop({ name: 'Sunset beach walk' })), 'sunset');
  assert.equal(classify(stop({ name: 'Boardwalk stroll' })), 'outdoor');
  assert.equal(classify(stop({ name: 'Sunrise paddle' })), 'sunrise');
  assert.equal(classify(stop({ name: 'Lunch at Joe\'s', category: 'food' })), null);
});

// #1 — sunset walk 6pm, sunset 8pm, window ends 8pm → can't finish at sunset inside the day:
// pushed as late as the window allows + flagged.
test('sunset at window end: pushes stop later and flags it', () => {
  const s = stop({ name: 'Sunset walk on the beach', time: '6:00 PM', duration_mins: 60 });
  const [out] = applySunsetGuard([s], sun('20:00'), ctx());
  assert.equal(out.time, '7:00 PM');           // moved to end at 8:00 PM (window end)
  assert.equal(out.unverified, true);
  assert.match(out.time_note, /Sunset isn't until 8:00 PM/);
});

// #2 — sunset walk 4pm (ends 5pm), sunset 8pm, roomy window, last stop → silently re-timed.
test('correctable & safe: silently re-times to finish at sunset', () => {
  const earlier = stop({ name: 'Lunch', category: 'food', time: '2:00 PM', duration_mins: 60 });
  const s = stop({ name: 'Golden hour overlook', time: '4:00 PM', duration_mins: 60 });
  const out = applySunsetGuard([earlier, s], sun('20:00'), ctx('11:00 AM', '9:00 PM'));
  assert.equal(out[1].time, '7:00 PM');        // 8:00 PM sunset − 60 min
  assert.equal(out[1].time_note, undefined);   // silent — no note on a clean correction
  assert.equal(out[1].unverified, undefined);
});

// #3 — already ends within GRACE of sunset → untouched.
test('already correct: within grace, untouched', () => {
  const s = stop({ name: 'Sunset viewpoint', time: '6:50 PM', duration_mins: 60 }); // ends 7:50
  const [out] = applySunsetGuard([s], sun('20:00'), ctx('11:00 AM', '9:00 PM'));
  assert.equal(out.time, '6:50 PM');
  assert.equal(out.time_note, undefined);
});

// #4 — mid-day sunset stop boxed between two fixed stops → flagged, not moved, order intact.
test('boxed-in sunset stop: flagged, time unchanged', () => {
  const a = stop({ name: 'Museum', category: 'arts', time: '5:00 PM', duration_mins: 60 });
  const s = stop({ name: 'Sunset overlook', time: '6:00 PM', duration_mins: 60 });
  const b = stop({ name: 'Dinner', category: 'food', time: '7:00 PM', duration_mins: 60 });
  const out = applySunsetGuard([a, s, b], sun('20:00'), ctx('11:00 AM', '9:00 PM'));
  assert.equal(out[1].time, '6:00 PM');        // not moved (would overlap dinner)
  assert.equal(out[1].unverified, true);
  assert.match(out[1].time_note, /real sunset is 8:00 PM/);
  assert.deepEqual(out.map((x) => x.name), ['Museum', 'Sunset overlook', 'Dinner']); // order intact
});

// #5 — Tier B generic outdoor running past dark → flagged, not moved.
test('tier B outdoor past sunset: flagged only', () => {
  const s = stop({ name: 'Beach walk', time: '8:00 PM', duration_mins: 60 }); // ends 9:00, sunset 8
  const [out] = applySunsetGuard([s], sun('20:00'), ctx('11:00 AM', '10:00 PM'));
  assert.equal(out.time, '8:00 PM');           // unchanged
  assert.equal(out.unverified, true);
  assert.match(out.time_note, /runs past sunset/);
});

// #6 — daytime outdoor stop well before sunset → no false positive.
test('tier B outdoor before sunset: untouched', () => {
  const s = stop({ name: 'Morning beach walk', time: '9:00 AM', duration_mins: 60 });
  const [out] = applySunsetGuard([s], sun('20:00'), ctx());
  assert.equal(out.time, '9:00 AM');
  assert.equal(out.time_note, undefined);
});

// #7 — sunset null (beyond forecast) → everything untouched.
test('sunset null: all stops untouched', () => {
  const s = stop({ name: 'Sunset walk', time: '6:00 PM' });
  const [out] = applySunsetGuard([s], sun(null), ctx());
  assert.equal(out.time, '6:00 PM');
  assert.equal(out.time_note, undefined);
});

// #8 — verified sunset stop → never flagged or overwritten.
test('verified stop: verified wins, untouched', () => {
  const s = stop({
    name: 'Sunset cruise',
    time: '6:00 PM',
    verified: true,
    verify_source: 'https://example.com/cruise',
  });
  const [out] = applySunsetGuard([s], sun('20:00'), ctx());
  assert.equal(out.time, '6:00 PM');
  assert.equal(out.time_note, undefined);
  assert.equal(out.unverified, undefined);
});

// #9 — malformed stop time → that stop skipped, siblings still processed, no throw.
test('malformed time: skipped, others processed', () => {
  const bad = stop({ name: 'Sunset walk', time: 'half past six' });
  const good = stop({ name: 'Golden hour overlook', time: '4:00 PM', duration_mins: 60 });
  const out = applySunsetGuard([bad, good], sun('20:00'), ctx('11:00 AM', '9:00 PM'));
  assert.equal(out[0].time, 'half past six');  // untouched
  assert.equal(out[1].time, '7:00 PM');        // still corrected
});

// #10 — idempotency across all outcome types.
test('idempotency: guard(guard(x)) === guard(x)', () => {
  const stops = [
    stop({ name: 'Lunch', category: 'food', time: '2:00 PM' }),
    stop({ name: 'Sunset walk', time: '4:00 PM' }),         // correctable
    stop({ name: 'Beach boardwalk', time: '8:30 PM' }),     // tier B flag
  ];
  const once = applySunsetGuard(stops, sun('20:00'), ctx('11:00 AM', '10:00 PM'));
  const twice = applySunsetGuard(once, sun('20:00'), ctx('11:00 AM', '10:00 PM'));
  assert.deepEqual(twice, once);
});

// Non-array / empty guards.
test('non-array and empty inputs: returned as-is', () => {
  assert.equal(applySunsetGuard(null, sun('20:00'), ctx()), null);
  assert.deepEqual(applySunsetGuard([], sun('20:00'), ctx()), []);
});
