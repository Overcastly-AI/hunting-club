import {
  LEGAL_DOCS,
  LEGAL_DRAFT_NOTICE,
  privacyPolicy,
  SAFETY_NOTE,
  termsOfUse,
} from '@huntclub/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import LegalRoute from '../../app/legal/[doc]';
import { sizes } from '../../theme';
import { AboutSection } from '../AboutSection';
import { LegalScreen } from '../LegalScreen';
import { legalRoute } from '../routes';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>{`redirect ${href}`}</Text>;
  },
}));

beforeEach(() => jest.clearAllMocks());

describe('Settings → About', () => {
  it('opens Privacy and Terms with buttons of at least 48 px', async () => {
    await render(<AboutSection />);
    expect(screen.getByRole('header', { name: 'About' })).toBeTruthy();
    for (const [id, doc] of Object.entries(LEGAL_DOCS)) {
      const button = screen.getByRole('button', { name: doc.title });
      const style = StyleSheet.flatten(
        typeof button.props.style === 'function'
          ? button.props.style({ pressed: false })
          : button.props.style,
      );
      expect(style.minHeight).toBeGreaterThanOrEqual(sizes.minTapTarget);
      await fireEvent.press(button);
      expect(router.push).toHaveBeenLastCalledWith(legalRoute(id as keyof typeof LEGAL_DOCS));
    }
  });
});

describe('LegalScreen', () => {
  it.each([privacyPolicy, termsOfUse])(
    'shows $title with the draft notice and every section',
    async (doc) => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch' as never);
      const onDone = jest.fn();
      await render(<LegalScreen doc={doc} onDone={onDone} />);
      expect(screen.getByRole('header', { name: doc.title })).toBeTruthy();
      expect(screen.getByText(LEGAL_DRAFT_NOTICE)).toBeTruthy();
      for (const section of doc.sections) {
        expect(screen.getByRole('header', { name: section.heading })).toBeTruthy();
        for (const text of section.paragraphs) {
          expect(screen.getAllByText(text).length).toBeGreaterThan(0);
        }
      }
      // Bundled copy: nothing is fetched, so it reads the same with no signal.
      expect(fetchSpy).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
      expect(onDone).toHaveBeenCalledTimes(1);
    },
  );

  it('tells people to call 911 themselves only with the settings note, word for word', async () => {
    await render(<LegalScreen doc={termsOfUse} onDone={jest.fn()} />);
    expect(screen.getByText(SAFETY_NOTE)).toBeTruthy();
  });
});

describe('legal route', () => {
  it('shows the document named in the route and goes back on Back', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ doc: 'terms' });
    await render(<LegalRoute />);
    expect(screen.getByRole('header', { name: termsOfUse.title })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('sends an unknown document back to the map', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ doc: 'cookies' });
    await render(<LegalRoute />);
    expect(screen.getByText('redirect /')).toBeTruthy();
  });
});
