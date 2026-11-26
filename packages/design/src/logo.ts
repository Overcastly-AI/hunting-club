import { colors } from './colors';

/**
 * The Hunt Club Mesh mark: three radios linked in a mesh, the top one (you) in accent,
 * on the surface color. One source for the web favicon and the sign-in logo; colors come
 * from the tokens, so the mark follows any token change.
 */
interface Node {
  x: number;
  y: number;
  fill: string;
}

export function logoMarkSvg(): string {
  const top: Node = { x: 32, y: 17, fill: colors.accent };
  const left: Node = { x: 17, y: 45, fill: colors.text };
  const right: Node = { x: 47, y: 45, fill: colors.text };
  const nodes = [top, left, right];
  const link = (a: Node, b: Node) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    `<rect width="64" height="64" rx="14" fill="${colors.surface}" />`,
    `<g stroke="${colors.textSecondary}" stroke-width="4" stroke-linecap="round">`,
    link(top, left),
    link(left, right),
    link(right, top),
    '</g>',
    ...nodes.map((n) => `<circle cx="${n.x}" cy="${n.y}" r="7" fill="${n.fill}" />`),
    '</svg>',
  ].join('');
}
