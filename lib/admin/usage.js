import { getAdminDb } from '../firebaseAdmin.cjs';

const DAY = 24 * 3600 * 1000;
const SPAN = { day: DAY, week: 7 * DAY, month: 30 * DAY };

export function rangeStartMs(range, nowMs) {
  return nowMs - (SPAN[range] ?? DAY);
}

function emptyBucket() {
  return { requests: 0, inputTokens: 0, outputTokens: 0, estCost: 0 };
}
function add(bucket, row) {
  bucket.requests     += row.requests || 0;
  bucket.inputTokens  += row.inputTokens || 0;
  bucket.outputTokens += row.outputTokens || 0;
  bucket.estCost      += row.estCost || 0;
}

export function aggregateUsage(rows) {
  const totals = emptyBucket();
  const byModel = {};
  const byRoute = {};
  for (const row of rows) {
    add(totals, row);
    (byModel[row.model] ??= emptyBucket()), add(byModel[row.model], row);
    (byRoute[row.route] ??= emptyBucket()), add(byRoute[row.route], row);
  }
  return { totals, byModel, byRoute };
}

export async function fetchUsage(range, nowMs = Date.now()) {
  const start = rangeStartMs(range, nowMs);
  const snap = await getAdminDb().collection('apiUsage').where('ts', '>=', start).get();
  const rows = snap.docs.map((d) => d.data());
  return aggregateUsage(rows);
}
