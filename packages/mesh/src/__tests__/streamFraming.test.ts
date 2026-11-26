import {
  FRAME_START1,
  FRAME_START2,
  FrameDecoder,
  MAX_FRAME_PAYLOAD,
  WAKE_BYTES,
  encodeFrame,
  wakeSequence,
} from '../codec/streamFraming';
import { encodeUtf8 } from '../runtime';

const p = (...b: number[]) => Uint8Array.of(...b);

describe('stream framing', () => {
  it('encodes 0x94 0xC3 + big-endian length + payload', () => {
    expect([...encodeFrame(p(1, 2, 3))]).toEqual([0x94, 0xc3, 0, 3, 1, 2, 3]);
    const big = encodeFrame(new Uint8Array(300));
    expect([big[2], big[3]]).toEqual([1, 44]);
    expect(() => encodeFrame(new Uint8Array(MAX_FRAME_PAYLOAD + 1))).toThrow(RangeError);
    expect(encodeFrame(new Uint8Array(0))).toEqual(p(0x94, 0xc3, 0, 0));
  });

  it('wake sequence is 32 START2 bytes', () => {
    const w = wakeSequence();
    expect(w).toHaveLength(WAKE_BYTES);
    expect(w.every((b) => b === FRAME_START2)).toBe(true);
  });

  it('decodes frames split at every byte boundary', () => {
    const stream = Uint8Array.of(...encodeFrame(p(9, 8, 7)), ...encodeFrame(p(6)));
    const d = new FrameDecoder();
    const out: number[][] = [];
    for (const b of stream) for (const f of d.push(p(b))) out.push([...f]);
    expect(out).toEqual([[9, 8, 7], [6]]);
  });

  it('decodes several frames in one chunk, including an empty frame', () => {
    const d = new FrameDecoder();
    const frames = d.push(
      Uint8Array.of(...encodeFrame(p(1)), ...encodeFrame(p()), ...encodeFrame(p(2, 2))),
    );
    expect(frames.map((f) => [...f])).toEqual([[1], [], [2, 2]]);
  });

  it('skips debug text and the wake sequence between frames', () => {
    const d = new FrameDecoder();
    const text = encodeUtf8('INFO  | ??:??:?? 1 [Router] booted\r\n');
    const frames = d.push(Uint8Array.of(...wakeSequence(), ...text, ...encodeFrame(p(5)), ...text));
    expect(frames.map((f) => [...f])).toEqual([[5]]);
    expect(d.skipped).toBeGreaterThan(text.length);
  });

  it('resyncs after a false start marker or an impossible length', () => {
    const d = new FrameDecoder();
    const bogus = p(FRAME_START1, 0x00, FRAME_START1, FRAME_START2, 0xff, 0xff); // length 65535 > 512
    const frames = d.push(Uint8Array.of(...bogus, ...encodeFrame(p(4, 4))));
    expect(frames.map((f) => [...f])).toEqual([[4, 4]]);
  });

  it('waits for the rest of a partial frame, and reset() drops it', () => {
    const d = new FrameDecoder();
    const f = encodeFrame(p(1, 2, 3, 4));
    expect(d.push(f.subarray(0, 5))).toEqual([]);
    d.reset();
    expect(d.push(f.subarray(5))).toEqual([]);
    expect(d.push(f).map((x) => [...x])).toEqual([[1, 2, 3, 4]]);
  });
});
