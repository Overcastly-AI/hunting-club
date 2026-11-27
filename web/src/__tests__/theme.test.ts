import { APP_DESCRIPTION, APP_NAME } from '@huntclub/shared/app';
import { siteHeadTags } from '../../site-head';
import {
  MIN_TEXT_CONTRAST,
  MIN_UI_CONTRAST,
  colors,
  contrastRatio,
  FAVICON_SVG,
  fontSize,
  lightColors,
  logoMarkSvg,
  sizes,
  textScale,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  themeBootstrapJs,
  themeCss,
} from '@huntclub/design';
import type { Plugin } from 'vite';
import { themeBootstrap, themeBootstrapFileName } from '../../theme-bootstrap';
import { globalCss, textStyleCss, tokenVariables } from '../theme/css';

describe('web theme from @huntclub/design', () => {
  it('exposes every color token as a CSS variable with the same value', () => {
    const vars = tokenVariables();
    expect(vars['--color-surface']).toBe(colors.surface);
    expect(vars['--color-surface-raised']).toBe(colors.surfaceRaised);
    expect(vars['--color-accent']).toBe(colors.accent);
    expect(vars['--color-bg-light']).toBe(lightColors.bgLight);
    expect(Object.keys(vars).filter((k) => k.startsWith('--color-'))).toHaveLength(
      Object.keys(colors).length + Object.keys(lightColors).length,
    );
  });

  it('keeps tap targets at 48 px and primary buttons at the spec height', () => {
    expect(tokenVariables()['--tap-min']).toBe(`${sizes.minTapTarget}px`);
    expect(sizes.minTapTarget).toBe(48);
    const css = globalCss();
    expect(css).toMatch(/\.button \{[^}]*min-height: var\(--tap-min\)/);
    expect(css).toMatch(/\.nav a \{[^}]*min-height: var\(--tap-min\)/);
    expect(css).toMatch(/\.field input \{[^}]*min-height: var\(--tap-min\)/);
  });

  it('sets body text at 16 px or more in Archivo with the shared axes', () => {
    expect(textStyleCss(textScale.body)).toBe(
      `font-family: 'Archivo', sans-serif; font-weight: 450; font-stretch: 100%; font-size: ${fontSize.body / 16}rem; line-height: ${24 / 16}rem`,
    );
    // rem, so text follows the reader's browser text size; 1rem is 16 px by default.
    expect(fontSize.body / 16).toBeGreaterThanOrEqual(1);
    expect(textStyleCss(textScale.sheetTitle)).toContain('font-stretch: 88%');
    expect(fontSize.body).toBeGreaterThanOrEqual(16);
  });

  it('outlines inputs at 3:1 or better against both surfaces, and focuses them in accent', () => {
    for (const bg of ['surface', 'surfaceRaised'] as const) {
      for (const edge of ['controlBorder', 'accent'] as const) {
        expect(contrastRatio(colors[edge], colors[bg])).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
      }
    }
    const css = globalCss();
    expect(css).toContain('border: 1px solid var(--color-control-border)');
    expect(css).toMatch(
      /\.field input:focus \{[^}]*border-color: var\(--color-accent\);[^}]*inset 0 0 0 1px var\(--color-accent\)/,
    );
  });

  it('loads Archivo as WOFF2 with font-display swap', () => {
    expect(globalCss()).toMatch(/src: url\('[^']*Archivo-Latin[^']*\.woff2'\) format\('woff2'\)/);
    expect(globalCss()).toContain('font-display: swap');
  });

  it('never uses all-caps or letter-spaced labels', () => {
    expect(globalCss()).not.toMatch(/text-transform:\s*uppercase|letter-spacing/);
  });

  it('only pairs text and backgrounds at 4.5:1 or better', () => {
    const pairs: [keyof typeof colors, keyof typeof colors][] = [
      ['text', 'surface'],
      ['textSecondary', 'surface'],
      ['text', 'surfaceRaised'],
      ['textSecondary', 'surfaceRaised'],
      ['accent', 'surfaceRaised'], // active nav item
      ['surface', 'accent'], // primary button label
      ['alert', 'surface'], // error messages
      ['alert', 'surfaceRaised'], // errors inside the sign-in card and panels
      ['surface', 'text'], // QR modules on their light background
      ['textSecondary', 'mapHalo'], // sign-in footer links over the dawn scene's silhouettes
    ];
    for (const [fg, bg] of pairs) {
      expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });
});

describe('page head and favicon', () => {
  it('take the name, description and theme color from the shared sources', () => {
    const attrs = siteHeadTags().map((t) => ('attrs' in t ? t.attrs : { title: t.children }));
    expect(attrs).toContainEqual({ title: APP_NAME });
    expect(attrs).toContainEqual({ name: 'description', content: APP_DESCRIPTION });
    expect(attrs).toContainEqual({ name: 'theme-color', content: colors.surface });
    expect(attrs).toContainEqual({ name: 'color-scheme', content: 'dark light' });
    expect(attrs).toContainEqual(expect.objectContaining({ rel: 'icon', href: `/${FAVICON_SVG}` }));
  });

  it('draws the logo only in token colors', () => {
    const used = logoMarkSvg().match(/#[0-9A-Fa-f]{6}/g) ?? [];
    expect(used.length).toBeGreaterThan(0);
    for (const color of used) expect(Object.values(colors)).toContain(color);
  });
});

describe('dark and light themes', () => {
  it('ships the generated theme CSS in the stylesheet', () => {
    expect(globalCss()).toContain(themeCss());
  });

  /** One of the plugin's hooks as the plain function it is here. */
  const hook = (plugin: Plugin, name: keyof Plugin) =>
    plugin[name] as unknown as (...args: unknown[]) => unknown;

  it('loads the theme bootstrap from its own fingerprinted file, not an inline script', () => {
    const plugin = themeBootstrap();
    hook(plugin, 'configResolved')({ base: '/app/', command: 'build' });
    const emitted: unknown[] = [];
    hook(plugin, 'generateBundle').call({ emitFile: (f: unknown) => emitted.push(f) });
    const file = themeBootstrapFileName();
    expect(file).toMatch(/^assets\/theme-[0-9a-f]{10}\.js$/);
    expect(emitted).toEqual([{ type: 'asset', fileName: file, source: themeBootstrapJs() }]);
    expect(hook(plugin, 'transformIndexHtml')()).toEqual([
      { tag: 'script', attrs: { src: `/app/${file}` }, injectTo: 'head' },
    ]);
  });

  it('sets data-theme from the stored choice before the app runs', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    new Function(themeBootstrapJs())();
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  });
});
