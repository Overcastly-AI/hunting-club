/**
 * The screens restyled in the redesign (P5b: Map controls and bottom sheet, Chat, Check In;
 * P5c: onboarding states, sign-in, Join club, the Clubhouse board, Legal, the map's layer and
 * download sheets, Pair your radio) at 200 % text: the shared audit (48 px targets, spoken
 * labels, nothing clipped) and the spoken labels each screen had before. Then the same
 * screens in the light theme, where every colour must come from the light theme's tokens.
 */
import { darkTheme, lightTheme, type ThemePreference } from '@huntclub/design';
import { privacyPolicy } from '@huntclub/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { ReactElement } from 'react';
import type { TestInstance } from 'test-renderer';

import { LegalScreen } from '../about/LegalScreen';
import { BoardScreen } from '../board/BoardScreen';
import type { BoardEntry } from '../board/boardModel';
import { OutList } from '../board/components/OutList';
import { ChatScreen } from '../chat/ChatScreen';
import { CheckInScreen } from '../checkin/CheckInScreen';
import { clubCopy } from '../club/copy';
import { ClubEntitlementContext } from '../club/entitlement';
import { JoinClubScreen } from '../club/JoinClubScreen';
import { SignInScreen } from '../club/SignInScreen';
import { DownloadAreaSheet } from '../map/components/DownloadAreaSheet';
import { LayersSheet } from '../map/components/LayersSheet';
import { MapBottomSheet } from '../map/components/MapBottomSheet';
import { MapControls } from '../map/components/MapControls';
import type { MapPack } from '../map/mapPacks';
import { onboardingCopy } from '../onboarding/copy';
import { PermissionsStep } from '../onboarding/PermissionsStep';
import { radioCopy } from '../radio/copy';
import { PairRadioScreen } from '../radio/ui/PairRadioScreen';
import { a11yProblems, setLargeText } from '../test-utils/a11yAudit';
import { answerPermissionAlerts } from '../test-utils/alerts';
import { clubWrapper } from '../test-utils/clubFixture';
import { fakeBle } from '../test-utils/fakeBleManager';
import { placePhone } from '../test-utils/fakeMapLibre';
import {
  clubJoinUrl,
  fakeClubApi,
  fakeSession,
  memorySecureStorage,
  partyJoinUrl,
} from '../test-utils/fakeClubApi';
import { NOW } from '../test-utils/mapFixtures';
import { renderWithRadio } from '../test-utils/renderWithRadio';
import { resetBluetoothForTests } from '../test-utils/resetBluetooth';
import { SRC, sourceFiles } from '../test-utils/sourceFiles';
import { inTheme, offThemeColors } from '../test-utils/themeAudit';

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
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: jest.fn() }));
// The board's map is the shared map layers (map colours stay fixed); its list pane is under test.
jest.mock('../board/components/BoardMap', () => ({ BoardMap: () => null }));

beforeEach(() => {
  resetBluetoothForTests();
  setLargeText();
});

const signedOut = () => ({
  session: fakeSession(false),
  api: fakeClubApi(),
  secrets: memorySecureStorage(),
});

const pack = (id: string, status: MapPack['status']): MapPack => ({
  id,
  name: `Area ${id}`,
  bounds: [-94.1, 45.9, -93.9, 46.1],
  minZoom: 10,
  maxZoom: 16,
  source: 'usgs-topo',
  sizeBytes: 12_000_000,
  tileCount: 400,
  status,
  createdAt: NOW,
  downloadedAt: status === 'complete' ? NOW : null,
});

const overdue: BoardEntry = {
  node: 1,
  name: 'Cody Hart',
  place: 'Creek Stand',
  since: NOW - 3 * 3_600_000,
  overdueAt: NOW - 600_000,
  overdue: true,
};

type Case = {
  /** The screen, before any theme wraps it. */
  ui: () => ReactElement | Promise<ReactElement>;
  /** Text that shows once the screen has drawn (the theme loads first). */
  ready: string | RegExp;
  /** Presses and typing that bring the screen to the state under test. */
  then?: () => Promise<void>;
  /** Needs a radio (RadioProvider with the fake radio). */
  radio?: boolean;
  /** Spoken labels that must still be there: buttons, then fields. */
  buttons?: readonly string[];
  fields?: readonly string[];
};

const CASES: Record<string, Case> = {
  'map controls': {
    ui: () => <MapControls onLayers={jest.fn()} onNorthUp={jest.fn()} onCenterOnMe={jest.fn()} />,
    ready: 'Layers',
    buttons: ['Map layers and downloads', 'Turn the map north up', 'Center the map on me'],
  },
  'map bottom sheet, checked in': {
    ui: () => (
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
      />
    ),
    ready: 'Check Out',
    buttons: [
      'Ask for a Hand. Pings your party',
      'Check Out',
      'Change mode',
      'Log a harvest. Private',
    ],
  },
  'map bottom sheet, not checked in (no stand needed)': {
    ui: () => <MapBottomSheet state="notCheckedIn" onCheckIn={jest.fn()} />,
    ready: 'Check In',
    buttons: ['Check In'],
  },
  'chat with no radio': {
    ui: () => <ChatScreen />,
    ready: /Connect your radio to chat/,
  },
  'check in with no radio': {
    ui: () => <CheckInScreen />,
    ready: 'Slide to check in',
    buttons: ['Slide to check in'],
  },
  'permissions, after answering': {
    ui: () => {
      answerPermissionAlerts();
      placePhone({ lat: 46, lon: -94 });
      jest.mocked(getPermissionsAsync).mockResolvedValue({ granted: false } as never);
      jest.mocked(requestPermissionsAsync).mockResolvedValue({ granted: false } as never);
      return <PermissionsStep onNext={jest.fn()} />;
    },
    ready: onboardingCopy.permissions.title,
    then: async () => {
      await fireEvent.press(
        screen.getByRole('button', { name: onboardingCopy.permissions.allow.location }),
      );
      await screen.findByText(onboardingCopy.permissions.allowed);
      await fireEvent.press(
        screen.getByRole('button', { name: onboardingCopy.permissions.allow.notifications }),
      );
      await screen.findByText(onboardingCopy.permissions.notAllowed);
    },
    buttons: [onboardingCopy.permissions.allow.notifications, onboardingCopy.permissions.continue],
  },
  'sign in, email': {
    ui: async () => (await clubWrapper(signedOut())).wrap(<SignInScreen onDone={jest.fn()} />),
    ready: clubCopy.signIn.intro,
    buttons: [clubCopy.signIn.sendCode],
    fields: [clubCopy.signIn.email],
  },
  'sign in, code, with an error': {
    ui: async () => {
      const services = signedOut();
      jest
        .mocked(services.session.requestCode)
        .mockResolvedValue({ kind: 'signIn', email: 'dale@example.com', session: 's' });
      return (await clubWrapper(services)).wrap(<SignInScreen onDone={jest.fn()} />);
    },
    ready: clubCopy.signIn.intro,
    then: async () => {
      await fireEvent.changeText(screen.getByLabelText(clubCopy.signIn.email), 'dale@example.com');
      await fireEvent.press(screen.getByRole('button', { name: clubCopy.signIn.sendCode }));
      await fireEvent.changeText(await screen.findByLabelText(clubCopy.signIn.code), '12');
      await fireEvent.press(screen.getByRole('button', { name: clubCopy.signIn.confirm }));
      await screen.findByText(clubCopy.signIn.codeIncomplete('signIn'));
    },
    buttons: [clubCopy.signIn.confirm, clubCopy.signIn.useOtherEmail],
    fields: [clubCopy.signIn.code],
  },
  'join club': {
    ui: async () =>
      (await clubWrapper(signedOut())).wrap(
        <JoinClubScreen url={clubJoinUrl()} onDone={jest.fn()} />,
      ),
    ready: clubCopy.join.intro,
    buttons: [clubCopy.join.join],
    fields: [clubCopy.join.name, clubCopy.join.initials],
  },
  'join club, joined (sign in to finish)': {
    ui: async () =>
      (await clubWrapper(signedOut())).wrap(
        <JoinClubScreen url={clubJoinUrl()} onDone={jest.fn()} />,
      ),
    ready: clubCopy.join.intro,
    then: async () => {
      await fireEvent.changeText(screen.getByLabelText(clubCopy.join.name), 'Max');
      await fireEvent.changeText(screen.getByLabelText(clubCopy.join.initials), 'mx');
      await fireEvent.press(screen.getByRole('button', { name: clubCopy.join.join }));
      await screen.findByText(clubCopy.join.joined);
    },
    buttons: [clubCopy.join.signInToFinish, clubCopy.join.done],
  },
  'join club, a party code': {
    ui: async () =>
      (await clubWrapper(signedOut())).wrap(
        <JoinClubScreen url={partyJoinUrl()} onDone={jest.fn()} />,
      ),
    ready: clubCopy.join.notClub,
    buttons: [clubCopy.join.done],
  },
  legal: {
    ui: () => <LegalScreen doc={privacyPolicy} onDone={jest.fn()} />,
    ready: privacyPolicy.title,
    buttons: ['Back'],
  },
  'clubhouse board': {
    ui: () => (
      <ClubEntitlementContext.Provider
        value={{ clubId: 'c1', clubName: 'Oak Ridge', featuresUntil: Date.now() + 86_400_000 }}
      >
        <BoardScreen />
      </ClubEntitlementContext.Provider>
    ),
    ready: 'Oak Ridge',
  },
  'clubhouse board, overdue hunter': {
    ui: () => <OutList entries={[overdue]} />,
    ready: 'Cody Hart',
  },
  'clubhouse board, no club subscription': {
    ui: () => <BoardScreen />,
    ready: 'Clubhouse board',
  },
  'map layers, with downloaded areas': {
    ui: () => (
      <LayersSheet
        visible
        basemap="topo"
        packs={[pack('a', 'complete'), pack('b', 'downloading'), pack('c', 'failed')]}
        progress={{ b: 40 }}
        onSelect={jest.fn()}
        onDownload={jest.fn()}
        onDelete={jest.fn()}
        onClose={jest.fn()}
      />
    ),
    ready: 'Downloaded areas',
    buttons: ['Topo', 'Aerial', 'Download the map for this area', 'Delete', 'Close'],
  },
  'map layers, none downloaded': {
    ui: () => (
      <LayersSheet
        visible
        basemap="aerial"
        packs={[]}
        progress={{}}
        onSelect={jest.fn()}
        onDownload={jest.fn()}
        onDelete={jest.fn()}
        onClose={jest.fn()}
      />
    ),
    ready: 'No areas saved yet',
  },
  'download this area': {
    ui: () => (
      <DownloadAreaSheet
        visible
        bounds={[-94.01, 45.99, -93.99, 46.01]}
        onStart={jest.fn()}
        onClose={jest.fn()}
      />
    ),
    ready: 'Layers',
    fields: ['Name this area (optional)'],
  },
  'pair your radio, radios found': {
    ui: () => {
      fakeBle.scanResults = [{ id: 'NEAR', rssi: -55, advertising: { localName: 'Near radio' } }];
      return <PairRadioScreen onSkip={jest.fn()} />;
    },
    radio: true,
    ready: radioCopy.pair.title,
    then: async () => {
      await fireEvent.press(screen.getByRole('button', { name: radioCopy.pair.findRadios }));
      await screen.findByText('Near radio');
    },
    buttons: [
      `${radioCopy.pair.connect} Near radio, ${radioCopy.signal.strong}`,
      radioCopy.pair.setUpLater,
      radioCopy.repair.openSettings,
    ],
  },
};

/** Draws a case (in a theme, when given) and brings it to its state; returns the tree. */
async function show(c: Case, theme?: ThemePreference): Promise<TestInstance> {
  const ui = await c.ui();
  const themed = theme ? await inTheme(ui, theme) : ui;
  const container = c.radio
    ? (await renderWithRadio(themed)).view.container
    : (await render(themed)).container;
  await screen.findAllByText(c.ready);
  await c.then?.();
  return container;
}

describe('restyled screens at 200 % text', () => {
  it.each(Object.entries(CASES))('%s', async (_name, c) => {
    const container = await show(c);
    expect(a11yProblems(container)).toEqual([]);
    for (const name of c.buttons ?? []) {
      expect(screen.getAllByRole(/^(button|tab)$/, { name }).length).toBeGreaterThan(0);
    }
    for (const label of c.fields ?? []) expect(screen.getByLabelText(label)).toBeTruthy();
  });
});

describe('restyled screens in the light theme', () => {
  it.each(Object.entries(CASES))('%s uses only light theme colours', async (_name, c) => {
    expect(offThemeColors(await show(c, 'light'), lightTheme)).toEqual([]);
  });

  it('the check itself catches a colour left over from the dark theme', async () => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    const leftover = await show(
      {
        ui: () => (
          <View style={{ backgroundColor: darkTheme.colors.surface1 }}>
            <LegalScreen doc={privacyPolicy} onDone={jest.fn()} />
          </View>
        ),
        ready: privacyPolicy.title,
      },
      'light',
    );
    expect(offThemeColors(leftover, lightTheme)).toEqual([
      `View backgroundColor ${darkTheme.colors.surface1}`,
    ]);
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
