import { DAY_MS, HOUR_MS, MINUTE_MS, describeAge, elapsedMs } from '../time';

describe('elapsedMs', () => {
  it('never goes negative when a timestamp is ahead of the phone clock', () => {
    expect(elapsedMs(1_000, 500)).toBe(0);
    expect(elapsedMs(500, 1_000)).toBe(500);
  });
});

describe('describeAge', () => {
  it.each([
    [0, 'Just now', 'just now'],
    [MINUTE_MS - 1, 'Just now', 'just now'],
    [MINUTE_MS, '1 min ago', '1 minute ago'],
    [2 * MINUTE_MS + 30_000, '2 min ago', '2 minutes ago'],
    [HOUR_MS, '1 hr ago', '1 hour ago'],
    [3 * HOUR_MS, '3 hr ago', '3 hours ago'],
    [DAY_MS, '1 day ago', '1 day ago'],
  ])('describes %d ms', (age, short, spoken) => {
    expect(describeAge(age)).toEqual({ short, spoken });
  });
});
