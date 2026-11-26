import { sunLine, sunPhrases, UNKNOWN_VALUE } from '../components/ConditionsPanel';

describe('sunPhrases', () => {
  it('keeps each time on one line: no breakable spaces inside a phrase', () => {
    const phrases = sunPhrases({ sunrise: '7:03 AM', sunset: '4:26 PM' });
    expect(phrases.map((p) => p.replace(/ /g, ' '))).toEqual(['Sunrise 7:03 AM', 'Sunset 4:26 PM']);
    for (const phrase of phrases) expect(phrase).not.toMatch(/ /);
  });

  it('handles unknown times and polar days', () => {
    const unknown = sunPhrases(sunLine(null, Date.now()));
    expect(unknown[0]).toContain(UNKNOWN_VALUE);
    const polar = sunPhrases({ sunrise: 'Up all day', sunset: 'Up all day' });
    for (const phrase of polar) expect(phrase).not.toMatch(/ /);
  });
});
