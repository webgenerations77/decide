// Major US holidays travelers plan around. Returns a display name or null.
// Floating holidays computed from the date's components — no deps, pure.
function nthWeekdayOfMonth(year, month, weekday, n) { // month 0-based; weekday 0=Sun
  const first = new Date(year, month, 1).getDay();
  const offset = (weekday - first + 7) % 7;
  return 1 + offset + (n - 1) * 7;
}
function lastWeekdayOfMonth(year, month, weekday) {
  const last = new Date(year, month + 1, 0).getDate();
  const lastDow = new Date(year, month, last).getDay();
  return last - ((lastDow - weekday + 7) % 7);
}
export function getUSHoliday(dateISO) {
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;
  const [y, m, d] = dateISO.split('-').map(Number);
  const M = m - 1; // 0-based month
  const fixed = {
    '1-1': "New Year's Day", '2-14': "Valentine's Day", '6-19': 'Juneteenth',
    '7-4': 'Independence Day (July 4th)', '10-31': 'Halloween',
    '11-11': 'Veterans Day', '12-24': 'Christmas Eve',
    '12-25': 'Christmas Day', '12-31': "New Year's Eve",
  };
  if (fixed[`${m}-${d}`]) return fixed[`${m}-${d}`];
  if (M === 4 && d === lastWeekdayOfMonth(y, 4, 1)) return 'Memorial Day';
  if (M === 8 && d === nthWeekdayOfMonth(y, 8, 1, 1)) return 'Labor Day';
  if (M === 10 && d === nthWeekdayOfMonth(y, 10, 4, 4)) return 'Thanksgiving';
  if (M === 1 && d === nthWeekdayOfMonth(y, 1, 1, 3)) return "Presidents' Day";
  if (M === 4 && d === nthWeekdayOfMonth(y, 4, 0, 2)) return "Mother's Day";
  if (M === 5 && d === nthWeekdayOfMonth(y, 5, 0, 3)) return "Father's Day";
  return null;
}
