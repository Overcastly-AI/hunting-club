/**
 * The screens restyled in P5b (Map controls and bottom sheet, Chat, Check In) at 200 % text:
 * the shared audit (48 px targets, spoken labels, nothing clipped), the spoken labels the
 * screens had before, and the size rule for the big buttons.
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ChatScreen } from '../chat/ChatScreen';
import { CheckInScreen } from '../checkin/CheckInScreen';
import { MapBottomSheet } from '../map/components/MapBottomSheet';
import { MapControls } from '../map/components/MapControls';
import { a11yProblems, setLargeText } from '../test-utils/a11yAudit';
import { SRC, sourceFiles } from '../test-utils/sourceFiles';

jest.mock(
  '@maplibre/maplibre-react-native',
  () => jest.requireActual('../test-utils/fakeMapLibre').fakeMapLibreModule,
);

beforeEach(setLargeText);

async function audit(ui: ReactElement) {
  const view = await render(ui);
  return a11yProblems(view.container);
}

describe('restyled screens at 200 % text', () => {
  it('map controls keep their spoken labels', async () => {
    expect(
      await audit(
        <MapControls onLayers={jest.fn()} onNorthUp={jest.fn()} onCenterOnMe={jest.fn()} />,
      ),
    ).toEqual([]);
    for (const name of [
      'Map layers and downloads',
      'Turn the map north up',
      'Center the map on me',
    ]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });

  it('map bottom sheet, checked in', async () => {
    const problems = await audit(
      <MapBottomSheet
        state="checkedIn"
        place={{ kind: 'moving' }}
        checkedInAt={0}
        now={60_000}
        audience="party"
        onAskForHand={jest.fn()}
        onCheckOut={jest.fn()}
        onChangeMode={jest.fn()}
        onLogHarvest={jest.fn()}
      />,
    );
    expect(problems).toEqual([]);
    for (const name of [
      'Ask for a Hand. Pings your party',
      'Check Out',
      'Change mode',
      'Log a harvest. Private',
    ]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });

  it('map bottom sheet, not checked in (no stand needed)', async () => {
    expect(await audit(<MapBottomSheet state="notCheckedIn" onCheckIn={jest.fn()} />)).toEqual([]);
    expect(screen.getByRole('button', { name: 'Check In' })).toBeTruthy();
  });

  it('chat with no radio', async () => {
    expect(await audit(<ChatScreen />)).toEqual([]);
    expect(screen.getByText(/Connect your radio to chat/)).toBeTruthy();
  });

  it('check in with no radio', async () => {
    expect(await audit(<CheckInScreen />)).toEqual([]);
    expect(screen.getByRole('button', { name: 'Slide to check in' })).toBeTruthy();
  });
});

describe('the 62 px hero size', () => {
  it('is used only for Check Out and Ask for a Hand', () => {
    const uses = sourceFiles(SRC, /\.tsx$/).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(/<Button\b[^>]*size="hero"[^>]*\/>/gs)].map((m) => ({
        file: relative(SRC, file),
        label: /label="([^"]+)"/.exec(m[0])?.[1],
      }));
    });
    expect(uses).toEqual([
      { file: 'map/components/MapBottomSheet.tsx', label: 'Ask for a Hand' },
      { file: 'map/components/MapBottomSheet.tsx', label: 'Check Out' },
    ]);
  });
});
