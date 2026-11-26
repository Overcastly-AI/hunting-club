/** Renders UI inside a RadioProvider whose radio is the mesh FakeRadio. */
import { FakeRadio, seededRandom } from '@huntclub/mesh/testing';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import type { PairedRadio } from '../db/pairedRadio';
import { RadioProvider } from '../radio/RadioProvider';
import { backgroundSpy, memoryStore, RADIO_A } from './radioFixtures';

type Options = { radio?: FakeRadio; remembered?: PairedRadio | null };

export async function renderWithRadio(ui: ReactElement, opts: Options = {}) {
  const radio = opts.radio ?? new FakeRadio(RADIO_A);
  const store = memoryStore(opts.remembered ?? null);
  const background = backgroundSpy();
  await render(
    <RadioProvider
      store={store}
      background={background}
      createTransport={() => radio}
      clientOptions={{ random: seededRandom(1), pacingMs: 0 }}
    >
      {ui}
    </RadioProvider>,
  );
  return { radio, store, background };
}
