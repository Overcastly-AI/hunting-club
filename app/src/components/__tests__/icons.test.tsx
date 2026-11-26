import { darkTheme } from '@huntclub/design';
import { STAND_TYPES } from '@huntclub/shared';
import { render, screen } from '@testing-library/react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import { sizes } from '../../theme';
import {
  LayersIcon,
  LocateIcon,
  NorthIcon,
  STAND_TYPE_ICONS,
  StandTypeIcon,
  WindArrowIcon,
} from '../icons';

type Node = ReactTestRendererJSON;

/** The Lucide Svg roots rendered (each carries `className="lucide lucide-<name>"`). */
function drawnIcons(): Node[] {
  const json = screen.toJSON() as Node | Node[] | null;
  const found: Node[] = [];
  const visit = (node: Node | string) => {
    if (typeof node === 'string') return;
    if (String(node.props.className ?? '').startsWith('lucide ')) found.push(node);
    else node.children?.forEach(visit);
  };
  (json === null ? [] : Array.isArray(json) ? json : [json]).forEach(visit);
  return found;
}

describe('icons (Lucide)', () => {
  it('has a distinct icon for every stand type', () => {
    const icons = STAND_TYPES.map((type) => STAND_TYPE_ICONS[type].displayName);
    expect(icons).toEqual(['TreePine', 'ArrowUpFromLine', 'Tent']);
  });

  it('draws control icons in the theme text colour at the icon size, hidden from screen readers', async () => {
    await render(
      <>
        <LayersIcon />
        <NorthIcon />
        <LocateIcon />
        <StandTypeIcon type="ladder" />
      </>,
    );
    const icons = drawnIcons();
    expect(icons.map((n) => n.props.className)).toEqual([
      'lucide lucide-layers lucide-layers-3',
      'lucide lucide-navigation-2',
      'lucide lucide-locate-fixed',
      'lucide lucide-arrow-up-from-line',
    ]);
    for (const icon of icons) {
      expect(icon.props).toMatchObject({
        stroke: darkTheme.colors.text,
        width: sizes.icon,
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      });
    }
  });

  it('turns the wind arrow toward where the wind blows, in the wind colour', async () => {
    await render(<WindArrowIcon towardDeg={90} />);
    const [arrow] = drawnIcons();
    expect(arrow!.props.stroke).toBe(darkTheme.colors.info);
    expect(arrow!.props.transform).toEqual([{ rotate: '90deg' }]);
  });
});
