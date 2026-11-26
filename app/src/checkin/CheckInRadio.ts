import {
  CheckInError,
  type CheckInController,
  type OpenCheckIn,
  type Placement,
} from '@huntclub/core';
import type { DeliveryResult } from '@huntclub/mesh';
import { createContext, useCallback, useContext, useState, useSyncExternalStore } from 'react';

import type { Audience } from '../domain/audience';
import type { ClubArea, ClubStand } from './placement';

/**
 * What the Check In tab and the map's bottom sheet need from the radio.
 * RadioProvider (Milestone 2) provides it with `<CheckInRadioContext.Provider>`;
 * until then the context is null and the UI says to connect a radio.
 */
export type CheckInRadio = {
  checkIns: Pick<CheckInController, 'current' | 'checkIn' | 'checkOut' | 'on'>;
  audience: Audience;
  /** Overdue grace time (club: admin-set). */
  graceMinutes: number;
  /** Club stands and areas from club sync; absent for free parties. */
  club?: { stands: readonly ClubStand[]; areas: readonly ClubArea[] };
};

export const CheckInRadioContext = createContext<CheckInRadio | null>(null);

const noRadio = () => () => undefined;

/** Our open check-in (null when checked out), kept current. */
export function useCheckInState(): { radio: CheckInRadio | null; current: OpenCheckIn | null } {
  const radio = useContext(CheckInRadioContext);
  const subscribe = useCallback(
    (onChange: () => void) => (radio ? radio.checkIns.on('change', onChange) : noRadio()),
    [radio],
  );
  const current = useSyncExternalStore(subscribe, () => radio?.checkIns.current ?? null);
  return { radio, current };
}

/** What the last check-in or check-out is doing, in words. */
export type SendStatus = { tone: 'busy' | 'ok' | 'problem'; text: string } | null;

export function describeDelivery(result: DeliveryResult, sent: string): Exclude<SendStatus, null> {
  switch (result.status) {
    case 'acked':
    case 'sent':
      return { tone: 'ok', text: sent };
    case 'cancelled':
      return { tone: 'problem', text: 'Cancelled' };
    case 'failed':
    case 'timeout':
      return { tone: 'problem', text: 'Your radio didn’t send it. Check the radio and try again.' };
  }
}

/** Check in (or change mode) and check out, with the send status as words. */
export function useCheckInActions(radio: CheckInRadio | null) {
  const [status, setStatus] = useState<SendStatus>(null);

  const run = useCallback(
    (send: () => { result: Promise<DeliveryResult> }, sending: string, sent: string) => {
      try {
        const handle = send();
        setStatus({ tone: 'busy', text: sending });
        void handle.result.then((result) => setStatus(describeDelivery(result, sent)));
        return true;
      } catch (error) {
        const text =
          error instanceof CheckInError ? error.message : 'Something went wrong. Try again.';
        setStatus({ tone: 'problem', text });
        return false;
      }
    },
    [],
  );

  const checkIn = useCallback(
    (placement: Placement) =>
      radio
        ? run(() => radio.checkIns.checkIn(placement), 'Sending your check-in…', 'Checked in')
        : false,
    [radio, run],
  );
  const checkOut = useCallback(
    () =>
      radio
        ? run(() => radio.checkIns.checkOut(), 'Sending your check-out…', 'Checked out')
        : false,
    [radio, run],
  );
  return { checkIn, checkOut, status };
}
