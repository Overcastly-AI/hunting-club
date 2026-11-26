/**
 * Onboarding steps and safety alerts rendered at 200 % text size, checked with
 * the shared audit (test-utils/a11yAudit): 48 px targets, spoken labels, and
 * no text that is cut short, shrunk, capped or clipped. Every other screen is
 * built from the shared controls audited at the end, and is covered by the
 * source scans in accessibility.test.ts.
 */
import type { SelfPromptEvent } from '@huntclub/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CheckInRadioContext, type CheckInRadio } from '../checkin/CheckInRadio';
import { Button } from '../components/Button';
import { Choice } from '../components/Choice';
import { OptionButtons } from '../components/OptionButtons';
import { SegmentedControl } from '../components/SegmentedControl';
import { SlideToConfirm } from '../components/SlideToConfirm';
import { Field } from '../components/Field';
import { onboardingCopy } from '../onboarding/copy';
import { MapDownloadStep } from '../onboarding/MapDownloadStep';
import { NameStep } from '../onboarding/NameStep';
import { OnboardingScreen } from '../onboarding/OnboardingScreen';
import { PermissionsStep } from '../onboarding/PermissionsStep';
import { PartyStep } from '../party/PartyStep';
import { PairRadioStep } from '../radio/ui/PairRadioStep';
import type { IncomingAlert as Alert } from '../safety/alerts';
import { IncomingAlert } from '../safety/components/IncomingAlert';
import { StillOutPrompt } from '../safety/components/StillOutPrompt';
import { SafetyRadioContext, type SafetyRadio } from '../safety/SafetyRadio';
import { a11yProblems, setLargeText } from '../test-utils/a11yAudit';
import { answerPermissionAlerts } from '../test-utils/alerts';
import { placePhone } from '../test-utils/fakeMapLibre';
import { renderWithRadio } from '../test-utils/renderWithRadio';
import { resetBluetoothForTests } from '../test-utils/resetBluetooth';

jest.mock(
  'react-native-ble-manager',
  () => jest.requireActual('../test-utils/fakeBleManager').fakeBleManagerModule,
);
jest.mock(
  '@maplibre/maplibre-react-native',
  () => jest.requireActual('../test-utils/fakeMapLibre').fakeMapLibreModule,
);
jest.mock(
  'expo-notifications',
  () => jest.requireActual('../test-utils/fakeNotifications').fakeNotificationsModule,
);

beforeEach(() => {
  resetBluetoothForTests();
  setLargeText();
});

/** Renders without a radio and returns the screen's accessibility problems. */
async function audit(ui: ReactElement) {
  const view = await render(ui);
  return a11yProblems(view.container);
}

describe('onboarding at 200 % text', () => {
  it('welcome', async () => {
    const problems = await audit(
      <OnboardingScreen
        onFinish={jest.fn()}
        onProfile={jest.fn()}
        onClubCode={jest.fn()}
        onDownloadMap={jest.fn()}
      />,
    );
    expect(problems).toEqual([]);
  });

  it('pair your radio', async () => {
    const { view } = await renderWithRadio(<PairRadioStep onNext={jest.fn()} onSkip={jest.fn()} />);
    expect(a11yProblems(view.container)).toEqual([]);
  });

  it('party', async () => {
    const { view } = await renderWithRadio(<PartyStep onNext={jest.fn()} onClubCode={jest.fn()} />);
    expect(a11yProblems(view.container)).toEqual([]);
  });

  it('name and initials', async () => {
    expect(await audit(<NameStep onNext={jest.fn()} />)).toEqual([]);
  });

  it('permissions', async () => {
    expect(await audit(<PermissionsStep onNext={jest.fn()} />)).toEqual([]);
  });

  it('map download, with its download sheet open', async () => {
    answerPermissionAlerts();
    placePhone({ lat: 46, lon: -94 });
    const view = await render(<MapDownloadStep onNext={jest.fn()} onDownload={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: onboardingCopy.map.findArea }));
    expect(screen.getByText(onboardingCopy.map.sheetIntro)).toBeTruthy();
    expect(a11yProblems(view.container)).toEqual([]);
  });
});

describe('safety alerts at 200 % text', () => {
  const alert = (over: Partial<Alert>): Alert => ({
    kind: 'help',
    key: 'help:1:1',
    node: 1,
    name: 'Cody Hart',
    heardAt: 0,
    pin: { lat: 46, lon: -94 },
    place: { kind: 'spot', name: 'Oak ridge' },
    note: 'Need a hand dragging',
    seen: false,
    ...over,
  });

  it.each([
    ['help', alert({})],
    ['overdue', alert({ kind: 'overdue', key: 'overdue:1:1', note: undefined })],
  ])('%s alert', async (_kind, incoming) => {
    const problems = await audit(
      <IncomingAlert alert={incoming} me={{ lat: 46.01, lon: -94 }} onShowOnMap={jest.fn()} />,
    );
    expect(problems).toEqual([]);
  });

  it('"Still out?" prompt', async () => {
    const prompt: SelfPromptEvent = { overdueAt: 0, alertAt: 10 * 60_000 };
    const safety = {
      overdue: {
        on: (event: string, listener: (e: SelfPromptEvent) => void) => {
          if (event === 'selfPrompt') listener(prompt);
          return () => undefined;
        },
      },
    } as unknown as SafetyRadio;
    const checkIn = { audience: 'party', graceMinutes: 30 } as unknown as CheckInRadio;
    const problems = await audit(
      <SafetyRadioContext.Provider value={safety}>
        <CheckInRadioContext.Provider value={checkIn}>
          <StillOutPrompt />
        </CheckInRadioContext.Provider>
      </SafetyRadioContext.Provider>,
    );
    expect(screen.getByText('Still out?')).toBeTruthy();
    expect(problems).toEqual([]);
  });
});

describe('shared controls at 200 % text (every tappable thing outside the map)', () => {
  it.each(['primary', 'secondary', 'help'] as const)('%s button', async (variant) => {
    expect(
      await audit(
        <Button variant={variant} label="Check in" detail="Pings your party" onPress={jest.fn()} />,
      ),
    ).toEqual([]);
  });

  it('choice, segmented control, option buttons, slider and text field', async () => {
    const problems = await audit(
      <View>
        <Choice label="Most detail" detail="About 40 MB" selected onPress={jest.fn()} />
        <SegmentedControl
          segments={['party', 'direct'] as const}
          labels={{ party: 'Party', direct: 'Direct' }}
          selected="party"
          onSelect={jest.fn()}
        />
        <OptionButtons options={['Buck', 'Doe'] as const} onPress={jest.fn()} />
        <SlideToConfirm label="Slide to ask for a hand" tone="help" onConfirm={jest.fn()} />
        <Field label="Name this area (optional)" />
      </View>,
    );
    expect(problems).toEqual([]);
  });
});

describe('the audit itself', () => {
  it('catches small, unlabelled and truncated controls', async () => {
    const problems = await audit(
      <View style={{ height: 40 }}>
        <Pressable accessibilityRole="button" style={{ minHeight: 30 }} onPress={jest.fn()}>
          <Text numberOfLines={1} maxFontSizeMultiplier={1.3}>
            Go
          </Text>
        </Pressable>
      </View>,
    );
    expect(problems).toEqual([
      'View has no spoken label',
      'View is 30 px tall (min 48)',
      'Text "Go" is cut to 1 line(s)',
      'Text "Go" stops growing at 1.3×',
      'Text "Go" sits in a fixed-height View',
    ]);
  });
});
