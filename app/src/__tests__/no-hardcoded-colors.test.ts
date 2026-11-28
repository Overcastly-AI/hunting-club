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

  it('takes colours from the theme hook, except the map’s own symbols and labels', () => {
    // Map labels and their halo, your dot and scent cone, the help pin, the basemap background
    // and the QR code keep fixed colours in both themes. Hunter and stand markers are drawn
    // like the chrome (plate, ink, the freshness ring), so they follow the theme like
    // everything else, through useTheme() or makeStyles().
    const STATIC_COLOR_FILES = [
      'components/QrCode.tsx',
      'map/basemaps.ts',
      'map/components/AreasLayer.tsx',
      'map/components/HaloText.tsx',
      'map/components/ScaleBar.tsx',
      'map/components/YouMarker.tsx',
      'safety/components/HelpMarker.tsx',
    ];
    const importers = sourceFiles(SRC, /\.tsx?$/, ALLOWED_DIRS)
      .filter((file) =>
        /import \{[^}]*\bcolors\b[^}]*\} from '[./]*theme'/.test(readFileSync(file, 'utf8')),
      )
      .map((file) => relative(SRC, file))
      .sort();
    expect(importers).toEqual(STATIC_COLOR_FILES);
  });

  it('never fades a disabled control (faded text drops under 4.5:1 in the light theme)', () => {
    const offenders = sourceFiles(SRC, /\.tsx$/)
      .filter((file) => /disabled\)?\s*&&\s*\{\s*opacity/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});
