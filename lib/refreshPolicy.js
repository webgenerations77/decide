// Pure time-window + refresh-gating logic. No React Native imports so the
// __tests__/verify.mjs harness can import it directly.

export const FREE_REFRESHES_PER_ITINERARY = 3;

// '8:00 AM' → 480, '12:00 PM' → 720, '12:00 AM' → 0
export function timeToMinutes(timeStr) {
  const [time, period] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + (minutes || 0);
}

export function isValidWindow(start, end, minMinutes = 180) {
  return timeToMinutes(end) - timeToMinutes(start) >= minMinutes;
}

export function windowChanged(genStart, genEnd, curStart, curEnd) {
  return genStart !== curStart || genEnd !== curEnd;
}

export function canRefresh({ isPro, isDemo, refreshCount, cap = FREE_REFRESHES_PER_ITINERARY }) {
  if (isPro || isDemo) return true;
  return refreshCount < cap;
}
