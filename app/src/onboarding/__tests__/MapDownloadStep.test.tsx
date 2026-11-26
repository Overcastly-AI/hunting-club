import { fireEvent, render, screen } from '@testing-library/react-native';

import { distanceMeters } from '../../map/geo';
import type { DownloadRequest } from '../../map/offline';
import { ensureLocationPermission } from '../../permissions/location';
import { radioCopy } from '../../radio/copy';
import { onboardingCopy } from '../copy';
import { MapDownloadStep, ONBOARDING_MAP_RADIUS_M } from '../MapDownloadStep';

jest.mock(
  '../../permissions/location',
  () => jest.requireActual('../../test-utils/fakeLocation').fakeLocationModule,
);
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

const copy = onboardingCopy.map;
const HERE = { lat: 40.79, lon: -77.86 };
const locate = jest.mocked(ensureLocationPermission);

async function renderStep() {
  const onNext = jest.fn();
  const onDownload = jest.fn<Promise<void>, [DownloadRequest]>().mockResolvedValue(undefined);
  await render(<MapDownloadStep onNext={onNext} onDownload={onDownload} />);
  return { onNext, onDownload };
}

describe('MapDownloadStep', () => {
  it('downloads the area around the hunter, then continues', async () => {
    locate.mockResolvedValue(HERE);
    const { onNext, onDownload } = await renderStep();

    await fireEvent.press(screen.getByRole('button', { name: copy.findArea }));
    expect(screen.getByText(copy.sheetIntro)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Download\. About/ }));

    const [request] = onDownload.mock.calls[0]!;
    const [west, south, east, north] = request.bounds;
    expect(distanceMeters(HERE, { lat: north, lon: HERE.lon })).toBeCloseTo(
      ONBOARDING_MAP_RADIUS_M,
      0,
    );
    expect(west < HERE.lon && HERE.lon < east && south < HERE.lat).toBe(true);

    expect(screen.getByText(copy.downloading)).toBeTruthy();
    expect(onNext).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: copy.continue }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('explains when location is unavailable and still lets the hunter move on', async () => {
    locate.mockResolvedValue(null);
    const { onNext, onDownload } = await renderStep();

    await fireEvent.press(screen.getByRole('button', { name: copy.findArea }));
    expect(screen.getByText(copy.noLocation)).toBeTruthy();
    expect(onDownload).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: radioCopy.pair.setUpLater }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
