import { getUidFromAuth } from '../../lib/admin/auth.js';
import { getUserHistory, upsertItems, clearUserHistory } from '../../lib/history/store.js';

async function requireUid(request) {
  const uid = await getUidFromAuth(request.headers.get('authorization'));
  return uid || null;
}

export async function GET(request) {
  const uid = await requireUid(request);
  if (!uid) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return Response.json(await getUserHistory(uid));
  } catch (e) {
    return Response.json({ error: 'history_failed', message: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const uid = await requireUid(request);
  if (!uid) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { type, items } = await request.json();
    await upsertItems(uid, type, items);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'history_failed', message: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const uid = await requireUid(request);
  if (!uid) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await clearUserHistory(uid);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'history_failed', message: e.message }, { status: 500 });
  }
}
