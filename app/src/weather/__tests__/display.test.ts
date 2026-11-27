import { CALM, HOUR_MS, UNKNOWN_VALUE, conditionsReadout } from '@huntclub/shared';
import { FIXTURE_PLACES, cheyenneCache } from '../../test-utils/nwsFixtures';
import { forecastToCache } from '../forecast';
import { UNKNOWN_WEATHER, weatherNow } from '../display';
import type { ForecastHour } from '../types';

const PLACE = FIXTURE_PLACES.cheyenne;
const FETCHED = Date.parse('2026-11-25T23:30:00-07:00');

function oneHour(overrides: Partial<ForecastHour>) {
  const hour: ForecastHour = {
    start: FETCHED - HOUR_MS / 2,
    end: FETCHED + HOUR_MS / 2,
    windMph: 8,
    windFromDeg: 270,
    temperatureF: 33.6,
    ...overrides,
  };
  return forecastToCache([hour], PLACE, FETCHED);
}

/** The strip's wording of the hour, as the map draws it. */
const readout = (forecast: Parameters<typeof weatherNow>[0], now = FETCHED) =>
  conditionsReadout({ place: PLACE, now, ...weatherNow(forecast, PLACE, now) });

describe('weatherNow', () => {
  it('gives the real forecast hour to the shared readout, with a "blowing toward" bearing', () => {
    expect(weatherNow(cheyenneCache(FETCHED), PLACE, FETCHED)).toEqual({
      windMph: 10,
      windFromDeg: 202.5,
      temperatureF: 25,
      updated: null,
      updatedSpoken: null,
    });
    const { wind, temperature } = readout(cheyenneCache(FETCHED));
    expect(wind).toEqual({
      short: 'SSW 10 mph',
      spoken: '10 mph from SSW, blowing toward NNE',
      fromDeg: 202.5,
      towardDeg: 22.5,
    });
    expect(temperature.short).toBe('25°F');
  });

  it('rounds speed and temperature in the readout', () => {
    const { wind, temperature } = readout(oneHour({ windMph: 7.6 }));
    expect(wind.short).toBe('W 8 mph');
    expect(wind.towardDeg).toBe(90);
    expect(temperature.short).toBe('34°F');
  });

  it('says Calm with no arrow or scent cone when there is no wind', () => {
    const { wind } = readout(oneHour({ windMph: 0, windFromDeg: null }));
    expect(wind).toMatchObject({ short: CALM, fromDeg: null, towardDeg: null });
  });

  it('shows the speed without an arrow when NWS gives no direction', () => {
    const { wind } = readout(oneHour({ windFromDeg: null }));
    expect(wind).toMatchObject({ short: '8 mph', fromDeg: null, towardDeg: null });
  });

  it('shows how old the forecast is once it is past the refresh interval', () => {
    const view = weatherNow(cheyenneCache(FETCHED), PLACE, FETCHED + 3 * HOUR_MS);
    expect(view.updated).toBe('Updated 3 hr ago');
    expect(view.updatedSpoken).toBe('forecast updated 3 hours ago');
  });

  it('is unknown ("—") with no forecast, outside its area, or once its hours have ended', () => {
    const cache = cheyenneCache(FETCHED);
    expect(weatherNow(null, PLACE, FETCHED)).toBe(UNKNOWN_WEATHER);
    expect(weatherNow(cache, FIXTURE_PLACES.minneapolis, FETCHED)).toBe(UNKNOWN_WEATHER);
    expect(weatherNow(cache, PLACE, FETCHED + 2 * 24 * HOUR_MS)).toBe(UNKNOWN_WEATHER);
    const { wind, temperature } = readout(null);
    expect([wind.short, temperature.short]).toEqual([UNKNOWN_VALUE, UNKNOWN_VALUE]);
  });
});
