/**
 * Meshtastic stream framing, used on serial and TCP (meshtasticd port 4403),
 * not on BLE:
 *
 *   0x94 0xC3 <len hi> <len lo> <protobuf bytes (len ≤ 512)>
 *
 * A device may also print plain-text debug output between frames; the
 * decoder skips any bytes that are not part of a frame and resynchronises
 * on the next start marker.
 */
export const FRAME_START1 = 0x94;
export const FRAME_START2 = 0xc3;
export const FRAME_HEADER_BYTES = 4;
/** Firmware MAX_TO_FROM_RADIO_SIZE. */
export const MAX_FRAME_PAYLOAD = 512;
/** Python/Meshtastic clients send this many START2 bytes to wake a sleeping serial device. */
export const WAKE_BYTES = 32;

export function encodeFrame(payload: Uint8Array): Uint8Array {
  if (payload.length > MAX_FRAME_PAYLOAD) {
    throw new RangeError(`Frame payload is ${payload.length} bytes; max ${MAX_FRAME_PAYLOAD}`);
  }
  const out = new Uint8Array(FRAME_HEADER_BYTES + payload.length);
  out[0] = FRAME_START1;
  out[1] = FRAME_START2;
  out[2] = (payload.length >> 8) & 0xff;
  out[3] = payload.length & 0xff;
  out.set(payload, FRAME_HEADER_BYTES);
  return out;
}

export const wakeSequence = (): Uint8Array => new Uint8Array(WAKE_BYTES).fill(FRAME_START2);

/** Incremental decoder: feed it chunks as they arrive, get whole payloads back. */
export class FrameDecoder {
  private buf = new Uint8Array(0);
  /** Bytes skipped because they were not part of a frame (debug text, line noise). */
  skipped = 0;

  push(chunk: Uint8Array): Uint8Array[] {
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf);
    merged.set(chunk, this.buf.length);
    const frames: Uint8Array[] = [];
    let i = 0;
    for (;;) {
      // Find the next start marker.
      let start = i;
      while (
        start < merged.length &&
        !(
          merged[start] === FRAME_START1 &&
          (start + 1 >= merged.length || merged[start + 1] === FRAME_START2)
        )
      ) {
        start++;
      }
      this.skipped += start - i;
      i = start;
      if (merged.length - i < FRAME_HEADER_BYTES) break;
      const len = (merged[i + 2]! << 8) | merged[i + 3]!;
      if (len > MAX_FRAME_PAYLOAD) {
        // Not a real header: skip the marker byte and resync.
        this.skipped++;
        i++;
        continue;
      }
      if (merged.length - i < FRAME_HEADER_BYTES + len) break;
      frames.push(merged.slice(i + FRAME_HEADER_BYTES, i + FRAME_HEADER_BYTES + len));
      i += FRAME_HEADER_BYTES + len;
    }
    this.buf = merged.slice(i);
    return frames;
  }

  reset(): void {
    this.buf = new Uint8Array(0);
  }
}
