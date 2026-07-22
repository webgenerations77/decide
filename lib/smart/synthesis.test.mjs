import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStops, buildSynthesisPrompt } from './synthesis.js';

const baseStop = {
  time: '18:00',
  name: 'Ocean Downs Racing',
  category: 'sports',
  lat: 38.35,
  lng: -75.15,
};

test('validateStops passthrough: verified + verify_source survive', () => {
  const [out] = validateStops([
    { ...baseStop, verified: true, verify_source: 'https://x.com/sched' },
  ]);
  assert.equal(out.verified, true);
  assert.equal(out.verify_source, 'https://x.com/sched');
});

test('validateStops mutual exclusivity: verified wins over unverified/time_note', () => {
  const [out] = validateStops([
    { ...baseStop, verified: true, unverified: true, time_note: 'confirm' },
  ]);
  assert.equal(out.verified, true);
  assert.equal('unverified' in out, false);
  assert.equal('time_note' in out, false);
});

test('validateStops non-verified unchanged: unverified/time_note pass through, no verified key', () => {
  const [out] = validateStops([
    { ...baseStop, unverified: true, time_note: 'x' },
  ]);
  assert.equal(out.unverified, true);
  assert.equal(out.time_note, 'x');
  assert.equal('verified' in out, false);
});

test('validateStops guards: verify_source not emitted without verified:true', () => {
  const [out] = validateStops([
    { ...baseStop, verify_source: 'https://stray.example.com' },
  ]);
  assert.equal('verify_source' in out, false);
  assert.equal('verified' in out, false);

  const [out2] = validateStops([
    { ...baseStop, verified: false, verify_source: 'https://stray.example.com' },
  ]);
  assert.equal('verify_source' in out2, false);
  assert.equal('verified' in out2, false);
});

test('buildSynthesisPrompt: verified find surfaces exact time, source, and no-hedge instruction', () => {
  const { user } = buildSynthesisPrompt({
    places: [],
    finds: [
      {
        title: 'Ocean Downs Harness Racing',
        lat: 38.35,
        lng: -75.15,
        interest: 'sports',
        sourceLabel: 'oceandowns.com',
        verifiedTime: '18:40',
        verifiedSource: 'https://oceandowns.com',
        timeConfidence: 'verified',
      },
    ],
    anchors: [],
    ctx: { location: 'Berlin, MD', startTime: '11:00', endTime: '20:00', prefs: {} },
  });

  assert.match(user, /18:40/);
  assert.match(user, /https:\/\/oceandowns\.com/);
  assert.match(user, /(do not hedge|VERIFIED)/i);
});
