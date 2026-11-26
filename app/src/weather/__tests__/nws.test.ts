import { parseHourly, parsePoints, parseTemperatureF, parseWindSpeedMph, pointsUrl } from '../nws';
import { NWS_FIXTURES } from '../../test-utils/nwsFixtures';

describe('pointsUrl', () => {
  it('rounds to 4 decimals so NWS answers without a redirect', () => {
    expect(pointsUrl({ lat: 44.977812, lon: -93.265011 })).toBe(
      'https://api.weather.gov/points/44.9778,-93.265',
    );
  });
});

describe('parsePoints (real response)', () => {
  it('finds the hourly forecast URL', () => {
    expect(parsePoints(NWS_FIXTURES.pointsMinneapolis)).toBe(
      'https://api.weather.gov/gridpoints/MPX/108,72/forecast/hourly',
    );
  });

  it('rejects the outside-US problem response and non-NWS URLs', () => {
    expect(parsePoints(NWS_FIXTURES.pointsOutsideUs)).toBeNull();
    expect(parsePoints({ properties: { forecastHourly: 'https://example.com/x' } })).toBeNull();
    expect(parsePoints(null)).toBeNull();
  });
});

describe('parseHourly (real responses)', () => {
  it('reads wind, direction and temperature from a windy forecast (Cheyenne)', () => {
    const hours = parseHourly(NWS_FIXTURES.hourlyCheyenne);
    expect(hours).toHaveLength(24);
    expect(hours[0]).toEqual({
      start: Date.parse('2026-11-25T23:00:00-07:00'),
      end: Date.parse('2026-11-26T00:00:00-07:00'),
      windMph: 10,
      windFromDeg: 202.5, // SSW
      temperatureF: 25,
    });
    expect(hours[1]!.windFromDeg).toBe(225); // SW
  });

  it('treats the calm hours NWS sends as "0 mph" with no direction (Minneapolis)', () => {
    const hours = parseHourly(NWS_FIXTURES.hourlyMinneapolis);
    expect(hours[0]).toMatchObject({ windMph: 0, windFromDeg: null, temperatureF: 27 });
    const breezy = hours.find((h) => h.windMph > 0)!;
    expect(breezy).toMatchObject({ windMph: 5, windFromDeg: 22.5, temperatureF: 35 }); // NNE
  });

  it('drops periods it cannot read and returns [] for junk', () => {
    const [first] = NWS_FIXTURES.hourlyCheyenne.properties.periods;
    const body = { properties: { periods: [{ ...first, windSpeed: 'breezy' }, first] } };
    expect(parseHourly(body)).toHaveLength(1);
    expect(parseHourly({})).toEqual([]);
    expect(parseHourly('nope')).toEqual([]);
  });
});

describe('parseWindSpeedMph', () => {
  it.each<[unknown, number | null]>([
    ['10 mph', 10],
    ['5 to 15 mph', 15],
    ['0 mph', 0],
    ['16 km/h', 16 * (1000 / 1609.344)],
    [{ unitCode: 'wmoUnit:km_h-1', value: 16.09344 }, 10],
    [{ unitCode: 'wmoUnit:km_h-1', minValue: 8, maxValue: 16.09344 }, 10],
    [{ unitCode: 'wmoUnit:m_s-1', value: 4.4704 }, 10],
    [{ unitCode: 'wmoUnit:km_h-1', value: null }, null],
    ['gusty', null],
    [undefined, null],
  ])('%j → %s', (input, expected) => {
    const mph = parseWindSpeedMph(input);
    if (expected === null) expect(mph).toBeNull();
    else expect(mph).toBeCloseTo(expected, 6);
  });
});

describe('parseTemperatureF', () => {
  it('keeps °F, converts °C, and rejects unknown units', () => {
    expect(parseTemperatureF(27, 'F')).toBe(27);
    expect(parseTemperatureF(-5, 'C')).toBe(23);
    expect(parseTemperatureF({ unitCode: 'wmoUnit:degC', value: 10 }, undefined)).toBe(50);
    expect(parseTemperatureF(27, 'K')).toBeNull();
    expect(parseTemperatureF(null, 'F')).toBeNull();
  });
});
