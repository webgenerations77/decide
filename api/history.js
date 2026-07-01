import { getUidFromAuth } from '../lib/admin/auth.js';
import { getUserHistory, upsertItems, clearUserHistory } from '../lib/history/store.js';

export default async function handler(req, res) {
  const uid = await getUidFromAuth(req.headers.authorization);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  try {
    if (req.method === 'GET') {
      return res.json(await getUserHistory(uid));
    }
    if (req.method === 'POST') {
      const { type, items } = req.body ?? {};
      await upsertItems(uid, type, items);
      return res.json({ ok: true });
    }
    if (req.method === 'DELETE') {
      await clearUserHistory(uid);
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('[api/history] failed:', e);
    return res.status(500).json({ error: 'history_failed', message: e.message });
  }
}
