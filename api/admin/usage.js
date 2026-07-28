import { verifyAdminRequest } from '../../lib/admin/requireAdmin.js';
import { fetchUsage } from '../../lib/admin/usage.js';
import { fetchFirecrawlCredits } from '../../lib/admin/firecrawlCredits.js';

export default async function handler(req, res) {
  const auth = await verifyAdminRequest(req.headers.authorization);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  try {
    // In parallel, and the credits call never rejects — a third party being slow or down must
    // not cost the admin their usage numbers.
    const [data, firecrawl] = await Promise.all([
      fetchUsage(req.query.range || 'day'),
      fetchFirecrawlCredits(),
    ]);
    return res.json({ ...data, firecrawl });
  } catch (e) {
    console.error('[api/admin/usage] usage_failed:', e);
    return res.status(500).json({ error: 'usage_failed', message: e.message });
  }
}
