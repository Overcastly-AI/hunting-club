import axe from 'axe-core';

/**
 * axe-core violations inside `node`, as "rule: targets" lines. Colour contrast needs layout
 * (jsdom has none): the token contrast test in packages/design and the kit page run in a
 * browser cover it. `region` is off because a component is checked outside a page.
 */
export async function axeViolations(node: Element): Promise<string[]> {
  const result = await axe.run(node, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return result.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}
