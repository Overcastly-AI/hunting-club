// The screenshot mode's sample club, built from the one sample property (@huntclub/shared/sample,
// the web's sign-in backdrop): its stands and areas, three other hunters' radios at fixed places,
// and a short club chat. Made up; nothing here comes from a radio or the network.
import { DAY_MS, MINUTE_MS, polygonBounds } from '@huntclub/shared';
import { SAMPLE_PROPERTY } from '@huntclub/shared/sample';

import { chatItemId, groupConversation, type ChatItem } from '../chat/model';
import type { ClubArea, ClubStand } from '../checkin/placement';
import type { ClubEntitlement } from '../club/entitlement';
import type { MyProfile } from '../db/appState';
import type { HunterOnMap, HunterPlace, MapData } from '../map/types';

/**
 * The fixed clock: Saturday November 14, 2026, 3:40 PM in central Illinois (21:40 UTC), about an
 * hour before sunset there, so sunrise, sunset and "heard 2 min ago" read the same every run.
 */
export const SCREENSHOT_NOW = Date.UTC(2026, 10, 14, 21, 40);

/** This phone's hunter. */
export const SCREENSHOT_ME: MyProfile = { displayName: 'Jake S.', initials: 'JS' };
const MY_NODE = 0x0a11ce01;

const [west, south, east, north] = polygonBounds(SAMPLE_PROPERTY.boundary);
/** The Map tab opens over the whole sample property. */
export const SCREENSHOT_VIEW = {
  center: [(west + east) / 2, (south + north) / 2] as [number, number],
  zoom: 14.6,
};
/** Where the emulator's GPS puts this phone: the middle of the property. */
export const SCREENSHOT_HERE = { lat: SCREENSHOT_VIEW.center[1], lon: SCREENSHOT_VIEW.center[0] };

const { north: northArea, creek: creekArea } = SAMPLE_PROPERTY.areas;

/** The club's open (active) stands, as check-in offers them; closed stands are hidden. */
const activeStands = SAMPLE_PROPERTY.stands.filter((s) => s.active);
const standOf = (name: string) => activeStands.find((s) => s.name === name)!;
const creekStand = standOf('Creek Stand');
const bigOak = standOf('Big Oak Ladder');

type Hunter = {
  node: number;
  displayName: string;
  initials: string;
  position: { lat: number; lon: number };
  place: HunterPlace;
  heardMinutesAgo: number;
};

/** The three other hunters out today, each heard by this phone's radio. */
const HUNTERS: readonly Hunter[] = [
  {
    node: 0x0a11ce02,
    displayName: 'Dale B.',
    initials: 'DB',
    position: { lat: creekStand.lat, lon: creekStand.lon },
    place: { kind: 'stand', name: creekStand.name },
    heardMinutesAgo: 2,
  },
  {
    node: 0x0a11ce03,
    displayName: 'Ruth K.',
    initials: 'RK',
    position: { lat: 40.0126, lon: -89.9938 },
    place: { kind: 'moving', areaName: northArea.name },
    heardMinutesAgo: 1,
  },
  {
    node: 0x0a11ce04,
    displayName: 'Sam L.',
    initials: 'SL',
    position: { lat: 40.0027, lon: -89.9915 },
    place: { kind: 'area', name: creekArea.name },
    heardMinutesAgo: 6,
  },
];

export const SCREENSHOT_ENTITLEMENT: ClubEntitlement = {
  clubId: '5e0a3b4c-6d7e-4f8a-9b0c-00000000c1ab',
  clubName: SAMPLE_PROPERTY.name,
  featuresUntil: SCREENSHOT_NOW + 365 * DAY_MS,
};

/** Stands and areas for Check In: Creek Stand is taken (Dale is in it). */
export const SCREENSHOT_CLUB: { stands: readonly ClubStand[]; areas: readonly ClubArea[] } = {
  stands: activeStands.map((s, i) => ({
    meshId: i + 1,
    name: s.name,
    type: s.type,
    position: { lat: s.lat, lon: s.lon },
    ...(s.name === creekStand.name ? { occupiedBy: HUNTERS[0]!.displayName } : {}),
  })),
  areas: [northArea, creekArea].map((a, i) => ({
    meshId: i + 1,
    name: a.name,
    boundary: a.boundary,
  })),
};

/** Where this phone checks in for the checked-in shot: the open stand. */
export const SCREENSHOT_CHECK_IN_STAND = SCREENSHOT_CLUB.stands.find(
  (s) => s.name === bigOak.name,
)!;

export const SCREENSHOT_NODES = {
  me: MY_NODE,
  others: HUNTERS.map((h) => ({
    num: h.node,
    user: { longName: h.displayName, shortName: h.initials },
  })),
};

/** The map: three hunters (location shared while checked in), the open stand, three radios. */
export function screenshotMapData(now: number): MapData {
  const hunters: HunterOnMap[] = HUNTERS.map((h) => ({
    id: String(h.node),
    displayName: h.displayName,
    initials: h.initials,
    position: h.position,
    heardAt: now - h.heardMinutesAgo * MINUTE_MS,
    place: h.place,
  }));
  return {
    hunters,
    openStands: [
      {
        id: bigOak.name,
        name: bigOak.name,
        type: bigOak.type,
        position: { lat: bigOak.lat, lon: bigOak.lon },
      },
    ],
    mesh: {
      radioConnected: true,
      radioCount: HUNTERS.length,
      lastHeardAt: now - Math.min(...HUNTERS.map((h) => h.heardMinutesAgo)) * MINUTE_MS,
    },
  };
}

/** The Whole club thread: three hunters and this phone, oldest first. */
export function screenshotChat(now: number): ChatItem[] {
  const [dale, ruth, sam] = HUNTERS as [Hunter, Hunter, Hunter];
  const lines: { from: Hunter | null; minutesAgo: number; text: string }[] = [
    { from: dale, minutesAgo: 52, text: 'Two does crossed the creek below me at first light.' },
    { from: ruth, minutesAgo: 31, text: 'Walking the north fence line. Out by sunset.' },
    { from: null, minutesAgo: 18, text: `Sitting ${bigOak.name} till dark if it's free.` },
    { from: sam, minutesAgo: 9, text: 'Wind is out of the northwest. Big Oak should be good.' },
  ];
  return lines.map(({ from, minutesAgo, text }, i) => {
    const node = from?.node ?? MY_NODE;
    const messageId = 0x5000 + i;
    return {
      kind: 'text',
      id: chatItemId('text', node, messageId),
      messageId,
      conversation: groupConversation('club'),
      from: node,
      fromName: from?.displayName ?? 'You',
      mine: from === null,
      text,
      at: now - minutesAgo * MINUTE_MS,
      ...(from ? { place: from.place } : { sendState: 'sent', packetId: messageId }),
      ...(from ? {} : { delivered: { to: HUNTERS.length, of: HUNTERS.length } }),
    } satisfies ChatItem;
  });
}
