// The example club the home page's map shows (docs/DESIGN.md, the mockups' sample club): one
// list, so the picture (@huntclub/design/aerial), the markers and the legend agree on who is
// where. Positions are px on the aerial (AERIAL_WORLD). Names, ages and conditions are sample
// data, and the page says so; the wording comes from the same functions the app uses.
import type { AerialClub, AerialPoint } from '@huntclub/design/aerial';
import {
  describeFreshness,
  formatClockTime,
  type FreshnessView,
  MINUTE_MS,
  SECOND_MS,
  type StandType,
  temperatureReadout,
  windReadout,
} from '@huntclub/shared';

export interface SampleStand {
  readonly name: string;
  readonly type: StandType;
  readonly at: AerialPoint;
  /** Put the plate on the marker's left (it would cover something on its right). */
  readonly left?: boolean;
}

export interface SampleHunter {
  readonly initials: string;
  readonly name: string;
  /** The stand, "My spot" or "On the move". */
  readonly where: string;
  /** How long ago their radio was last heard. */
  readonly heardAgoMs: number;
  readonly at: AerialPoint;
  readonly left?: boolean;
}

/** A word on the map (a creek, a road, the club's name), turned to follow its feature. */
export interface SampleLabel {
  readonly text: string;
  readonly at: AerialPoint;
  readonly kind: 'water' | 'road' | 'name';
  readonly turn?: number;
}

/** A club as the example map draws it: the aerial's line and areas, plus who and what is on it. */
interface SampleClub extends AerialClub {
  readonly name: string;
  readonly acres: number;
  readonly areas: readonly { name: string; at: AerialPoint; line: readonly AerialPoint[] }[];
  readonly stands: readonly SampleStand[];
  readonly hunters: readonly SampleHunter[];
  readonly you: AerialPoint;
  readonly camp: AerialPoint;
}

export const SAMPLE_CLUB = {
  name: 'Pine Ridge Hunt Club',
  acres: 412,
  line: [
    [800, 402],
    [1178, 384],
    [1404, 428],
    [1412, 762],
    [1292, 770],
    [1284, 1012],
    [962, 1030],
    [806, 962],
    [792, 640],
  ],
  areas: [
    {
      name: 'Creek Bottom',
      at: [905, 800],
      line: [
        [815, 585],
        [960, 640],
        [1090, 800],
        [1060, 905],
        [900, 880],
        [812, 800],
      ],
    },
    {
      name: 'North 40',
      at: [1215, 415],
      line: [
        [1140, 395],
        [1400, 432],
        [1405, 580],
        [1150, 570],
      ],
    },
  ],
  stands: [
    { name: 'Creek Stand', type: 'ladder', at: [872, 612] },
    { name: 'Oak Ridge', type: 'ladder', at: [975, 520] },
    { name: 'Hickory Flat', type: 'tree_stand', at: [905, 850] },
    { name: 'Powerline', type: 'ground_blind', at: [1236, 733] },
    { name: 'Pond Box', type: 'ground_blind', at: [1232, 640], left: true },
    { name: 'South Plot', type: 'tree_stand', at: [1125, 930] },
    { name: 'Corn Corner', type: 'ladder', at: [1335, 462], left: true },
  ],
  hunters: [
    {
      initials: 'DB',
      name: 'Dale B.',
      where: 'Creek Stand',
      heardAgoMs: MINUTE_MS,
      at: [872, 612],
    },
    {
      initials: 'RT',
      name: 'Ray T.',
      where: 'On the move',
      heardAgoMs: 9 * MINUTE_MS,
      at: [1035, 690],
      left: true,
    },
    {
      initials: 'JH',
      name: 'June H.',
      where: 'Hickory Flat',
      heardAgoMs: MINUTE_MS,
      at: [905, 850],
    },
    {
      initials: 'MW',
      name: 'Marcus W.',
      where: 'Powerline',
      heardAgoMs: 4 * MINUTE_MS,
      at: [1236, 733],
    },
    {
      initials: 'TA',
      name: 'Tom A.',
      where: 'My spot',
      heardAgoMs: 30 * SECOND_MS,
      at: [1338, 560],
      left: true,
    },
  ],
  you: [985, 745],
  camp: [1052, 470],
} as const satisfies SampleClub;

export const SAMPLE_LABELS: readonly SampleLabel[] = [
  { text: 'Mill Creek', at: [930, 742], kind: 'water', turn: 44 },
  { text: 'Duck Pond', at: [1352, 622], kind: 'water' },
  { text: 'County Road 12', at: [1420, 306], kind: 'road', turn: -4 },
  { text: `${SAMPLE_CLUB.name}, ${SAMPLE_CLUB.acres} acres`, at: [990, 420], kind: 'name' },
  ...SAMPLE_CLUB.areas.map((a) => ({ text: a.name, at: a.at, kind: 'name' as const })),
];

/** The moment the example map shows. */
const SAMPLE_NOW = Date.UTC(2026, 10, 14, 17, 0);

/** A hunter's ring and plate wording, from the shared freshness rules. */
export const hunterFreshness = (h: SampleHunter): FreshnessView =>
  describeFreshness(SAMPLE_NOW - h.heardAgoMs, SAMPLE_NOW);

/** Stands nobody is checked in at: they show "Open". */
export const openStands = (): readonly SampleStand[] => {
  const taken = new Set<string>(SAMPLE_CLUB.hunters.map((h) => h.where));
  return SAMPLE_CLUB.stands.filter((s) => !taken.has(s.name));
};

/** How many radios the example mesh hears, and when it last heard one. */
export const SAMPLE_MESH = {
  radios: 3,
  heard: describeFreshness(SAMPLE_NOW - 12 * SECOND_MS, SAMPLE_NOW, 'heard'),
} as const;

/** A clock time on the sample day (local, so it reads the same on any build machine). */
const sampleClock = (hours: number, minutes: number) =>
  formatClockTime(new Date(2026, 10, 14, hours, minutes));

/** The readout strip's sample values, worded by the shared readout functions. */
export const SAMPLE_CONDITIONS = {
  sunrise: sampleClock(6, 52),
  sunset: sampleClock(16, 38),
  wind: windReadout(6, 315),
  temperature: temperatureReadout(34),
} as const;

/** The scale bar: 84 px of the aerial (1 px is about 6 ft). */
export const SAMPLE_SCALE = { px: 84, label: '500 ft' } as const;
