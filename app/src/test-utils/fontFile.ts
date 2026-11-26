import { readFileSync } from 'node:fs';

export type FontAxis = { tag: string; min: number; default: number; max: number };

/** Reads the variation axes (`fvar` table) and typographic family name of a TrueType font. */
export function readFontFile(path: string): { axes: FontAxis[]; family: string | undefined } {
  const data = readFileSync(path);
  const tables = new Map<string, number>();
  const tableCount = data.readUInt16BE(4);
  for (let i = 0; i < tableCount; i++) {
    const record = 12 + 16 * i;
    tables.set(data.toString('ascii', record, record + 4), data.readUInt32BE(record + 8));
  }

  const fixed = (offset: number) => data.readInt32BE(offset) / 65536;
  const axes: FontAxis[] = [];
  const fvar = tables.get('fvar');
  if (fvar !== undefined) {
    const axesStart = fvar + data.readUInt16BE(fvar + 4);
    const axisCount = data.readUInt16BE(fvar + 8);
    const axisSize = data.readUInt16BE(fvar + 10);
    for (let i = 0; i < axisCount; i++) {
      const axis = axesStart + axisSize * i;
      axes.push({
        tag: data.toString('ascii', axis, axis + 4),
        min: fixed(axis + 4),
        default: fixed(axis + 8),
        max: fixed(axis + 12),
      });
    }
  }

  return { axes, family: readName(data, tables.get('name'), 16) };
}

/** Windows-platform (UTF-16BE) entry of the `name` table. */
function readName(data: Buffer, table: number | undefined, nameId: number): string | undefined {
  if (table === undefined) return undefined;
  const count = data.readUInt16BE(table + 2);
  const strings = table + data.readUInt16BE(table + 4);
  for (let i = 0; i < count; i++) {
    const record = table + 6 + 12 * i;
    if (data.readUInt16BE(record) === 3 && data.readUInt16BE(record + 6) === nameId) {
      const start = strings + data.readUInt16BE(record + 10);
      return data
        .subarray(start, start + data.readUInt16BE(record + 8))
        .swap16()
        .toString('utf16le');
    }
  }
  return undefined;
}
