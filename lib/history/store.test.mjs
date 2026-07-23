import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getUserHistory, clearUserHistory } from './store.js';

// ---- Minimal in-memory Firestore fake ----
function makeDb() {
  // tree: users/{uid} -> { fields, subs: { itineraries: {id: data}, decisions: {id: data} } }
  const users = new Map();
  const userNode = (uid) => {
    if (!users.has(uid)) users.set(uid, { fields: {}, subs: {} });
    return users.get(uid);
  };
  function docRef(uid) {
    const node = userNode(uid);
    return {
      get: async () => ({ exists: Object.keys(node.fields).length > 0, data: () => node.fields }),
      set: async (data, opts) => {
        node.fields = opts?.merge ? { ...node.fields, ...data } : { ...data };
      },
      collection: (type) => colRef(uid, type),
    };
  }
  function colRef(uid, type) {
    const node = userNode(uid);
    node.subs[type] ??= new Map();
    const store = node.subs[type];
    return {
      get: async () => {
        const docs = [...store.entries()].map(([id, data]) => ({
          id, data: () => data, ref: { __uid: uid, __type: type, __id: id },
        }));
        return { docs, empty: docs.length === 0 };
      },
      doc: (id) => ({
        set: async (data, opts) => {
          store.set(id, opts?.merge ? { ...(store.get(id) || {}), ...data } : { ...data });
        },
      }),
    };
  }
  return {
    collection: (name) => {
      assert.equal(name, 'users');
      return { doc: (uid) => docRef(uid) };
    },
    batch: () => {
      const ops = [];
      return {
        delete: (ref) => ops.push(['del', ref]),
        set: (ref, data, opts) => ops.push(['set', ref, data, opts]),
        commit: async () => {
          for (const op of ops) {
            if (op[0] === 'del') {
              const { __uid, __type, __id } = op[1];
              users.get(__uid).subs[__type].delete(__id);
            }
          }
        },
      };
    },
    _seed: (uid, type, items) => {
      const node = userNode(uid);
      node.subs[type] ??= new Map();
      for (const it of items) node.subs[type].set(String(it.id), it);
    },
    _fields: (uid) => userNode(uid).fields,
    _count: (uid, type) => (userNode(uid).subs[type]?.size ?? 0),
  };
}

test('getUserHistory returns clearedAt (default 0 when absent)', async () => {
  const db = makeDb();
  db._seed('u1', 'itineraries', [{ id: 'a', timestamp: 5 }]);
  const out = await getUserHistory('u1', db);
  assert.equal(out.clearedAt, 0);
  assert.equal(out.itineraries.length, 1);
  assert.deepEqual(out.decisions, []);
});

test('clearUserHistory prunes only docs older than clearedAt and sets high-water', async () => {
  const db = makeDb();
  db._seed('u1', 'itineraries', [
    { id: 'old', timestamp: 100 },
    { id: 'new', timestamp: 300 },
  ]);
  db._seed('u1', 'decisions', [{ id: 'd', timestamp: 100, updatedAt: 500 }]);
  await clearUserHistory('u1', 200, db);
  assert.equal(db._count('u1', 'itineraries'), 1); // 'old' (100<200) deleted, 'new' kept
  assert.equal(db._count('u1', 'decisions'), 1);   // stamp 500 >= 200, kept
  assert.equal(db._fields('u1').historyClearedAt, 200);
  const out = await getUserHistory('u1', db);
  assert.equal(out.clearedAt, 200);
  assert.deepEqual(out.itineraries.map((x) => x.id), ['new']);
});

test('clearUserHistory high-water is monotonic (max)', async () => {
  const db = makeDb();
  await clearUserHistory('u1', 500, db);
  await clearUserHistory('u1', 200, db); // lower — must not lower the mark
  assert.equal(db._fields('u1').historyClearedAt, 500);
});

test('clearUserHistory with clearedAt<=0 is a no-op (never nukes)', async () => {
  const db = makeDb();
  db._seed('u1', 'itineraries', [{ id: 'a', timestamp: 100 }]);
  await clearUserHistory('u1', 0, db);
  assert.equal(db._count('u1', 'itineraries'), 1);
  assert.equal(db._fields('u1').historyClearedAt, undefined);
});

test('clearUserHistory does not clobber existing user doc fields (role)', async () => {
  const db = makeDb();
  await db.collection('users').doc('u1').set({ role: 'beta_tester', email: 'x@y.z' }, { merge: true });
  await clearUserHistory('u1', 300, db);
  const f = db._fields('u1');
  assert.equal(f.role, 'beta_tester');
  assert.equal(f.email, 'x@y.z');
  assert.equal(f.historyClearedAt, 300);
});
