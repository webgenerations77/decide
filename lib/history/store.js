import { getAdminDb } from '../firebaseAdmin.cjs';

const TYPES = ['itineraries', 'decisions'];

function userDoc(db, uid) {
  return db.collection('users').doc(uid);
}
function userCol(db, uid, type) {
  return userDoc(db, uid).collection(type);
}
function stamp(item) {
  return item?.updatedAt ?? item?.timestamp ?? 0;
}
async function readClearedAt(db, uid) {
  const snap = await userDoc(db, uid).get();
  return (snap.exists ? snap.data()?.historyClearedAt : 0) ?? 0;
}

export async function getUserHistory(uid, db = getAdminDb()) {
  const out = {};
  for (const type of TYPES) {
    const snap = await userCol(db, uid, type).get();
    out[type] = snap.docs
      .map((d) => d.data())
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }
  out.clearedAt = await readClearedAt(db, uid);
  return out;
}

export async function upsertItems(uid, type, items, db = getAdminDb()) {
  if (!TYPES.includes(type) || !Array.isArray(items) || items.length === 0) return 0;
  const col = userCol(db, uid, type);
  const batch = db.batch();
  for (const item of items) {
    if (!item || item.id == null) continue;
    batch.set(col.doc(String(item.id)), item, { merge: true });
  }
  await batch.commit();
  return items.length;
}

// Idempotent prune: delete only docs older than `clearedAt`, then advance the
// per-user high-water mark. Safe to re-run (never deletes items newer than the
// cut). clearedAt <= 0 is a no-op so a bodyless DELETE can never nuke history.
export async function clearUserHistory(uid, clearedAt = 0, db = getAdminDb()) {
  const cutoff = Number(clearedAt) || 0;
  if (cutoff <= 0) return;
  for (const type of TYPES) {
    const snap = await userCol(db, uid, type).get();
    if (snap.empty) continue;
    const batch = db.batch();
    let n = 0;
    snap.docs.forEach((d) => {
      if (stamp(d.data()) < cutoff) { batch.delete(d.ref); n++; }
    });
    if (n) await batch.commit();
  }
  const existing = await readClearedAt(db, uid);
  await userDoc(db, uid).set({ historyClearedAt: Math.max(existing, cutoff) }, { merge: true });
}
