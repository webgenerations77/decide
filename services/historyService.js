import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase';
import { getApiBase } from './apiBase';
import { mergeById } from '../lib/history/merge.js';

const KEYS = { itineraries: '@decide/itineraries', decisions: '@decide/decisions' };
const CAPS = { itineraries: 50, decisions: 100 };
const TYPES = ['itineraries', 'decisions'];

async function authHeader() {
  try {
    const token = await auth.currentUser?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function readCache(type) {
  try { const raw = await AsyncStorage.getItem(KEYS[type]); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
async function writeCache(type, list) {
  try { await AsyncStorage.setItem(KEYS[type], JSON.stringify(list.slice(0, CAPS[type]))); } catch {}
}

export async function loadHistory() {
  const [itineraries, decisions] = await Promise.all([readCache('itineraries'), readCache('decisions')]);
  return { itineraries, decisions };
}

// best-effort POST upsert; silently no-ops when signed out or offline
async function postUpsert(type, items) {
  try {
    const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
    if (!headers.Authorization) return;
    await fetch(`${getApiBase()}/api/history`, {
      method: 'POST', headers, body: JSON.stringify({ type, items }),
    });
  } catch {}
}

async function upsertLocal(type, entry) {
  const cache = await readCache(type);
  const idx = cache.findIndex((e) => e.id === entry.id);
  const base = idx !== -1 ? cache[idx] : null;
  const record = {
    ...entry,
    // A content refresh of an existing item must not reset its created-at or wipe feedback.
    timestamp:      base ? base.timestamp      : entry.timestamp,
    feedback:       base ? base.feedback       : entry.feedback,
    feedbackReason: base ? base.feedbackReason : entry.feedbackReason,
    updatedAt: Date.now(),
  };
  const next = idx !== -1
    ? cache.map((e) => (e.id === entry.id ? record : e))
    : [record, ...cache];
  await writeCache(type, next);
  postUpsert(type, [record]);
  return record;
}

export function saveItinerary(entry) { return upsertLocal('itineraries', entry); }
export function saveDecision(entry)  { return upsertLocal('decisions', entry); }

export async function updateFeedback(type, id, feedback, feedbackReason) {
  const cache = await readCache(type);
  const found = cache.find((e) => e.id === id);
  if (!found) return;
  const updated = { ...found, feedback, feedbackReason, updatedAt: Date.now() };
  await writeCache(type, cache.map((e) => (e.id === id ? updated : e)));
  postUpsert(type, [updated]);
}

export async function clearHistory() {
  await Promise.all([writeCache('itineraries', []), writeCache('decisions', [])]);
  try {
    const headers = await authHeader();
    if (headers.Authorization) await fetch(`${getApiBase()}/api/history`, { method: 'DELETE', headers });
  } catch {}
}

// Fetch server, merge with cache (newest wins), write merged to cache, push
// local-only/newer items up. Signed-out or any failure → returns cache unchanged.
export async function syncHistory() {
  const headers = await authHeader();
  if (!headers.Authorization) return loadHistory();
  let server;
  try {
    const res = await fetch(`${getApiBase()}/api/history`, { headers });
    if (!res.ok) return loadHistory();
    server = await res.json();
  } catch { return loadHistory(); }

  const merged = {};
  for (const type of TYPES) {
    const local = await readCache(type);
    const remote = Array.isArray(server?.[type]) ? server[type] : [];
    const m = mergeById(local, remote).slice(0, CAPS[type]);
    await writeCache(type, m);
    const remoteById = new Map(remote.map((r) => [r.id, r]));
    const toPush = m.filter((it) => {
      const r = remoteById.get(it.id);
      const s = (x) => (x?.updatedAt ?? x?.timestamp ?? 0);
      return !r || s(it) > s(r);
    });
    if (toPush.length) postUpsert(type, toPush);
    merged[type] = m;
  }
  return merged;
}
