import { verifyAdminRequest } from '../../../lib/admin/requireAdmin.js';
import { getUserStats } from '../../../lib/admin/userStats.js';

export async function GET(request) {
  const auth = await verifyAdminRequest(request.headers.get('authorization'));
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const uid = new URL(request.url).searchParams.get('uid');
  if (!uid) return Response.json({ error: 'uid_required' }, { status: 400 });
  try {
    return Response.json(await getUserStats(uid));
  } catch (e) {
    return Response.json({ error: 'user_stats_failed', message: e.message }, { status: 500 });
  }
}
