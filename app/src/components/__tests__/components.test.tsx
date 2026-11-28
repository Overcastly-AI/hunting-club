import { darkTheme, lightTheme, mapChrome, type Theme } from '@huntclub/design';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Hand, Users } from 'lucide-react-native';
import { AccessibilityInfo, Platform, StyleSheet, Text } from 'react-native';

import { migrate } from '../../db/migrate';
import { migrations } from '../../db/migrations';
import { saveThemePreference } from '../../db/appState';
import { a11yProblems, setLargeText } from '../../test-utils/a11yAudit';
import { createTestDatabase } from '../../test-utils/nodeSqlite';
import { BUTTON_HEIGHT, STATUS_TONE_COLORS, ThemeProvider } from '../../theme';
import { Badge } from '../Badge';
import { Banner } from '../Banner';
import { BUTTON_VARIANTS, Button } from '../Button';
import { Card } from '../Card';
import { Choice } from '../Choice';
import { EmptyState } from '../EmptyState';
import { Field } from '../Field';

const flat = (style: unknown) =>
  (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
const button = (name: string) => screen.getByRole('button', { name });

/** Renders inside a ThemeProvider forced to one theme. */
async function renderIn(theme: Theme, ui: React.ReactElement) {
  const db = createTestDatabase();
  await migrate(db, migrations);
  await saveThemePreference(db, theme.colorScheme);
  const view = await render(<ThemeProvider db={db}>{ui}</ThemeProvider>);
  await screen.findAllByText(/./);
  return view;
}

describe('Button', () => {
  it('has the web kit variants plus help for Ask for a Hand', () => {
    expect(BUTTON_VARIANTS).toEqual(['primary', 'secondary', 'tertiary', 'danger', 'help']);
  });

  it.each([
    ['md', BUTTON_HEIGHT.md],
    ['lg', BUTTON_HEIGHT.lg],
    ['sheet', mapChrome.sheet.actionRow],
  ] as const)('is %s: %i px tall', async (size, height) => {
    await render(<Button size={size} label="Go" onPress={jest.fn()} />);
    expect(flat(button('Go').props.style).minHeight).toBe(height);
  });

  it('is a square of its height with the icon only, the label and detail still spoken', async () => {
    await render(
      <Button
        size="sheet"
        iconOnly
        icon={Hand}
        variant="help"
        label="Ask for a Hand"
        detail="Pings your party"
        onPress={jest.fn()}
      />,
    );
    const style = flat(button('Ask for a Hand. Pings your party').props.style);
    expect([style.width, style.height]).toEqual([56, 56]);
    expect(screen.queryByText('Ask for a Hand')).toBeNull();
  });

  it('speaks the label and detail together, and presses', async () => {
    const onPress = jest.fn();
    await render(
      <Button label="Ask for a Hand" detail="Pings your party" variant="help" onPress={onPress} />,
    );
    await fireEvent.press(button('Ask for a Hand. Pings your party'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each([darkTheme, lightTheme])(
    'draws disabled with its own colours, not a fade ($colorScheme)',
    async (theme) => {
      await renderIn(theme, <Button variant="primary" label="Send" disabled onPress={jest.fn()} />);
      const style = flat(button('Send').props.style);
      expect(style.opacity).toBeUndefined();
      expect(style.backgroundColor).toBe(theme.colors.raised);
      expect(flat(screen.getByText('Send').props.style).color).toBe(theme.colors.textTertiary);
      expect(button('Send')).toBeDisabled();
    },
  );

  it('shows a spinner while loading, ignores presses and says it is busy', async () => {
    const onPress = jest.fn();
    await render(<Button label="Updating…" loading onPress={onPress} />);
    expect(button('Updating…').props.accessibilityState).toMatchObject({ busy: true });
    await fireEvent.press(button('Updating…'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('never draws Ask for a Hand in red', async () => {
    await render(<Button variant="help" label="Ask for a Hand" onPress={jest.fn()} />);
    const style = flat(button('Ask for a Hand').props.style);
    expect(style.borderColor).toBe(darkTheme.colors.warning);
    expect([style.backgroundColor, style.borderColor]).not.toContain(darkTheme.colors.danger);
  });
});

describe('Field', () => {
  it('shows the label, speaks it on the input and gives the hint', async () => {
    await render(<Field label="Name this spot (optional)" hint="Up to 24 letters" />);
    expect(screen.getByLabelText('Name this spot (optional)').props.accessibilityHint).toBe(
      'Up to 24 letters',
    );
    expect(screen.getByText('Up to 24 letters')).toBeTruthy();
  });

  it('turns the edge red with an icon and announces the error', async () => {
    await render(<Field label="Email" error="Check the email address" />);
    const input = screen.getByLabelText('Email');
    expect(flat(input.props.style).borderColor).toBe(darkTheme.colors.danger);
    expect(input.props.accessibilityHint).toBe('Check the email address');
    expect(screen.getByText('Check the email address')).toBeTruthy();
  });

  it('gets a 2 px accent edge while focused', async () => {
    await render(<Field label="Email" />);
    const input = screen.getByLabelText('Email');
    await fireEvent(input, 'focus');
    expect(flat(screen.getByLabelText('Email').props.style)).toMatchObject({
      borderColor: darkTheme.colors.accent,
      borderWidth: 2,
    });
  });

  it('can hide the drawn label but keeps it spoken', async () => {
    await render(<Field label="Message" hideLabel placeholder="Message" />);
    expect(screen.queryByText('Message')).toBeNull();
    expect(screen.getByLabelText('Message')).toBeTruthy();
  });
});

describe('Badge, Banner, EmptyState and Card', () => {
  it.each(Object.keys(STATUS_TONE_COLORS) as (keyof typeof STATUS_TONE_COLORS)[])(
    'badge in %s: a word in the tone colour on its tint',
    async (tone) => {
      await render(<Badge tone={tone} label="Active" />);
      expect(flat(screen.getByLabelText('Active').props.style).backgroundColor).toBe(
        darkTheme.colors[STATUS_TONE_COLORS[tone].background],
      );
      expect(flat(screen.getByText('Active').props.style).color).toBe(
        darkTheme.colors[STATUS_TONE_COLORS[tone].foreground],
      );
    },
  );

  it('banner reads its title and text as one, and can announce itself', async () => {
    await render(
      <Banner tone="warning" title="Not sent" live>
        Your radio didn’t take the message.
      </Banner>,
    );
    const banner = screen.getByLabelText('Not sent. Your radio didn’t take the message.');
    // Android reads the live region; iOS has none, so the banner announces itself there.
    expect(banner.props.accessibilityLiveRegion).toBe('polite');
  });

  it('announces live banners and field errors on iOS, where there are no live regions', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    expect(Platform.OS).toBe('ios');
    announce.mockClear();
    await render(
      <>
        <Banner tone="warning" live>
          Not sent.
        </Banner>
        <Field label="Code" error="That code didn’t work" />
      </>,
    );
    expect(announce.mock.calls.map(([m]) => m)).toEqual(['Not sent.', 'That code didn’t work']);
    announce.mockRestore();
  });

  it('empty state has an icon, a title, a body and one action', async () => {
    await render(
      <EmptyState
        icon={Users}
        title="Nobody to message yet"
        action={<Button label="Pair a radio" onPress={jest.fn()} />}
      >
        People appear once your radio hears them.
      </EmptyState>,
    );
    expect(
      screen.getByLabelText('Nobody to message yet. People appear once your radio hears them.'),
    ).toBeTruthy();
    expect(button('Pair a radio')).toBeTruthy();
  });

  it('card has a heading and a subtle edge', async () => {
    await render(
      <Card title="My harvests">
        <Text>Body</Text>
      </Card>,
    );
    expect(screen.getByRole('header', { name: 'My harvests' })).toBeTruthy();
  });
});

describe('Choice', () => {
  it.each([darkTheme, lightTheme])(
    'disabled is tertiary text on its own fill, never faded ($colorScheme)',
    async (theme) => {
      await renderIn(
        theme,
        <Choice
          label="Creek stand"
          detail="Cody is here"
          selected={false}
          disabled
          onPress={jest.fn()}
        />,
      );
      const choice = screen.getByRole('radio', { name: 'Creek stand. Cody is here' });
      expect(flat(choice.props.style).opacity).toBeUndefined();
      expect(flat(screen.getByText('Creek stand').props.style).color).toBe(
        theme.colors.textTertiary,
      );
    },
  );
});

describe('new components at 200 % text', () => {
  beforeEach(setLargeText);

  it('pass the shared audit', async () => {
    const view = await render(
      <Card title="Club" status={<Badge tone="success" label="Connected" />}>
        {BUTTON_VARIANTS.map((variant) => (
          <Button
            key={variant}
            variant={variant}
            label={variant}
            icon={Users}
            onPress={jest.fn()}
          />
        ))}
        <Button size="lg" label="Large" onPress={jest.fn()} />
        <Button label="Busy" loading onPress={jest.fn()} />
        <Field label="Email" hint="We send a code" />
        <Field label="Code" error="That code didn’t work" />
        <Banner tone="info" action={<Button label="Pair" onPress={jest.fn()} />}>
          Connect your radio to chat.
        </Banner>
        <EmptyState icon={Users} title="Nobody here yet">
          People appear once your radio hears them.
        </EmptyState>
      </Card>,
    );
    expect(a11yProblems(view.container)).toEqual([]);
  });
});
