/** Renders UI inside a RadioProvider whose radio is the mesh FakeRadio. */
import { FakeRadio, seededRandom } from '@huntclub/mesh/testing';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import type { PairedRadio } from '../db/pairedRadio';
import type { MapDataStore } from '../map/dataSource';
import { RadioProvider } from '../radio/RadioProvider';
import type { RadioServicesOptions } from '../radio/RadioServices';
import { backgroundSpy, memoryStore, RADIO_A } from './radioFixtures';

type Options = {
  radio?: FakeRadio;
  remembered?: PairedRadio | null;
  /** Random seed for this phone's radio client (give each phone its own). */
  seed?: number;
  services?: Partial<RadioServicesOptions>;
  mapStore?: MapDataStore;
};

export async function renderWithRadio(ui: ReactElement, opts: Options = {}) {
  const radio = opts.radio ?? new FakeRadio(RADIO_A);
  const store = memoryStore(opts.remembered ?? null);
  const background = backgroundSpy();
  const view = await render(
    <RadioProvider
      store={store}
      background={background}
      createTransport={() => radio}
      clientOptions={{ random: seededRandom(opts.seed ?? 1), pacingMs: 0 }}
      {...(opts.services ? { services: opts.services } : {})}
      {...(opts.mapStore ? { mapStore: opts.mapStore } : {})}
    >
      {ui}
    </RadioProvider>,
  );
  return { radio, store, background, view };
}
