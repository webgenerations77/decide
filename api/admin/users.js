import { verifyAdminRequest } from '../../lib/admin/requireAdmin.js';
import { listUsersWithRoles, setUserRole } from '../../lib/admin/users.js';

export default async function handler(req, res) {
  const auth = await verifyAdminRequest(req.headers.authorization);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (req.method === 'POST') {
    try {
      const { uid, role } = req.body || {};
      if (!uid) return res.status(400).json({ error: 'uid_required' });
      await setUserRole(uid, role);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'set_role_failed', message: e.message });
    }
  }
  try {
    return res.json({ users: await listUsersWithRoles() });
  } catch (e) {
    return res.status(500).json({ error: 'users_failed', message: e.message });
  }
}
