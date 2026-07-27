import { verifyAdminRequest } from '../../../lib/admin/requireAdmin.js';
import { listUsersWithRoles } from '../../../lib/admin/users.js';
import { handleGet, handlePost } from '../../../lib/admin/usersActions.js';
import { getUserStats } from '../../../lib/admin/userStats.js';
import { getUserHistory } from '../../../lib/history/store.js';

export async function GET(request) {
  const auth = await verifyAdminRequest(request.headers.get('authorization'));
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  // GET ?uid=<uid> → that user's activity stats; ?data=invites → pending invites;
  // GET (no uid) → full user list.
  // (Folded in from the former /api/admin/user-stats to stay under Vercel's 12-function cap.)
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');
  const data = url.searchParams.get('data');
  const shared = await handleGet({ uid, data });
  if (shared) return Response.json(shared.body, { status: shared.status });
  if (uid && data === 'history') {
    try {
      return Response.json(await getUserHistory(uid));
    } catch (e) {
      console.error('[api/admin/users] user_history_failed:', e);
      return Response.json({ error: 'user_history_failed', message: e.message }, { status: 500 });
    }
  }
  if (uid) {
    try {
      return Response.json(await getUserStats(uid));
    } catch (e) {
      console.error('[api/admin/users] user_stats_failed:', e);
      return Response.json({ error: 'user_stats_failed', message: e.message }, { status: 500 });
    }
  }
  try {
    return Response.json({ users: await listUsersWithRoles() });
  } catch (e) {
    return Response.json({ error: 'users_failed', message: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await verifyAdminRequest(request.headers.get('authorization'));
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  try {
    const body = await request.json();
    const { status, body: out } = await handlePost(body, { adminEmail: auth.email ?? null });
    return Response.json(out, { status });
  } catch (e) {
    return Response.json({ error: 'admin_action_failed', message: e.message }, { status: 500 });
  }
}
