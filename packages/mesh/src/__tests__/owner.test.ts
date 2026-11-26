import { fromBinary, toBinary } from '@bufbuild/protobuf';

import { decodeAdmin } from '../codec/radio';
import { Admin, Mesh, Portnums } from '../protobufs';
import { OWNER_WIRE_LIMITS, buildSetOwnerMessage, fitUtf8, ownerFromProfile } from '../owner';
import { connectedClient, tick } from '../testing/fixtures';

describe('ownerFromProfile', () => {
  it('passes short names through', () => {
    expect(ownerFromProfile({ displayName: 'Dale Earl', initials: 'DE' })).toEqual({
      longName: 'Dale Earl',
      shortName: 'DE',
    });
  });

  it('cuts to the radio byte limits on whole characters', () => {
    const owner = ownerFromProfile({ displayName: 'é'.repeat(40), initials: 'ÉÉÉ' });
    expect(owner.longName).toBe('é'.repeat(19)); // 38 bytes; a 20th would be 40
    expect(owner.shortName).toBe('ÉÉ'); // 4 bytes
    expect(fitUtf8('x'.repeat(40), OWNER_WIRE_LIMITS.longNameBytes)).toHaveLength(39);
    expect(fitUtf8('🦌a', 3)).toBe(''); // never splits a 4-byte character
  });
});

describe('setOwner', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('round-trips a set_owner admin message', () => {
    const msg = buildSetOwnerMessage({ longName: 'Dale', shortName: 'DE' });
    const decoded = decodeAdmin(toBinary(Admin.AdminMessageSchema, msg));
    expect(decoded.payloadVariant.case).toBe('setOwner');
    expect(decoded.payloadVariant.value).toMatchObject({ longName: 'Dale', shortName: 'DE' });
  });

  it('writes the owner to our own radio', async () => {
    const { radio, client } = await connectedClient();
    const handle = client.setOwner({ longName: 'Dale Earl', shortName: 'DE' });
    await tick(500);
    const [packet] = radio.sentPackets();
    expect(packet!.to).toBe(radio.nodeNum);
    const admin = decodeAdmin((packet!.payloadVariant.value as Mesh.Data).payload);
    expect(admin.payloadVariant.case).toBe('setOwner');
    expect(radio.user).toMatchObject({ longName: 'Dale Earl', shortName: 'DE' });
    expect((await handle.result).status).toBe('acked');
  });

  it('shares the new name in the node info we send', async () => {
    const { radio, client } = await connectedClient();
    client.setOwner({ longName: 'Dale Earl', shortName: 'DE' });
    expect(client.nodes.get(client.myNodeNum)?.user).toMatchObject({
      longName: 'Dale Earl',
      shortName: 'DE',
      id: radio.user.id,
    });
    client.sendNodeInfo();
    await tick(500);
    const info = radio
      .sentPackets()
      .map((p) => p.payloadVariant.value as Mesh.Data)
      .find((d) => d.portnum === Portnums.PortNum.NODEINFO_APP)!;
    expect(fromBinary(Mesh.UserSchema, info.payload)).toMatchObject({ longName: 'Dale Earl' });
  });
});
