import { createContext, useContext } from 'react';

import type { ClubStand } from '../checkin/placement';
import type { MapNames, MapRadio } from '../map/meshMapData';

/**
 * What Board mode needs from the board's own radio. RadioProvider (Milestone 2)
 * provides it with `<BoardRadioContext.Provider>`; until then it is null and
 * the board says to connect its radio. RadioProvider reconnects on its own;
 * the board only shows the link state.
 */
export type BoardRadio = MapRadio & {
  /** Overdue grace time in minutes (club: admin-set). */
  graceMinutes: number;
  /** The club's stands from club sync (Milestone 10); open ones are listed separately. */
  stands: readonly ClubStand[];
  /** Names this device knows for members, stands and areas. */
  names?: MapNames;
};

export const BoardRadioContext = createContext<BoardRadio | null>(null);

export function useBoardRadio(): BoardRadio | null {
  return useContext(BoardRadioContext);
}
