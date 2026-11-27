// The screenshot mode itself: loaded only through ./index (dev builds started with
// EXPO_PUBLIC_SCREENSHOT_MODE=1), never in a production bundle. It fixes the clock, skips
// onboarding, and puts a stand-in radio under the screens: the sample club's stands and chat
// and three other hunters' radios (sample.ts). No Bluetooth, no account, no club service.
import type { SQLiteDatabase } from 'expo-sqlite';
import { useState, type ReactNode } from 'react';
import { LogBox } from 'react-native';

import { ChatRadioContext, type ChatRadio } from '../chat/ChatRadio';
import { chatStore } from '../chat/chatStore';
import { CheckInRadioContext, type CheckInRadio } from '../checkin/CheckInRadio';
import { ClubEntitlementContext } from '../club/entitlement';
import { loadOnboardedAt, markOnboarded, saveProfile } from '../db/appState';
import { initDatabase } from '../db';
import { mapDataStore } from '../map/dataSource';
import type { MapScreenProps } from '../map/MapScreen';
import { RadioProvider } from '../radio/RadioProvider';
import {
  SCREENSHOT_CLUB,
  SCREENSHOT_ENTITLEMENT,
  SCREENSHOT_ME,
  SCREENSHOT_NODES,
  SCREENSHOT_NOW,
  SCREENSHOT_VIEW,
  screenshotChat,
  screenshotMapData,
} from './sample';

/** Moves Date.now to the fixed day (it keeps ticking), so sun times read the same every run. */
export function fixClock(at = SCREENSHOT_NOW): () => void {
  const real = Date.now;
  const offset = at - real();
  Date.now = () => real() + offset;
  return () => {
    Date.now = real;
  };
}

const sent = () => ({ id: 0, result: Promise.resolve({ status: 'sent' as const }) });
const never = () => () => undefined;

/** Check In for the sample club: its open stands, nobody checked in on this phone yet. */
export function standInCheckIn(): CheckInRadio {
  return {
    audience: 'club',
    graceMinutes: 30,
    club: SCREENSHOT_CLUB,
    checkIns: {
      current: null,
      on: never,
      checkIn: sent,
      checkOut: sent,
      extend: sent,
    } as unknown as CheckInRadio['checkIns'],
  };
}

/** Whole-club chat with the three other hunters' radios as the people to message. */
export function standInChat(now: number): ChatRadio {
  const lastHeard = Math.floor(now / 1000);
  const nodes = new Map(SCREENSHOT_NODES.others.map((n) => [n.num, { ...n, lastHeard }]));
  let packetId = 0x6000;
  return {
    client: {
      on: never,
      sendText: () => ({ ...sent(), id: packetId++ }),
      myNodeNum: SCREENSHOT_NODES.me,
      nodes,
    } as unknown as ChatRadio['client'],
    delivery: { track: () => undefined, on: never } as unknown as ChatRadio['delivery'],
    board: { get: () => undefined },
    audience: 'club',
    groupSize: () => SCREENSHOT_NODES.others.length,
    channelOf: (segment) => (segment === 'club' ? 0 : 1),
    segmentOfChannel: (channel) => (channel === 0 ? 'club' : 'party'),
  };
}

/** The app's database, set up as after onboarding: this phone's hunter, onboarded. */
async function screenshotDatabase(db: SQLiteDatabase): Promise<void> {
  await initDatabase(db);
  await saveProfile(db, SCREENSHOT_ME);
  if ((await loadOnboardedAt(db)) === null) await markOnboarded(db, Date.now());
}

const noPairedRadio = {
  load: async () => null,
  save: async () => undefined,
  clear: async () => undefined,
};
const noBackground = { start: () => undefined, stop: () => undefined };
const noTransport = (): never => {
  throw new Error('Screenshot mode has no radio to pair');
};

/**
 * In place of AppRadioProvider: the real RadioProvider with no radio paired (so the Party tab
 * still works), and the sample club's Check In, chat and entitlement over it.
 */
function RadioStandIn({ children }: { children: ReactNode }) {
  const [checkIn] = useState(standInCheckIn);
  const [chat] = useState(() => standInChat(Date.now()));
  return (
    <RadioProvider store={noPairedRadio} createTransport={noTransport} background={noBackground}>
      <ClubEntitlementContext.Provider value={SCREENSHOT_ENTITLEMENT}>
        <CheckInRadioContext.Provider value={checkIn}>
          <ChatRadioContext.Provider value={chat}>{children}</ChatRadioContext.Provider>
        </CheckInRadioContext.Provider>
      </ClubEntitlementContext.Provider>
    </RadioProvider>
  );
}

/** The Map tab for a shot: over the sample property, with Layers open for `layers`. */
function mapProps(shot: string | undefined): MapScreenProps {
  return {
    initialView: SCREENSHOT_VIEW,
    ...(shot === undefined ? {} : { panel: shot === 'layers' ? 'layers' : null }),
  };
}

/** Starts the mode once: the fixed clock, quiet dev warnings, the sample map and chat. */
export function startScreenshotMode() {
  fixClock();
  // Dev warnings would cover the bottom of every shot.
  LogBox.ignoreAllLogs(true);
  const now = Date.now();
  mapDataStore.set(screenshotMapData(now));
  for (const item of screenshotChat(now)) chatStore.add(item);
  return { initDatabase: screenshotDatabase, RadioStandIn, mapProps };
}

export type ScreenshotMode = ReturnType<typeof startScreenshotMode>;
