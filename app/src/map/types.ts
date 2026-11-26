import type { CheckInMode } from '../domain/checkIn';
import type { StandType } from '../domain/stands';

/**
 * Map-facing view model. The map renders these; it does not know about the
 * radio. A later milestone fills them from `@huntclub/mesh` positions and
 * check-ins (see `MapDataSource`).
 */

/** A WGS84 coordinate. */
export type LatLon = { lat: number; lon: number };

type Place<K extends CheckInMode, Fields> = { kind: K } & Fields;

/** Where a hunter is hunting, as other hunters see it; one variant per check-in mode. */
export type HunterPlace =
  | Place<'stand', { name: string }>
  | Place<'area', { name: string }>
  | Place<'spot', { name?: string }>
  | Place<'moving', { areaName?: string }>;

/** Another hunter's last known position. */
export type HunterOnMap = {
  /** Stable key, for example the radio node ID. */
  id: string;
  displayName: string;
  initials: string;
  position: LatLon;
  /** When the position was heard, ms since the Unix epoch (radio/GPS time preferred). */
  heardAt: number;
  place: HunterPlace;
};

/** A club stand nobody is checked in to. */
export type OpenStandOnMap = {
  id: string;
  name: string;
  type: StandType;
  position: LatLon;
};

/** What the mesh status line shows. */
export type MeshStatus = {
  /** Whether this phone has a radio connected over Bluetooth. */
  radioConnected: boolean;
  /** Radios heard recently, not counting your own. */
  radioCount: number;
  /** When any radio was last heard, ms since the Unix epoch; null if never. */
  lastHeardAt: number | null;
};

/** Everything the map draws apart from the basemap and your own position. */
export type MapData = {
  hunters: readonly HunterOnMap[];
  openStands: readonly OpenStandOnMap[];
  mesh: MeshStatus;
};
