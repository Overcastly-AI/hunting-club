/**
 * A TCP server that serves a FakeRadio like meshtasticd serves its API
 * (framed ToRadio/FromRadio on one connection at a time). Node-only, for
 * tests: the TCP transport test and the integration suite's offline mode.
 */
import { createServer, type Server, type Socket } from 'node:net';
import type { FakeRadio } from '../transports/FakeTransport';
import { serveFramed } from '../testing/framedRadio';

export interface FakeRadioServer {
  port: number;
  /** Drops the current client connection (like meshtasticd restarting). */
  dropClient(): void;
  close(): Promise<void>;
}

export function serveFakeRadioTcp(radio: FakeRadio, port = 0): Promise<FakeRadioServer> {
  let client: Socket | undefined;
  const server: Server = createServer((socket) => {
    client?.destroy();
    client = socket;
    const link = serveFramed(radio, (bytes) => socket.write(bytes));
    socket.on('data', (chunk: Buffer) => link.receive(new Uint8Array(chunk)));
    socket.on('close', () => link.end());
    socket.on('error', () => socket.destroy());
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        port: typeof addr === 'object' && addr ? addr.port : port,
        dropClient: () => client?.destroy(),
        close: () =>
          new Promise<void>((res) => {
            client?.destroy();
            server.close(() => res());
          }),
      });
    });
  });
}
