import { verifyAdminRequest } from '../../lib/admin/requireAdmin.js';
import { getUserStats } from '../../lib/admin/userStats.js';

export default async function handler(req, res) {
  const auth = await verifyAdminRequest(req.headers.authorization);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const uid = req.query.uid;
  if (!uid) return res.status(400).json({ error: 'uid_required' });
  try {
    return res.json(await getUserStats(uid));
  } catch (e) {
    console.error('[api/admin/user-stats] user_stats_failed:', e);
    return res.status(500).json({ error: 'user_stats_failed', message: e.message });
  }
}
