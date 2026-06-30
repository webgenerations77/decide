import { verifyAdminRequest } from '../../../lib/admin/requireAdmin.js';
import { fetchUsage } from '../../../lib/admin/usage.js';

export async function GET(request) {
  const auth = await verifyAdminRequest(request.headers.get('authorization'));
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const range = new URL(request.url).searchParams.get('range') || 'day';
  try {
    const data = await fetchUsage(range);
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: 'usage_failed', message: e.message }, { status: 500 });
  }
}
