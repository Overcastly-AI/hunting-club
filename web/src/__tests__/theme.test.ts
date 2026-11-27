import { APP_DESCRIPTION, APP_NAME } from '@huntclub/shared/app';
import { siteHeadTags } from '../../site-head';
import {
  MIN_TEXT_CONTRAST,
  MIN_UI_CONTRAST,
  colors,
  contrastRatio,
  FAVICON_SVG,
  fontSize,
  logoMarkSvg,
  mapPlanColors,
  sizes,
  textScale,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  themeBootstrapJs,
  themeCss,
  themes,
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
    expect(Object.keys(vars).filter((k) => k.startsWith('--color-'))).toHaveLength(
      Object.keys(colors).length + Object.keys(mapPlanColors).length,
    );
    expect(vars['--color-map-ground']).toBe(mapPlanColors.mapGround);
  });

  it('keeps tap targets at 48 px and primary buttons at the spec height', () => {
    expect(tokenVariables()['--tap-min']).toBe(`${sizes.minTapTarget}px`);
    expect(sizes.minTapTarget).toBe(48);
    const css = globalCss();
    expect(css).toMatch(/\.ui-button--md \{ min-height: 52px/);
    expect(css).toMatch(/\.shell-nav__item \{[^}]*min-height: var\(--tap-min\)/);
    expect(css).toMatch(/\.ui-input, \.ui-select, \.ui-textarea \{[^}]*min-height: 52px/);
    expect(css).toMatch(/\.row-link \{[^}]*min-height: var\(--tap-min\)/);
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

  it('outlines inputs at 3:1 or better in both themes, and focuses them in the focus colour', () => {
    for (const theme of Object.values(themes)) {
      for (const bg of ['canvas', 'plate'] as const) {
        for (const edge of ['borderControl', 'focusRing'] as const) {
          expect(contrastRatio(theme.colors[edge], theme.colors[bg])).toBeGreaterThanOrEqual(
            MIN_UI_CONTRAST,
          );
        }
      }
    }
    const css = globalCss();
    expect(css).toMatch(
      /\.ui-input, \.ui-select, \.ui-textarea \{[^}]*border: var\(--control-border\) solid var\(--theme-border-control\)/,
    );
    expect(css).toMatch(
      /\.ui-input:focus, [^{]*\{[^}]*border-color: var\(--theme-focus-ring\);[^}]*var\(--theme-focus-ring\)/,
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
    const palette = { ...colors, ...mapPlanColors };
    const pairs: [keyof typeof palette, keyof typeof palette][] = [
      ['text', 'surface'],
      ['textSecondary', 'surface'],
      ['text', 'surfaceRaised'],
      ['textSecondary', 'surfaceRaised'],
      ['accent', 'surfaceRaised'], // active nav item
      ['surface', 'accent'], // primary button label
      ['alert', 'surface'], // error messages
      ['alert', 'surfaceRaised'], // errors inside the sign-in card and panels
      ['surface', 'text'], // QR modules on their light background
      ['text', 'mapHalo'], // map labels over their halo
      ['text', 'mapGround'], // map labels on the club plan's ground
    ];
    for (const [fg, bg] of pairs) {
      expect(contrastRatio(palette[fg], palette[bg])).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
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
