/**
 * Node-only TCP adapter for StreamTransport: talks to meshtasticd's API
 * port (default 4403). For dev tools and CI integration tests; the app uses
 * BLE. Import from `@huntclub/mesh/node`, never from the package root,
 * so React Native bundles never see `node:net`.
 */
import { Socket } from 'node:net';
import {
  StreamTransport,
  type ByteStream,
  type StreamTransportOptions,
} from '../transports/StreamTransport';

export const MESHTASTICD_DEFAULT_PORT = 4403;

export interface TcpOptions extends StreamTransportOptions {
  host?: string;
  port?: number;
  /** Give up on a connection attempt after this long. Default 5 s. */
  connectTimeoutMs?: number;
}

/** Opens one TCP connection as a ByteStream. */
export function openTcpStream(host: string, port: number, timeoutMs = 5_000): Promise<ByteStream> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    socket.setNoDelay(true);
    const fail = (err: Error) => {
      socket.destroy();
      reject(err);
    };
    socket.setTimeout(timeoutMs, () => fail(new Error(`TCP connect to ${host}:${port} timed out`)));
    socket.once('error', fail);
    socket.connect(port, host, () => {
      socket.setTimeout(0);
      socket.off('error', fail);
      socket.on('error', () => socket.destroy());
      resolve({
        write: (bytes) =>
          new Promise<void>((res, rej) => socket.write(bytes, (err) => (err ? rej(err) : res()))),
        onData: (cb) => {
          const h = (chunk: Buffer) =>
            cb(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.length));
          socket.on('data', h);
          return () => socket.off('data', h);
        },
        onClose: (cb) => {
          socket.once('close', cb);
          return () => socket.off('close', cb);
        },
        close: () =>
          new Promise<void>((res) => {
            if (socket.destroyed) return res();
            socket.once('close', () => res());
            socket.end();
            setTimeout(() => socket.destroy(), 1_000).unref();
          }),
      });
    });
  });
}

/** A Transport to meshtasticd over TCP. */
export function tcpTransport(opts: TcpOptions = {}): StreamTransport {
  const host = opts.host ?? '127.0.0.1';
  const port = opts.port ?? MESHTASTICD_DEFAULT_PORT;
  return new StreamTransport(() => openTcpStream(host, port, opts.connectTimeoutMs), opts);
}
