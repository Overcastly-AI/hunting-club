import type { SunReadout } from '@huntclub/shared';

/** Joins words with no-break spaces so a line never breaks inside one phrase ("7:03 AM"). */
const keepTogether = (text: string) => text.replace(/ /g, ' ');

/**
 * "Sunrise 7:03 AM" and "Sunset 4:26 PM" as two unbreakable phrases. The board's line may
 * wrap between them at large text sizes, but never truncates or splits a time.
 */
export function sunPhrases(sun: Pick<SunReadout, 'sunrise' | 'sunset'>): [string, string] {
  return [keepTogether(`Sunrise ${sun.sunrise.short}`), keepTogether(`Sunset ${sun.sunset.short}`)];
}

/** "Sunrise 7:03 AM · Sunset 4:26 PM" on the clubhouse board: wraps only after the dot. */
export function sunSentence(sun: Pick<SunReadout, 'sunrise' | 'sunset'>): string {
  const [sunrisePhrase, sunsetPhrase] = sunPhrases(sun);
  return `${sunrisePhrase} · ${sunsetPhrase}`;
}
