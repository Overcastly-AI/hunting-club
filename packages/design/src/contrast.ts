/**
 * WCAG 2 contrast, used by tests to hold every text/background pair the app and web
 * draws to docs/SPEC.md "Accessibility" (4.5:1, including map labels on their halo).
 */
export const MIN_TEXT_CONTRAST = 4.5;

/** Body and second-line text in the daylight theme, on every surface (glare; WCAG AAA). */
export const MIN_DAYLIGHT_BODY_CONTRAST = 7;

/** WCAG 2.2 non-text contrast (1.4.11): control outlines against what is next to them. */
export const MIN_UI_CONTRAST = 3;

function channels(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Expected #RRGGBB, got ${hex}`);
  return [match[1]!, match[2]!, match[3]!].map((h) => parseInt(h, 16) / 255) as [
    number,
    number,
    number,
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const [hi, lo] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** The colour seen when `foreground` is drawn at `alpha` opacity over `background`. */
export function blendOver(foreground: string, background: string, alpha: number): string {
  const f = channels(foreground);
  const b = channels(background);
  return `#${f
    .map((v, i) =>
      Math.round((v * alpha + b[i]! * (1 - alpha)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
