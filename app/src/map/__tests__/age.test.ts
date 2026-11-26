import { MINUTE_MS } from '@huntclub/core';
import { describeAge } from '../age';

describe('describeAge', () => {
  it.each([
    [0, 'Just now', 'just now'],
    [59_999, 'Just now', 'just now'],
    [1 * MINUTE_MS, '1 min ago', '1 minute ago'],
    [2 * MINUTE_MS + 30_000, '2 min ago', '2 minutes ago'],
    [60 * MINUTE_MS, '1 hr ago', '1 hour ago'],
    [3 * 60 * MINUTE_MS, '3 hr ago', '3 hours ago'],
    [24 * 60 * MINUTE_MS, '1 day ago', '1 day ago'],
  ])('describes %d ms', (age, short, spoken) => {
    expect(describeAge(age)).toEqual({ short, spoken });
  });
});
