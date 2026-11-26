import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The app's `src` directory. */
export const SRC = join(__dirname, '..');

/**
 * Source files under `dir` whose names match `pattern`, skipping `__tests__`
 * folders and any directory listed in `skipDirs`.
 */
export function sourceFiles(
  dir: string,
  pattern: RegExp,
  skipDirs: readonly string[] = [],
): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === '__tests__' || skipDirs.includes(path)) return [];
      return sourceFiles(path, pattern, skipDirs);
    }
    return pattern.test(name) ? [path] : [];
  });
}
