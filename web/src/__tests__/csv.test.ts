import { toCsv } from '../csv';

describe('CSV export', () => {
  it('quotes commas, quotes and line breaks, with CRLF rows', () => {
    expect(
      toCsv([
        ['a', 'b,c'],
        ['say "hi"', 'two\nlines'],
      ]),
    ).toBe('a,"b,c"\r\n"say ""hi""","two\nlines"\r\n');
  });

  it('keeps spreadsheet formulas from running', () => {
    expect(toCsv([['=SUM(A1)', '+1', '-2', '@cmd', 'ok']])).toBe("'=SUM(A1),'+1,'-2,'@cmd,ok\r\n");
  });
});
