// __tests__/history-store.mjs — run: node __tests__/history-store.mjs
import { getUserHistory, upsertItems, clearUserHistory } from '../lib/history/store.js';
let passed = 0, failed = 0;
const assert = (l, c, d = '') => c ? (console.log(`  ✓ ${l}`), passed++) : (console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`), failed++);

// Fake Firestore: users/{uid}/{type} collections backed by plain maps.
function makeFakeDb(seed = {}) {
  const store = seed; // { 'uid/itineraries': { id: data } }
  const ops = { sets: [], deletes: [] };
  const colKey = (uid, type) => `${uid}/${type}`;
  const docRef = (uid, type, id) => ({ __key: colKey(uid, type), __id: id });
  const collection = (name) => ({
    doc: (uid) => ({
      collection: (type) => ({
        get: async () => {
          const m = store[colKey(uid, type)] || {};
          return { empty: Object.keys(m).length === 0,
            docs: Object.entries(m).map(([id, data]) => ({ id, data: () => data, ref: docRef(uid, type, id) })) };
        },
        doc: (id) => docRef(uid, type, id),
      }),
    }),
  });
  const batch = () => ({
    set: (ref, data, opts) => { ops.sets.push({ ref, data, opts });
      (store[ref.__key] ??= {})[ref.__id] = data; },
    delete: (ref) => { ops.deletes.push({ ref }); delete (store[ref.__key] || {})[ref.__id]; },
    commit: async () => {},
  });
  return { db: { collection, batch }, ops, store };
}

// getUserHistory sorts by timestamp desc
{
  const { db } = makeFakeDb({ 'u1/itineraries': { a: { id: 'a', timestamp: 1 }, b: { id: 'b', timestamp: 5 } }, 'u1/decisions': {} });
  const out = await getUserHistory('u1', db);
  assert('returns both types', Array.isArray(out.itineraries) && Array.isArray(out.decisions));
  assert('itineraries sorted desc', out.itineraries[0].id === 'b' && out.itineraries[1].id === 'a');
}

// upsertItems writes each item by String(id) with merge
{
  const { db, ops, store } = makeFakeDb();
  const n = await upsertItems('u1', 'itineraries', [{ id: 7, timestamp: 3 }, { id: 8, timestamp: 4 }], db);
  assert('upsert returns count', n === 2);
  assert('set called with merge', ops.sets.length === 2 && ops.sets[0].opts?.merge === true);
  assert('doc id stringified', store['u1/itineraries']['7']?.timestamp === 3);
}

// upsertItems no-ops on bad type / empty
{
  const { db } = makeFakeDb();
  assert('bad type no-op', (await upsertItems('u1', 'nope', [{ id: 1 }], db)) === 0);
  assert('empty no-op', (await upsertItems('u1', 'decisions', [], db)) === 0);
}

// clearUserHistory deletes everything
{
  const { db, store } = makeFakeDb({ 'u1/itineraries': { a: { id: 'a' } }, 'u1/decisions': { d: { id: 'd' } } });
  await clearUserHistory('u1', db);
  assert('itineraries cleared', Object.keys(store['u1/itineraries']).length === 0);
  assert('decisions cleared', Object.keys(store['u1/decisions']).length === 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
