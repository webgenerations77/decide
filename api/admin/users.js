import { verifyAdminRequest } from '../../lib/admin/requireAdmin.js';
import { listUsersWithRoles } from '../../lib/admin/users.js';
import { handleGet, handlePost } from '../../lib/admin/usersActions.js';
import { getUserStats } from '../../lib/admin/userStats.js';
import { getUserHistory } from '../../lib/history/store.js';

export default async function handler(req, res) {
  const auth = await verifyAdminRequest(req.headers.authorization);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (req.method === 'POST') {
    try {
      const { status, body } = await handlePost(req.body || {}, { adminEmail: auth.email ?? null });
      return res.status(status).json(body);
    } catch (e) {
      return res.status(500).json({ error: 'admin_action_failed', message: e.message });
    }
  }
  // GET ?uid=<uid> → that user's activity stats; ?data=invites → pending invites;
  // GET (no uid) → full user list.
  // (Folded in from the former /api/admin/user-stats to stay under Vercel's 12-function cap.)
  const shared = await handleGet({ uid: req.query.uid, data: req.query.data });
  if (shared) return res.status(shared.status).json(shared.body);
  if (req.query.uid && req.query.data === 'history') {
    try {
      return res.json(await getUserHistory(req.query.uid));
    } catch (e) {
      console.error('[api/admin/users] user_history_failed:', e);
      return res.status(500).json({ error: 'user_history_failed', message: e.message });
    }
  }
  if (req.query.uid) {
    try {
      return res.json(await getUserStats(req.query.uid));
    } catch (e) {
      console.error('[api/admin/users] user_stats_failed:', e);
      return res.status(500).json({ error: 'user_stats_failed', message: e.message });
    }
  }
  try {
    return res.json({ users: await listUsersWithRoles() });
  } catch (e) {
    console.error('[api/admin/users] users_failed:', e);
    return res.status(500).json({ error: 'users_failed', message: e.message });
  }
}
