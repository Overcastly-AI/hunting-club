import { CALM, HOUR_MS, UNKNOWN_VALUE } from '@huntclub/shared';
import { FIXTURE_PLACES, cheyenneCache } from '../../test-utils/nwsFixtures';
import { forecastToCache } from '../forecast';
import { UNKNOWN_WEATHER, weatherDisplay } from '../display';
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

describe('weatherDisplay', () => {
  it('shows wind from the real forecast with a "blowing toward" bearing', () => {
    const view = weatherDisplay(cheyenneCache(FETCHED), PLACE, FETCHED);
    expect(view).toEqual({
      wind: 'SSW 10 mph',
      windSpoken: '10 mph from SSW, blowing toward NNE',
      windFromDeg: 202.5,
      windTowardDeg: 22.5,
      temperature: '25°F',
      temperatureSpoken: '25°F',
      updated: null,
      updatedSpoken: null,
    });
  });

  it('rounds speed and temperature', () => {
    const view = weatherDisplay(oneHour({ windMph: 7.6 }), PLACE, FETCHED);
    expect(view.wind).toBe('W 8 mph');
    expect(view.temperature).toBe('34°F');
    expect(view.windTowardDeg).toBe(90);
  });

  it('says Calm with no arrow or scent cone when there is no wind', () => {
    const view = weatherDisplay(oneHour({ windMph: 0, windFromDeg: null }), PLACE, FETCHED);
    expect(view).toMatchObject({ wind: CALM, windFromDeg: null, windTowardDeg: null });
  });

  it('shows the speed without an arrow when NWS gives no direction', () => {
    const view = weatherDisplay(oneHour({ windFromDeg: null }), PLACE, FETCHED);
    expect(view).toMatchObject({ wind: '8 mph', windFromDeg: null, windTowardDeg: null });
  });

  it('shows how old the forecast is once it is past the refresh interval', () => {
    const view = weatherDisplay(cheyenneCache(FETCHED), PLACE, FETCHED + 3 * HOUR_MS);
    expect(view.updated).toBe('Updated 3 hr ago');
    expect(view.updatedSpoken).toBe('forecast updated 3 hours ago');
  });

  it('shows "—" with no forecast, outside its area, or once its hours have ended', () => {
    const cache = cheyenneCache(FETCHED);
    expect(weatherDisplay(null, PLACE, FETCHED)).toBe(UNKNOWN_WEATHER);
    expect(weatherDisplay(cache, FIXTURE_PLACES.minneapolis, FETCHED)).toBe(UNKNOWN_WEATHER);
    expect(weatherDisplay(cache, PLACE, FETCHED + 2 * 24 * HOUR_MS)).toBe(UNKNOWN_WEATHER);
    expect(UNKNOWN_WEATHER).toMatchObject({ wind: UNKNOWN_VALUE, temperature: UNKNOWN_VALUE });
  });
});
