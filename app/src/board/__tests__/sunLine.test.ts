import { SUN_UP_ALL_DAY, UNKNOWN_VALUE, sunReadout } from '@huntclub/shared';
import { sunPhrases, sunSentence } from '../sunLine';

const times = (sunrise: string, sunset: string) => ({
  sunrise: { short: sunrise, spoken: sunrise },
  sunset: { short: sunset, spoken: sunset },
});

describe('sunPhrases', () => {
  it('keeps each time on one line: no breakable spaces inside a phrase', () => {
    const phrases = sunPhrases(times('7:03 AM', '4:26 PM'));
    expect(phrases.map((p) => p.replace(/\u00A0/g, ' '))).toEqual([
      'Sunrise 7:03 AM',
      'Sunset 4:26 PM',
    ]);
    for (const phrase of phrases) expect(phrase).not.toMatch(/ /);
  });

  it('handles unknown times and polar days', () => {
    const unknown = sunPhrases(sunReadout(null, Date.now()));
    expect(unknown[0]).toContain(UNKNOWN_VALUE);
    const polar = sunPhrases(times(SUN_UP_ALL_DAY, SUN_UP_ALL_DAY));
    for (const phrase of polar) expect(phrase).not.toMatch(/ /);
  });
});

describe('sunSentence', () => {
  it('joins both phrases so a line can only break after the dot', () => {
    const sentence = sunSentence(times('7:03 AM', '4:26 PM'));
    expect(sentence.replace(/\u00A0/g, ' ')).toBe('Sunrise 7:03 AM · Sunset 4:26 PM');
    expect(sentence.split(' ')).toHaveLength(2);
  });
});
