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

/**
 * Nearest-rank percentile over a sorted array. No interpolation — with the sample sizes this
 * will see for months, an interpolated p80 implies a precision the data does not have.
 */
function percentile(sorted, p) {
  if (!sorted.length) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/**
 * How long generations actually took.
 *
 * This is what the loading screen's countdown should be set from. p80 is the one to read: the
 * countdown expiring early is a worse failure than it finishing early, so the estimate wants to
 * cover most runs rather than half of them.
 *
 * Returns null when nothing has been timed yet, which the dashboard renders as "not enough data"
 * rather than as a confident zero.
 */
export function summarizeDurations(rows) {
  const ms = rows
    .map((r) => r?.durationMs)
    .filter((d) => Number.isFinite(d) && d > 0)
    .sort((a, b) => a - b);
  if (!ms.length) return null;
  return {
    n: ms.length,
    p50: percentile(ms, 50),
    p80: percentile(ms, 80),
    p95: percentile(ms, 95),
    max: ms[ms.length - 1],
  };
}

/**
 * The generation funnel: how many requests started, how many came back, and how many settled for
 * a fallback because synthesis ran out of budget.
 *
 * `started - completed` is the number that DIED — killed at Vercel's 60s ceiling, or abandoned.
 * That figure is the whole point: a dead request writes nothing on its own, so before the start
 * marker existed the only symptom was a missing synthesis row, which is invisible unless you
 * already suspect it. A real outage hid behind that for hours.
 *
 * Read `died` as the alarm and `deadline` as the safety net working. Deadline hits are NOT
 * failures — they are days that would previously have been killed and are now delivered.
 */
export function summarizeGeneration(rows) {
  let started = 0, completed = 0, deadline = 0, skipped = 0;
  for (const r of rows) {
    if (r?.route === 'itinerary' && r?.model === 'generation-start') started++;
    else if (r?.route === 'itinerary' && r?.model === 'generation') completed++;
    else if (r?.model === 'synthesis-deadline') deadline++;
    else if (r?.model === 'synthesis-skipped-no-budget') skipped++;
  }
  if (!started && !completed && !deadline && !skipped) return null;
  return { started, completed, deadline, skipped, died: Math.max(0, started - completed) };
}

export function aggregateUsage(rows) {
  const totals = emptyBucket();
  const byModel = {};
  const byRoute = {};
  const byUser = {};
  for (const row of rows) {
    add(totals, row);
    (byModel[row.model] ??= emptyBucket()), add(byModel[row.model], row);
    (byRoute[row.route] ??= emptyBucket()), add(byRoute[row.route], row);
    const userKey = row.userId || 'anonymous';
    (byUser[userKey] ??= emptyBucket()), add(byUser[userKey], row);
  }
  // Only rows that carry a wall-clock measurement — currently the one written per completed
  // itinerary generation. Everything else has no duration and is correctly ignored.
  return {
    totals, byModel, byRoute, byUser,
    generation: summarizeDurations(rows),
    funnel: summarizeGeneration(rows),
  };
}

export async function fetchUsage(range, nowMs = Date.now()) {
  const start = rangeStartMs(range, nowMs);
  const snap = await getAdminDb().collection('apiUsage').where('ts', '>=', start).get();
  const rows = snap.docs.map((d) => d.data());
  return aggregateUsage(rows);
}
