import { verifyAdminRequest } from '../../lib/admin/requireAdmin.js';
import { fetchUsage } from '../../lib/admin/usage.js';

export default async function handler(req, res) {
  const auth = await verifyAdminRequest(req.headers.authorization);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  try {
    const data = await fetchUsage(req.query.range || 'day');
    return res.json(data);
  } catch (e) {
    console.error('[api/admin/usage] usage_failed:', e);
    return res.status(500).json({ error: 'usage_failed', message: e.message });
  }
}
