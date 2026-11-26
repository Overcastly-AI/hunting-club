import { formatClockTime } from '../clock';

describe('formatClockTime', () => {
  it('formats a 12-hour clock with AM and PM', () => {
    expect(formatClockTime(new Date(2026, 10, 30, 6, 52))).toBe('6:52 AM');
    expect(formatClockTime(new Date(2026, 10, 30, 0, 5))).toBe('12:05 AM');
    expect(formatClockTime(new Date(2026, 10, 30, 12, 0))).toBe('12:00 PM');
    expect(formatClockTime(new Date(2026, 10, 30, 16, 58))).toBe('4:58 PM');
  });
});
