import { verifyAdminRequest } from '../../../lib/admin/requireAdmin.js';
import { fetchUsage } from '../../../lib/admin/usage.js';
import { fetchFirecrawlCredits } from '../../../lib/admin/firecrawlCredits.js';

export async function GET(request) {
  const auth = await verifyAdminRequest(request.headers.get('authorization'));
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const range = new URL(request.url).searchParams.get('range') || 'day';
  try {
    // In parallel, and the credits call never rejects — a third party being slow or down must
    // not cost the admin their usage numbers.
    const [data, firecrawl] = await Promise.all([
      fetchUsage(range),
      fetchFirecrawlCredits(),
    ]);
    return Response.json({ ...data, firecrawl });
  } catch (e) {
    return Response.json({ error: 'usage_failed', message: e.message }, { status: 500 });
  }
}
