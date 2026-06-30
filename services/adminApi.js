import { auth } from './firebase';

async function authHeader() {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getUsage(range = 'day') {
  const res = await fetch(`/api/admin/usage?range=${range}`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`usage_${res.status}`);
  return res.json();
}

export async function getUsers() {
  const res = await fetch('/api/admin/users', { headers: await authHeader() });
  if (!res.ok) throw new Error(`users_${res.status}`);
  return (await res.json()).users;
}

export async function setUserRole(uid, role) {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ uid, role }),
  });
  if (!res.ok) throw new Error(`set_role_${res.status}`);
  return res.json();
}
