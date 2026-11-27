import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { fontSize, sizes } from '../theme';
import { SRC, sourceFiles } from '../test-utils/sourceFiles';

const tsxFiles = (dir: string) => sourceFiles(dir, /\.tsx$/);

/** The props of a JSX opening tag starting at `start`: up to the first `>` outside braces that isn't `=>`. */
function openingTag(source: string, start: number): string {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0 && source[i - 1] !== '=') return source.slice(start, i);
  }
  throw new Error('Unterminated JSX tag');
}

/** Opening tags of every <Pressable> in the app source. */
function pressableTags(): { file: string; tag: string }[] {
  return tsxFiles(SRC).flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return [...source.matchAll(/<Pressable\b/g)].map((m) => ({
      file: relative(SRC, file),
      tag: openingTag(source, m.index),
    }));
  });
}

describe('accessibility rules from docs/SPEC.md', () => {
  it('finds the pressables it checks', () => {
    expect(pressableTags().length).toBeGreaterThan(5);
  });

  it('gives every pressable a role and a spoken label (or hides it from screen readers)', () => {
    const missing = pressableTags()
      .filter(({ tag }) => !/importantForAccessibility="no"/.test(tag))
      .filter(({ tag }) => !/accessibilityRole=/.test(tag) || !/accessibilityLabel=/.test(tag))
      .map(({ file }) => file);
    expect(missing).toEqual([]);
  });

  it('keeps tap targets at 48 px or more', () => {
    for (const size of [sizes.control, sizes.primaryButtonMinHeight]) {
      expect(size).toBeGreaterThanOrEqual(sizes.minTapTarget);
    }
    expect(sizes.minTapTarget).toBe(48);
  });

  it('keeps map text at 13 px and body text at 16 px or more', () => {
    expect(fontSize.mapLabelMin).toBeGreaterThanOrEqual(13);
    expect(fontSize.body).toBeGreaterThanOrEqual(16);
  });

  it('never truncates sunrise/sunset times or tab labels', () => {
    const files = ['map/components/ReadoutStrip.tsx', 'app/(tabs)/_layout.tsx'];
    for (const file of files) {
      const source = readFileSync(join(SRC, file), 'utf8');
      expect({ file, singleLine: /numberOfLines=\{1\}/.test(source) }).toEqual({
        file,
        singleLine: false,
      });
      expect({ file, shrinks: /adjustsFontSizeToFit/.test(source) }).toEqual({
        file,
        shrinks: false,
      });
    }
  });

  it('lets text wrap and grow on every screen outside the map (names, times, places)', () => {
    // Map labels are one line by design (they sit on markers); the tab bar caps
    // its labels at TAB_LABEL_MAX_LINES (checked above). Everything else wraps.
    const allowed = new Set([join(SRC, 'app/(tabs)/_layout.tsx')]);
    const offenders = tsxFiles(SRC)
      .filter((file) => !file.startsWith(join(SRC, 'map')) && !allowed.has(file))
      .flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        return [
          /numberOfLines=/.test(source) && 'cuts text to a number of lines',
          /adjustsFontSizeToFit/.test(source) && 'shrinks text to fit',
          /allowFontScaling=\{false\}/.test(source) && 'ignores the text size setting',
          /maxFontSizeMultiplier=/.test(source) && 'caps the text size',
        ]
          .filter(Boolean)
          .map((problem) => `${relative(SRC, file)} ${problem}`);
      });
    expect(offenders).toEqual([]);
  });

  it('sets clubhouse board text at 24 px or more, readable from across a room', () => {
    for (const size of [fontSize.boardDetail, fontSize.boardName, fontSize.boardTitle]) {
      expect(size).toBeGreaterThanOrEqual(24);
    }
  });
});
