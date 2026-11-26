import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, type ReactNode } from 'react';

import { startRadioService, stopRadioService } from '../../modules/radio-service';
import { clearPairedRadio, loadPairedRadio, savePairedRadio } from '../db/pairedRadio';
import { sqlitePartyStore } from '../db/partyStore';
import { BleTransport } from './BleTransport';
import { radioCopy } from './copy';
import { randomBytes } from './random';
import type { BackgroundLink, CreateTransport, PairedRadioStore } from './RadioController';
import { RadioProvider } from './RadioProvider';

const createBleTransport: CreateTransport = (radio, { retryFirstConnect }) =>
  new BleTransport({ peripheralId: radio.peripheralId, retryFirstConnect });

const androidForegroundService: BackgroundLink = {
  start: () => {
    startRadioService(radioCopy.service);
  },
  stop: stopRadioService,
};

const clientOptions = { random: randomBytes };

/** RadioProvider wired to Bluetooth, SQLite and the Android foreground service. */
export function AppRadioProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const store = useMemo<PairedRadioStore>(
    () => ({
      load: () => loadPairedRadio(db),
      save: (radio) => savePairedRadio(db, radio),
      clear: () => clearPairedRadio(db),
    }),
    [db],
  );
  const services = useMemo(() => ({ partyStore: sqlitePartyStore(db) }), [db]);
  return (
    <RadioProvider
      store={store}
      createTransport={createBleTransport}
      background={androidForegroundService}
      clientOptions={clientOptions}
      services={services}
    >
      {children}
    </RadioProvider>
  );
}
