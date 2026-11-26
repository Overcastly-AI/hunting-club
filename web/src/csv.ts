/**
 * CSV for spreadsheet apps (RFC 4180 quoting). Cells that a spreadsheet would run as a
 * formula (starting with = + - @, tab or carriage return) get a leading apostrophe.
 */
export function toCsv(rows: readonly (readonly string[])[]): string {
  const cell = (value: string) => {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return `${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
}
