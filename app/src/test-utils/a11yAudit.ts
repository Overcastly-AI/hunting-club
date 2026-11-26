import { PixelRatio, StyleSheet } from 'react-native';
import type { TestInstance } from 'test-renderer';

import { sizes } from '../theme';

/**
 * Rendered-screen accessibility checks (docs/SPEC.md, Accessibility), used by
 * the screen tests at the largest text size we support. Jest has no layout, so
 * this checks what decides whether a screen survives 200 % text: nothing that
 * can be tapped is smaller than 48 px or unlabelled, and no text is clipped,
 * cut short or kept from growing.
 */

/** The largest system text size the screens must handle (iOS and Android "200 %"). */
export const LARGE_FONT_SCALE = 2;

/** Renders as if the phone's text size were set to LARGE_FONT_SCALE. */
export function setLargeText(): void {
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(LARGE_FONT_SCALE);
}

const TAPPABLE_ROLES = new Set(['button', 'link', 'radio', 'tab', 'checkbox', 'switch']);

const styleOf = (node: TestInstance) =>
  (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;

/** Hidden from screen readers (decorative, or a second way to do something labelled elsewhere). */
const hidden = (node: TestInstance) =>
  node.props.importantForAccessibility === 'no' || node.props.accessibilityElementsHidden === true;

const describeNode = (node: TestInstance) =>
  `${node.type}${node.props.accessibilityLabel ? ` "${node.props.accessibilityLabel}"` : ''}`;

/** A fixed height or max height above this text: enlarged text would be clipped. */
function fixedHeightAbove(node: TestInstance): TestInstance | undefined {
  for (let up = node.parent; up; up = up.parent) {
    const style = styleOf(up);
    if (typeof style.height === 'number' || typeof style.maxHeight === 'number') return up;
  }
  return undefined;
}

function textProblems(node: TestInstance): string[] {
  const { props } = node;
  const text = `Text "${[props.children].flat().join('')}"`;
  const problems: string[] = [];
  if (props.numberOfLines !== undefined)
    problems.push(`${text} is cut to ${props.numberOfLines} line(s)`);
  if (props.adjustsFontSizeToFit) problems.push(`${text} shrinks to fit`);
  if (props.allowFontScaling === false) problems.push(`${text} ignores the text size setting`);
  if (
    typeof props.maxFontSizeMultiplier === 'number' &&
    props.maxFontSizeMultiplier < LARGE_FONT_SCALE
  ) {
    problems.push(`${text} stops growing at ${props.maxFontSizeMultiplier}×`);
  }
  const box = fixedHeightAbove(node);
  if (box) problems.push(`${text} sits in a fixed-height ${box.type}`);
  return problems;
}

function tappableProblems(node: TestInstance): string[] {
  const style = styleOf(node);
  const problems: string[] = [];
  if (!node.props.accessibilityLabel) problems.push(`${describeNode(node)} has no spoken label`);
  const height = Math.max(Number(style.minHeight ?? 0), Number(style.height ?? 0));
  if (height < sizes.minTapTarget) {
    problems.push(`${describeNode(node)} is ${height} px tall (min ${sizes.minTapTarget})`);
  }
  const width = style.width ?? style.minWidth;
  if (typeof width === 'number' && width < sizes.minTapTarget) {
    problems.push(`${describeNode(node)} is ${width} px wide (min ${sizes.minTapTarget})`);
  }
  return problems;
}

/** Everything on the rendered screen that breaks the accessibility rules; empty when it passes. */
export function a11yProblems(container: TestInstance): string[] {
  return container
    .queryAll(() => true)
    .filter((node) => !hidden(node))
    .flatMap((node) => {
      if (node.type === 'Text') return textProblems(node);
      if (node.type === 'TextInput' && !node.props.accessibilityLabel) {
        return [`TextInput "${node.props.placeholder ?? ''}" has no spoken label`];
      }
      if (TAPPABLE_ROLES.has(node.props.accessibilityRole)) return tappableProblems(node);
      return [];
    });
}
