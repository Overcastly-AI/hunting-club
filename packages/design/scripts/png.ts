/**
 * SVG to PNG with resvg: the one renderer for the app icons, favicon.ico (./icons.ts) and
 * the public site's Open Graph cards and logo. Node only, at build or script time.
 */
import { Resvg } from '@resvg/resvg-js';

export interface PngOptions {
  /** Output width in pixels (height follows the SVG's aspect ratio); default: the SVG's. */
  width?: number;
  /** Font files (TTF/OTF) for `<text>`; no system fonts are used. */
  fontFiles?: readonly string[];
  /** Family for `<text>` that names none. */
  defaultFontFamily?: string;
}

export function svgToPng(svg: string, options: PngOptions = {}): Buffer {
  const { width, fontFiles = [], defaultFontFamily } = options;
  return Buffer.from(
    new Resvg(svg, {
      font: {
        fontFiles: [...fontFiles],
        loadSystemFonts: false,
        ...(defaultFontFamily ? { defaultFontFamily } : {}),
      },
      ...(width ? { fitTo: { mode: 'width' as const, value: width } } : {}),
    })
      .render()
      .asPng(),
  );
}
