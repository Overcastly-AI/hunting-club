import { FakeAir, FakeRadio, seededRandom } from '@huntclub/mesh/testing';

import {
  backgroundSpy,
  FOUND_RADIO,
  memoryStore,
  RADIO_A,
  RADIO_B,
} from '../../test-utils/radioFixtures';
import { RadioController, textStatusFor, type RadioSnapshot } from '../RadioController';

/** One phone: a controller whose transport is the given FakeRadio. */
function phone(radio: FakeRadio, store = memoryStore(), seed = 1) {
  const background = backgroundSpy();
  const controller = new RadioController({
    store,
    background,
    createTransport: () => radio,
    clientOptions: { random: seededRandom(seed), pacingMs: 0 },
    now: () => 1_000,
  });
  return { controller, store, background };
}

/** Waits until the snapshot matches (FakeRadio answers asynchronously). */
function until(
  controller: RadioController,
  check: (s: RadioSnapshot) => boolean,
): Promise<RadioSnapshot> {
  return new Promise((resolve) => {
    if (check(controller.getSnapshot())) return resolve(controller.getSnapshot());
    const off = controller.subscribe(() => {
      const s = controller.getSnapshot();
      if (check(s)) {
        off();
        resolve(s);
      }
    });
  });
}

describe('RadioController with the mesh FakeRadio', () => {
  it('pairs, reads radio info and channels, remembers the radio and starts the background link', async () => {
    const radio = new FakeRadio(RADIO_A);
    const { controller, store, background } = phone(radio);

    await controller.pair(FOUND_RADIO);
    const s = await until(controller, (x) => x.link === 'ready' && x.radio !== null);

    expect(s.radio).toEqual(
      expect.objectContaining({
        nodeNum: RADIO_A.nodeNum,
        nodeId: '!1a2b3c4d',
        longName: 'Jake radio',
        shortName: 'JK',
        firmwareVersion: radio.firmwareVersion,
      }),
    );
    expect(s.channels).toEqual([{ index: 0, name: 'Test', primary: true }]);
    expect(store.value).toEqual({
      peripheralId: FOUND_RADIO.id,
      name: FOUND_RADIO.name,
      pairedAt: 1_000,
    });
    expect(s.pairedRadio).toEqual(store.value);
    expect(background.running).toBe(true);
    await controller.dispose();
  });

  it('reconnects to the remembered radio on launch', async () => {
    const radio = new FakeRadio(RADIO_A);
    const { controller } = phone(
      radio,
      memoryStore({ peripheralId: 'X', name: 'Old', pairedAt: 1 }),
    );

    await controller.init();
    const s = await until(controller, (x) => x.link === 'ready');

    expect(s.pairedRadio?.name).toBe('Old');
    expect(radio.handshakes).toBe(1);
    await controller.dispose();
  });

  it('stays unpaired on launch when no radio is remembered', async () => {
    const { controller } = phone(new FakeRadio(RADIO_A));
    await controller.init();
    expect(controller.getSnapshot().link).toBe('none');
  });

  it('texts between two phones over the air with delivery status', async () => {
    const a = new FakeRadio(RADIO_A);
    const b = new FakeRadio(RADIO_B);
    new FakeAir().attach(a, b);
    const phoneA = phone(a, memoryStore(), 1);
    const phoneB = phone(b, memoryStore(), 2);
    await phoneA.controller.pair(FOUND_RADIO);
    await phoneB.controller.pair({ ...FOUND_RADIO, id: '11:22:33:44:55:66' });
    await until(phoneA.controller, (x) => x.link === 'ready');
    await until(phoneB.controller, (x) => x.link === 'ready');

    phoneA.controller.sendText('Seeing deer');

    const received = await until(phoneB.controller, (x) => x.texts.length === 1);
    expect(received.texts[0]).toEqual(
      expect.objectContaining({
        text: 'Seeing deer',
        from: RADIO_A.nodeNum,
        fromName: 'Jake radio',
        mine: false,
      }),
    );
    const sent = await until(phoneA.controller, (x) => x.texts[0]?.status !== 'sending');
    expect(sent.texts[0]).toEqual(expect.objectContaining({ text: 'Seeing deer', mine: true }));
    expect(['heard', 'delivered']).toContain(sent.texts[0]?.status);

    await phoneA.controller.dispose();
    await phoneB.controller.dispose();
  });

  it('shows the link dropping and the handshake re-running after the radio comes back', async () => {
    const radio = new FakeRadio(RADIO_A);
    const { controller } = phone(radio);
    await controller.pair(FOUND_RADIO);
    await until(controller, (x) => x.link === 'ready');

    radio.dropLink();
    expect(controller.getSnapshot().link).toBe('disconnected');

    radio.restoreLink();
    await until(controller, (x) => x.link === 'ready');
    expect(radio.handshakes).toBe(2);
    await controller.dispose();
  });

  it('does not remember a radio it could not connect to', async () => {
    const radio = new FakeRadio(RADIO_A);
    jest.spyOn(radio, 'connect').mockRejectedValueOnce(new Error('Wrong PIN'));
    const { controller, store, background } = phone(radio);

    await expect(controller.pair(FOUND_RADIO)).rejects.toThrow('Wrong PIN');

    expect(store.value).toBeNull();
    expect(controller.getSnapshot().pairedRadio).toBeNull();
    expect(controller.getSnapshot().link).toBe('disconnected');
    expect(background.running).toBe(false);
  });

  it('forgets the radio: disconnects, clears storage and stops the background link', async () => {
    const radio = new FakeRadio(RADIO_A);
    const { controller, store, background } = phone(radio);
    await controller.pair(FOUND_RADIO);
    await until(controller, (x) => x.link === 'ready');

    await controller.forget();

    expect(store.value).toBeNull();
    expect(background.running).toBe(false);
    expect(controller.getSnapshot()).toEqual(
      expect.objectContaining({ link: 'none', pairedRadio: null, radio: null }),
    );
  });

  it('surfaces reconnecting and re-pair hints from the transport', async () => {
    const radio = new FakeRadio(RADIO_A);
    let reconnecting = () => {};
    let repair = () => {};
    const transport = Object.assign(radio, {
      onReconnecting: (cb: () => void) => ((reconnecting = cb), () => {}),
      onRepairNeeded: (cb: () => void) => ((repair = cb), () => {}),
    });
    const controller = new RadioController({
      store: memoryStore(),
      background: backgroundSpy(),
      createTransport: () => transport,
      clientOptions: { random: seededRandom(3) },
    });
    await controller.pair(FOUND_RADIO);
    await until(controller, (x) => x.link === 'ready');

    radio.dropLink();
    reconnecting();
    expect(controller.getSnapshot().link).toBe('reconnecting');
    repair();
    expect(controller.getSnapshot().repairNeeded).toBe(true);
    await controller.dispose();
  });
});

describe('textStatusFor', () => {
  it('words each delivery result', () => {
    expect(textStatusFor({ status: 'acked', by: 1, implicit: false })).toBe('delivered');
    expect(textStatusFor({ status: 'acked', by: 1, implicit: true })).toBe('heard');
    expect(textStatusFor({ status: 'sent' })).toBe('sent');
    expect(textStatusFor({ status: 'timeout' })).toBe('noReply');
    expect(textStatusFor({ status: 'failed', code: 5, reason: 'x' })).toBe('failed');
    expect(textStatusFor({ status: 'cancelled' })).toBe('failed');
  });
});
