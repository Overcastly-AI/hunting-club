// Open Graph cards: a page's headline and description on the dark surface with the logo
// mark, as SVG from the design tokens, rendered to PNG with resvg at build time (Node).
import { colors, logoMarkSvg } from '@huntclub/design';
import { APP_NAME } from '@huntclub/shared';
import { svgToPng } from '@huntclub/design/png';
import { OG_IMAGE } from './routes';

/**
 * The font the cards use: the app's Archivo TTF (resvg reads TTF, not the web's woff2).
 * Relative to the repo root.
 */
export const OG_FONT_FILE = 'app/assets/fonts/Archivo-Variable.ttf';

const PAD = 80;
const HEADLINE = { size: 64, lineHeight: 74, maxChars: 30, maxLines: 3 };
const SUBLINE = { size: 30, lineHeight: 42, maxChars: 62, maxLines: 3 };

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy word wrap to at most `maxLines` lines of about `maxChars`; overflow ends in "…". */
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= maxChars) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/[\s.,;:]+$/, '')}…`;
  return kept;
}

const textLines = (lines: string[], x: number, y: number, lineHeight: number) =>
  lines
    .map((line, i) => `<tspan x="${x}" y="${y + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join('');

/** A card as SVG (colors from the tokens only). */
export function ogImageSvg(card: { headline: string; subline: string }): string {
  const { width, height } = OG_IMAGE;
  const headline = wrapText(card.headline, HEADLINE.maxChars, HEADLINE.maxLines);
  const subline = wrapText(card.subline, SUBLINE.maxChars, SUBLINE.maxLines);
  const headlineY = 260;
  const sublineY = headlineY + headline.length * HEADLINE.lineHeight + 24;
  const mark = logoMarkSvg().replace(
    '<svg ',
    `<svg x="${PAD}" y="${PAD - 8}" width="72" height="72" `,
  );
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${colors.surface}"/>`,
    mark,
    `<text x="${PAD + 96}" y="${PAD + 40}" font-family="Archivo" font-size="36" fill="${colors.text}">${escapeXml(APP_NAME)}</text>`,
    `<text font-family="Archivo" font-size="${HEADLINE.size}" fill="${colors.text}">${textLines(headline, PAD, headlineY, HEADLINE.lineHeight)}</text>`,
    `<text font-family="Archivo" font-size="${SUBLINE.size}" fill="${colors.textSecondary}">${textLines(subline, PAD, sublineY, SUBLINE.lineHeight)}</text>`,
    `<rect y="${height - 16}" width="${width}" height="16" fill="${colors.accent}"/>`,
    '</svg>',
  ].join('');
}

/** An SVG (a card or the logo mark) as PNG, `width` pixels wide, with Archivo for text. */
export const renderPng = (svg: string, fontFile: string, width?: number) =>
  svgToPng(svg, {
    fontFiles: [fontFile],
    defaultFontFamily: 'Archivo',
    ...(width ? { width } : {}),
  });
