/** Real TCP sockets (Node), real timers: TcpTransport against a FakeRadio served like meshtasticd. */
import { MeshClient } from '../../MeshClient';
import { FakeAir, FakeRadio } from '../../transports/FakeTransport';
import { NODES } from '../../testing/fixtures';
import { seededRandom } from '../../testing/seededRandom';
import { openTcpStream, tcpTransport } from '../tcp';
import { serveFakeRadioTcp, type FakeRadioServer } from '../fakeServer';

const waitFor = async (cond: () => boolean, ms = 5_000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe('TcpTransport (Node)', () => {
  let servers: FakeRadioServer[] = [];
  let clients: MeshClient[] = [];
  afterEach(async () => {
    await Promise.all(clients.map((c) => c.close()));
    await Promise.all(servers.map((s) => s.close()));
    servers = [];
    clients = [];
  });

  async function node(nodeNum: number, air: FakeAir) {
    const radio = new FakeRadio({ nodeNum });
    air.attach(radio);
    radio.dropLink(); // the server connects it when a client arrives
    const server = await serveFakeRadioTcp(radio);
    servers.push(server);
    const client = new MeshClient({
      transport: tcpTransport({ port: server.port, reconnect: { initialMs: 50, maxMs: 200 } }),
      random: seededRandom(nodeNum),
    });
    clients.push(client);
    return { radio, server, client };
  }

  it('handshakes over TCP and texts between two nodes', async () => {
    const air = new FakeAir();
    const a = await node(NODES.alice, air);
    const b = await node(NODES.bob, air);
    await Promise.all([a.client.connect(), b.client.connect()]);
    await Promise.all([a.client.waitUntilReady(), b.client.waitUntilReady()]);
    expect(a.client.myNodeNum).toBe(NODES.alice);

    const got: string[] = [];
    b.client.on('text', (t) => got.push(t.text));
    const h = a.client.sendText('over a real socket');
    await waitFor(() => got.length === 1);
    expect(got).toEqual(['over a real socket']);
    await expect(h.result).resolves.toMatchObject({ status: 'acked' });
  });

  it('reconnects and re-handshakes when the server drops the connection', async () => {
    const air = new FakeAir();
    const a = await node(NODES.alice, air);
    await a.client.connect();
    await a.client.waitUntilReady();
    a.server.dropClient();
    await waitFor(() => a.client.state !== 'ready');
    await waitFor(() => a.client.state === 'ready');
    expect(a.radio.handshakes).toBe(2);
  });

  it('reports a refused connection', async () => {
    const air = new FakeAir();
    const a = await node(NODES.alice, air);
    const port = a.server.port;
    await a.server.close();
    servers = [];
    await expect(openTcpStream('127.0.0.1', port, 1_000)).rejects.toThrow();
  });
});
