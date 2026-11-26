/**
 * Serves a FakeRadio over a framed byte stream, the way meshtasticd serves
 * its TCP API: frames from the client go to the radio, the radio's
 * FromRadio bytes come back framed. Lets StreamTransport/TcpTransport be
 * tested here without a real simulator.
 */
import { FrameDecoder, encodeFrame } from '../codec/streamFraming';
import type { ByteStream, StreamOpener } from '../transports/StreamTransport';
import type { FakeRadio } from '../transports/FakeTransport';
import type { Unsubscribe } from '../transport';

/** The device end of a framed link: write raw bytes in, get raw bytes out. */
export interface FramedRadioLink {
  /** Bytes arriving from the client. */
  receive(chunk: Uint8Array): void;
  /** Stops forwarding and disconnects the radio's phone link. */
  end(): void;
}

/** Connects a FakeRadio to a framed byte sink (one client connection). */
export function serveFramed(radio: FakeRadio, send: (bytes: Uint8Array) => void): FramedRadioLink {
  const decoder = new FrameDecoder();
  const off = radio.onFromRadio((b) => send(encodeFrame(b)));
  radio.restoreLink();
  return {
    receive(chunk) {
      for (const frame of decoder.push(chunk)) void radio.write(frame).catch(() => {});
    },
    end() {
      off();
      radio.dropLink();
    },
  };
}

/**
 * An in-memory StreamOpener backed by a FakeRadio. `kill()` on the returned
 * control closes the current stream from the device side.
 */
export function framedFakeRadio(radio: FakeRadio): {
  open: StreamOpener;
  kill(): void;
  /** Sends raw bytes to the client (e.g. debug text between frames). */
  inject(bytes: Uint8Array): void;
  /** Make the next open() fail. */
  failNextOpen(): void;
} {
  let current: { close(): void; push(b: Uint8Array): void } | undefined;
  let failNext = false;
  const open: StreamOpener = async () => {
    if (failNext) {
      failNext = false;
      throw new Error('connection refused');
    }
    const dataCbs = new Set<(c: Uint8Array) => void>();
    const closeCbs = new Set<() => void>();
    let closed = false;
    const push = (b: Uint8Array) => {
      if (!closed) for (const cb of [...dataCbs]) cb(b);
    };
    const link = serveFramed(radio, push);
    const close = () => {
      if (closed) return;
      closed = true;
      link.end();
      for (const cb of [...closeCbs]) cb();
    };
    current = { close, push };
    const stream: ByteStream = {
      write: async (bytes) => {
        if (closed) throw new Error('stream closed');
        link.receive(bytes);
      },
      onData: (cb): Unsubscribe => {
        dataCbs.add(cb);
        return () => dataCbs.delete(cb);
      },
      onClose: (cb): Unsubscribe => {
        closeCbs.add(cb);
        return () => closeCbs.delete(cb);
      },
      close: async () => close(),
    };
    return stream;
  };
  return {
    open,
    kill: () => current?.close(),
    inject: (b) => current?.push(b),
    failNextOpen: () => {
      failNext = true;
    },
  };
}
