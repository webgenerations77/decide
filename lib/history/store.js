import { getAdminDb } from '../firebaseAdmin.cjs';

const TYPES = ['itineraries', 'decisions'];

function userCol(db, uid, type) {
  return db.collection('users').doc(uid).collection(type);
}

export async function getUserHistory(uid, db = getAdminDb()) {
  const out = {};
  for (const type of TYPES) {
    const snap = await userCol(db, uid, type).get();
    out[type] = snap.docs
      .map((d) => d.data())
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }
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

export async function clearUserHistory(uid, db = getAdminDb()) {
  for (const type of TYPES) {
    const snap = await userCol(db, uid, type).get();
    if (snap.empty) continue;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
