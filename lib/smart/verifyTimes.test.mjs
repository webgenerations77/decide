import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyEventTimes,
  selectTimeSensitive,
  pickSourceUrl,
} from './verifyTimes.js';

const ctx = {
  travelDates: { start: '2026-07-25' },
  dayOfWeek: 'Saturday',
  location: 'Berlin, MD',
};

function concertFind(overrides = {}) {
  return {
    title: 'Riverside Summer Concert',
    category: 'music',
    interest: 'live music',
    sourceLabel: 'Local events',
    url: 'https://example.com/concert',
    snippet: 'Live music on the river',
    startTime: null,
    timeConfidence: null,
    ...overrides,
  };
}

test('selectTimeSensitive: picks event-type unverified finds, excludes non-events and already-confirmed', () => {
  const restaurant = { title: 'Joe\'s Diner', category: 'food', interest: 'dinner', url: 'https://joes.example' };
  const beach = { title: 'North Beach', category: 'outdoor', interest: 'sightseeing' };
  const highConfidence = concertFind({ title: 'Already confirmed show', timeConfidence: 'high' });
  const verified = concertFind({ title: 'Already verified show', timeConfidence: 'verified' });
  const lowConfidence = concertFind({ title: 'Implied time show', timeConfidence: 'low' });
  const noConfidence = concertFind({ title: 'Unconfirmed show', timeConfidence: null });

  const finds = [restaurant, beach, highConfidence, verified, lowConfidence, noConfidence];
  const selected = selectTimeSensitive(finds);

  assert.deepEqual(selected, [lowConfidence, noConfidence]);
});

test('selectTimeSensitive: caps result at 3 even when 5 qualify', () => {
  const finds = [1, 2, 3, 4, 5].map((n) => concertFind({ title: `Show ${n}` }));
  const selected = selectTimeSensitive(finds);
  assert.equal(selected.length, 3);
  assert.deepEqual(selected, finds.slice(0, 3));
});

test('pickSourceUrl: returns the find url when http(s)', () => {
  const result = pickSourceUrl({ url: 'https://example.com/event' });
  assert.deepEqual(result, { url: 'https://example.com/event', needsSearch: false });
});

test('pickSourceUrl: returns needsSearch:true when url absent', () => {
  assert.deepEqual(pickSourceUrl({ url: null }), { url: null, needsSearch: true });
  assert.deepEqual(pickSourceUrl({}), { url: null, needsSearch: true });
});

test('happy path: high-confidence extraction sets verifiedTime/verifiedSource/timeConfidence', async () => {
  const find = concertFind();
  const deps = {
    scrape: async (url) => {
      assert.equal(url, 'https://example.com/concert');
      return '# Riverside Summer Concert\nGates open 6pm, music starts 6:40pm on July 25.';
    },
    createMessage: async () => '```json\n{"startTime":"18:40","confidence":"high"}\n```',
  };

  const result = await verifyEventTimes([find], ctx, deps);

  assert.equal(result[0], find);
  assert.equal(find.verifiedTime, '18:40');
  assert.equal(find.verifiedSource, 'https://example.com/concert');
  assert.equal(find.timeConfidence, 'verified');
});

test('low/null confidence leaves the find untouched', async () => {
  const findLow = concertFind({ title: 'Low confidence show' });
  const depsLow = {
    scrape: async () => 'some vague page text',
    createMessage: async () => '{"startTime":"19:00","confidence":"low"}',
  };
  await verifyEventTimes([findLow], ctx, depsLow);
  assert.equal(findLow.verifiedTime, undefined);
  assert.equal(findLow.verifiedSource, undefined);
  assert.equal(findLow.timeConfidence, null);

  const findNull = concertFind({ title: 'No time found show' });
  const depsNull = {
    scrape: async () => 'page with no time info',
    createMessage: async () => '{"startTime":null,"confidence":null}',
  };
  await verifyEventTimes([findNull], ctx, depsNull);
  assert.equal(findNull.verifiedTime, undefined);
  assert.equal(findNull.timeConfidence, null);
});

test('fail-open: scrape throwing resolves (does not reject) and leaves the find untouched', async () => {
  const find = concertFind({ title: 'Will fail to scrape' });
  const deps = {
    scrape: async () => { throw new Error('scrape blew up'); },
    createMessage: async () => '{"startTime":"18:00","confidence":"high"}',
  };

  await assert.doesNotReject(verifyEventTimes([find], ctx, deps));
  assert.equal(find.verifiedTime, undefined);
  assert.equal(find.timeConfidence, null);
});

test('empty array and non-array input return the input unchanged', async () => {
  const empty = [];
  const emptyResult = await verifyEventTimes(empty, ctx);
  assert.equal(emptyResult, empty);

  const notArray = { not: 'an array' };
  const notArrayResult = await verifyEventTimes(notArray, ctx);
  assert.equal(notArrayResult, notArray);

  const nullResult = await verifyEventTimes(null, ctx);
  assert.equal(nullResult, null);
});

test('search fallback: find with no url uses deps.search and its top result flows into scrape', async () => {
  const find = concertFind({ title: 'No-url festival', url: null });
  let searchCalled = false;
  let searchQuery = null;
  let scrapedUrl = null;

  const deps = {
    search: async (query, limit) => {
      searchCalled = true;
      searchQuery = query;
      assert.equal(limit, 3);
      return [
        { title: 'Festival page', url: 'https://found.example.com/festival', description: '' },
        { title: 'Other', url: 'https://other.example.com', description: '' },
      ];
    },
    scrape: async (url) => {
      scrapedUrl = url;
      return 'Festival starts at 5:15pm on this date.';
    },
    createMessage: async () => '{"startTime":"17:15","confidence":"high"}',
  };

  await verifyEventTimes([find], ctx, deps);

  assert.equal(searchCalled, true);
  assert.match(searchQuery, /No-url festival/);
  assert.equal(scrapedUrl, 'https://found.example.com/festival');
  assert.equal(find.verifiedTime, '17:15');
  assert.equal(find.verifiedSource, 'https://found.example.com/festival');
});
