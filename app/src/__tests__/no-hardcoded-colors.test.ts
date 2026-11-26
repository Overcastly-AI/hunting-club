import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { SRC, sourceFiles } from '../test-utils/sourceFiles';

const ALLOWED_DIRS = [join(SRC, 'theme')];
const COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

describe('theme usage', () => {
  it('has no hard-coded colors outside src/theme', () => {
    const offenders = sourceFiles(SRC, /\.tsx?$/, ALLOWED_DIRS).filter((file) =>
      COLOR_PATTERN.test(readFileSync(file, 'utf8')),
    );
    expect(offenders.map((file) => relative(SRC, file))).toEqual([]);
  });
});
