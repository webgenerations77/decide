import { verifyAdminRequest } from '../../../lib/admin/requireAdmin.js';
import { listUsersWithRoles, setUserRole } from '../../../lib/admin/users.js';

export async function GET(request) {
  const auth = await verifyAdminRequest(request.headers.get('authorization'));
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
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
    const { uid, role } = await request.json();
    if (!uid) return Response.json({ error: 'uid_required' }, { status: 400 });
    await setUserRole(uid, role);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'set_role_failed', message: e.message }, { status: 500 });
  }
}
