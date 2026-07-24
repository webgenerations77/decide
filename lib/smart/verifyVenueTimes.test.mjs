import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyVenueTimes,
  selectEventVenues,
  MAX_VENUE_VERIFY,
} from './verifyVenueTimes.js';

const ctx = {
  travelDates: { start: '2026-07-25' },
  dayOfWeek: 'Saturday',
  location: 'Berlin, MD',
};

const place = (over = {}) => ({
  name: 'A Place',
  place_id: `pid_${Math.round((over.lat || 0) * 1000)}`,
  address: '1 Main St',
  summary: null,
  lat: 38.3,
  lng: -75.2,
  ...over,
});

const racetrack = () => place({ name: 'Ocean Downs Racetrack', place_id: 'pid_downs', lat: 38.4 });
const theater = () => place({ name: 'Globe Theatre', place_id: 'pid_globe', lat: 38.5 });
const restaurant = () => place({ name: 'Joe\'s Diner', place_id: 'pid_joe', lat: 38.1 });

// ─── selectEventVenues ──────────────────────────────────────────────────────

test('#1 selectEventVenues: picks venues among restaurants/shops, caps, drops the rest', () => {
  const places = {
    food: [restaurant(), place({ name: 'Taco Stand', place_id: 'pid_taco' })],
    activity: [racetrack(), theater()],
    shopping: [place({ name: 'Gift Shop', place_id: 'pid_gift' })],
  };
  const picked = selectEventVenues(places);
  assert.equal(picked.length, MAX_VENUE_VERIFY);
  const names = picked.map((p) => p.place.name).sort();
  assert.deepEqual(names, ['Globe Theatre', 'Ocean Downs Racetrack']);
});

test('#2 selectEventVenues: matches on summary when name does not', () => {
  const p = place({ name: 'The Berlin Bowl', place_id: 'pid_bowl', summary: 'Historic amphitheater and concert hall.' });
  const picked = selectEventVenues([p, restaurant()]);
  assert.deepEqual(picked.map((x) => x.place.name), ['The Berlin Bowl']);
  assert.equal(picked[0].category, 'performance');
});

test('#3 selectEventVenues: ordinary venues never selected', () => {
  const picked = selectEventVenues([
    restaurant(),
    place({ name: 'City Park', place_id: 'pid_park' }),
    place({ name: 'History Museum', place_id: 'pid_mus' }),
  ]);
  assert.deepEqual(picked, []);
});

test('#3b selectEventVenues: name match outranks summary match (rank order)', () => {
  const summaryOnly = place({ name: 'The Yard', place_id: 'pid_yard', summary: 'has a small arena' });
  const nameMatch = racetrack();
  const picked = selectEventVenues([summaryOnly, nameMatch]);
  assert.equal(picked[0].place.name, 'Ocean Downs Racetrack'); // rank 0 first
});

// ─── verifyVenueTimes ───────────────────────────────────────────────────────

test('#4 verify: recurring Saturday first post → promoted verified find, place removed', async () => {
  const deps = {
    search: async () => [{ url: 'https://oceandowns.example/racing', title: 'Racing', description: '' }],
    scrape: async () => 'Live harness racing. Saturdays, first post 6:40 PM.',
    createMessage: async () => '```json\n{"startTime":"18:40","confidence":"high"}\n```',
  };
  const { promotedFinds, removePlaceIds } = await verifyVenueTimes({ activity: [racetrack()] }, ctx, deps);

  assert.equal(promotedFinds.length, 1);
  const f = promotedFinds[0];
  assert.equal(f.title, 'Ocean Downs Racetrack');
  assert.equal(f.verifiedTime, '18:40');
  assert.equal(f.verifiedSource, 'https://oceandowns.example/racing');
  assert.equal(f.timeConfidence, 'verified');
  assert.equal(f.category, 'racing');
  assert.equal(f.sourceLabel, 'Venue schedule');
  assert.ok(removePlaceIds.has('pid_downs'));
});

test('#5 verify: non-matching weekday (model returns null) → not promoted, place untouched', async () => {
  const deps = {
    search: async () => [{ url: 'https://x.example/s', title: 's', description: '' }],
    scrape: async () => 'Racing on Fridays only.',
    createMessage: async () => '{"startTime":null,"confidence":null}',
  };
  const { promotedFinds, removePlaceIds } = await verifyVenueTimes({ activity: [racetrack()] }, ctx, deps);
  assert.equal(promotedFinds.length, 0);
  assert.equal(removePlaceIds.size, 0);
});

test('#5b verify: low-confidence extraction rejected', async () => {
  const deps = {
    search: async () => [{ url: 'https://x.example/s', title: 's', description: '' }],
    scrape: async () => 'Shows sometimes in the evening.',
    createMessage: async () => '{"startTime":"19:00","confidence":"low"}',
  };
  const { promotedFinds } = await verifyVenueTimes({ activity: [theater()] }, ctx, deps);
  assert.equal(promotedFinds.length, 0);
});

test('#6 verify: no source page found → not promoted', async () => {
  const deps = {
    search: async () => [],
    scrape: async () => { throw new Error('should not scrape'); },
    createMessage: async () => '{"startTime":"18:40","confidence":"high"}',
  };
  const { promotedFinds, removePlaceIds } = await verifyVenueTimes({ activity: [racetrack()] }, ctx, deps);
  assert.equal(promotedFinds.length, 0);
  assert.equal(removePlaceIds.size, 0);
});

test('#7 verify: scrape throwing is fail-open (no throw, not promoted)', async () => {
  const deps = {
    search: async () => [{ url: 'https://x.example/s', title: 's', description: '' }],
    scrape: async () => { throw new Error('scrape blew up'); },
    createMessage: async () => '{"startTime":"18:40","confidence":"high"}',
  };
  let result;
  await assert.doesNotReject(async () => {
    result = await verifyVenueTimes({ activity: [racetrack()] }, ctx, deps);
  });
  assert.equal(result.promotedFinds.length, 0);
});

test('#8 verify: no createMessage seam and no ANTHROPIC key → no-op', async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const deps = {
      search: async () => [{ url: 'https://x.example/s', title: 's', description: '' }],
      scrape: async () => 'Saturdays, first post 6:40 PM.',
      // no createMessage → extractConfirmedTime gates on the real key, which is unset
    };
    const { promotedFinds } = await verifyVenueTimes({ activity: [racetrack()] }, ctx, deps);
    assert.equal(promotedFinds.length, 0);
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});

test('#9 verify: more than MAX_VENUE_VERIFY candidates → only MAX verified', async () => {
  let scrapes = 0;
  const deps = {
    search: async () => [{ url: 'https://x.example/s', title: 's', description: '' }],
    scrape: async () => { scrapes += 1; return 'Saturdays, first post 6:40 PM.'; },
    createMessage: async () => '{"startTime":"18:40","confidence":"high"}',
  };
  const places = {
    activity: [
      place({ name: 'Speedway One', place_id: 'pid_s1' }),
      place({ name: 'Arena Two', place_id: 'pid_s2' }),
      place({ name: 'Opera Three', place_id: 'pid_s3' }),
    ],
  };
  const { promotedFinds } = await verifyVenueTimes(places, ctx, deps);
  assert.equal(promotedFinds.length, MAX_VENUE_VERIFY); // 2
  assert.equal(scrapes, MAX_VENUE_VERIFY);              // never scraped the 3rd
});

test('no venues present: empty result, no calls', async () => {
  let called = false;
  const deps = { search: async () => { called = true; return []; }, scrape: async () => '', createMessage: async () => '{}' };
  const { promotedFinds, removePlaceIds } = await verifyVenueTimes({ food: [restaurant()] }, ctx, deps);
  assert.equal(promotedFinds.length, 0);
  assert.equal(removePlaceIds.size, 0);
  assert.equal(called, false);
});
