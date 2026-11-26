import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..');
const ALLOWED_DIRS = [join(SRC, 'theme')];
const COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === '__tests__' || ALLOWED_DIRS.includes(path)) return [];
      return sourceFiles(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('theme usage', () => {
  it('has no hard-coded colors outside src/theme', () => {
    const offenders = sourceFiles(SRC).filter((file) =>
      COLOR_PATTERN.test(readFileSync(file, 'utf8')),
    );
    expect(offenders.map((file) => relative(SRC, file))).toEqual([]);
  });
});
