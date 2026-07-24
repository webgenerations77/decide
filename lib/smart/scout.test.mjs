import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScoutPrompt, validateHunts } from './scout.js';

const baseCtx = (over = {}) => ({
  location: 'Berlin, MD',
  travelDates: { start: '2026-07-25' },
  prefs: { group_type: 'couple', pace: 'moderate', activityStyles: [], cuisines: [], interests: [] },
  feedback: { likedPlaces: [], dislikedPlaces: [] },
  tripNote: '',
  ...over,
});

test('buildScoutPrompt: curated interests, loved places, and avoid list all surface', () => {
  const prompt = buildScoutPrompt(baseCtx({
    prefs: { group_type: 'family', pace: 'relaxed', activityStyles: [], cuisines: [], interests: ['pinball', 'vinyl records'] },
    feedback: { likedPlaces: ['Burley Oak'], dislikedPlaces: ['Touristy Crab Shack'] },
  }));
  assert.match(prompt, /Standing interests they curated: pinball, vinyl records/);
  assert.match(prompt, /Places they love: Burley Oak/);
  assert.match(prompt, /Never suggest \/ avoid: Touristy Crab Shack/);
  assert.match(prompt, /Never surface anything on the avoid list/);
  assert.match(prompt, /trip note names specific interests, prioritize those/i);
});

test('buildScoutPrompt: empty taste profile renders clean fallbacks (no undefined)', () => {
  const prompt = buildScoutPrompt(baseCtx());
  assert.match(prompt, /Standing interests they curated: none given/);
  assert.match(prompt, /Places they love: none/);
  assert.match(prompt, /Never suggest \/ avoid: none/);
  assert.doesNotMatch(prompt, /undefined/);
});

test('buildScoutPrompt: missing feedback/prefs objects do not throw', () => {
  const prompt = buildScoutPrompt({ location: 'X', travelDates: { start: '2026-07-25' } });
  assert.match(prompt, /Standing interests they curated: none given/);
  assert.match(prompt, /Never suggest \/ avoid: none/);
});

test('validateHunts still caps at 8 and drops blanks', () => {
  const raw = { hunts: Array.from({ length: 12 }, (_, i) => ({ interest: `x${i}` })).concat([{ interest: '' }]) };
  assert.equal(validateHunts(raw).length, 8);
});
