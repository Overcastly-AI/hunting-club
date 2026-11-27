import { DISPLAY_NAME_PROBLEMS } from '@huntclub/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { nameCopy } from '../../profile/copy';
import { onboardingCopy } from '../copy';
import { NameStep } from '../NameStep';

const next = () => screen.getByRole('button', { name: onboardingCopy.name.continue });

describe('NameStep (the name prompt at first run)', () => {
  it('says what the name is for', async () => {
    await render(<NameStep onNext={jest.fn()} onSkip={jest.fn()} />);
    expect(screen.getByText(nameCopy.body)).toBeTruthy();
  });

  it('suggests initials from the name and continues with the profile', async () => {
    const onNext = jest.fn();
    await render(<NameStep onNext={onNext} onSkip={jest.fn()} />);
    expect(next()).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText(nameCopy.nameLabel), ' Jake   Smith ');
    expect(screen.getByLabelText(nameCopy.initialsLabel).props.value).toBe('JS');

    await fireEvent.press(next());
    expect(onNext).toHaveBeenCalledWith({ displayName: 'Jake Smith', initials: 'JS' });
  });

  it('keeps initials the hunter typed, upper-cased', async () => {
    const onNext = jest.fn();
    await render(<NameStep onNext={onNext} onSkip={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText(nameCopy.initialsLabel), 'jk');
    await fireEvent.changeText(screen.getByLabelText(nameCopy.nameLabel), 'Jake Smith');

    await fireEvent.press(next());
    expect(onNext).toHaveBeenCalledWith({ displayName: 'Jake Smith', initials: 'JK' });
  });

  it('explains a name the shared rules refuse and will not continue', async () => {
    await render(<NameStep onNext={jest.fn()} onSkip={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText(nameCopy.nameLabel), 'Jake_Smith');
    expect(screen.getByText(DISPLAY_NAME_PROBLEMS.characters)).toBeTruthy();
    expect(next()).toBeDisabled();
  });

  it('starts from a saved profile', async () => {
    await render(
      <NameStep
        initial={{ displayName: 'Sam', initials: 'SM' }}
        radio={{ longName: 'Jake radio', shortName: 'JK' }}
        onNext={jest.fn()}
        onSkip={jest.fn()}
      />,
    );
    expect(screen.getByLabelText(nameCopy.nameLabel).props.value).toBe('Sam');
    expect(screen.getByLabelText(nameCopy.initialsLabel).props.value).toBe('SM');
  });

  it('defaults to the paired radio’s name and says where it came from', async () => {
    const onNext = jest.fn();
    await render(
      <NameStep
        radio={{ longName: 'Dale Earl', shortName: 'DE' }}
        onNext={onNext}
        onSkip={jest.fn()}
      />,
    );
    expect(screen.getByLabelText(nameCopy.nameLabel).props.value).toBe('Dale Earl');
    expect(screen.getByLabelText(nameCopy.initialsLabel).props.value).toBe('DE');
    expect(screen.getByText(nameCopy.fromRadio)).toBeTruthy();

    await fireEvent.press(next());
    expect(onNext).toHaveBeenCalledWith({ displayName: 'Dale Earl', initials: 'DE' });
  });

  it('takes the radio’s name when it links after the prompt opened', async () => {
    const view = await render(<NameStep radio={null} onNext={jest.fn()} onSkip={jest.fn()} />);
    expect(screen.getByLabelText(nameCopy.nameLabel).props.value).toBe('');
    await view.rerender(
      <NameStep
        radio={{ longName: 'Dale Earl', shortName: 'DE' }}
        onNext={jest.fn()}
        onSkip={jest.fn()}
      />,
    );
    expect(screen.getByLabelText(nameCopy.nameLabel).props.value).toBe('Dale Earl');
  });

  it('does not offer the stock "Meshtastic 1a2b" radio name', async () => {
    await render(
      <NameStep
        radio={{ longName: 'Meshtastic 3c4d', shortName: '3c4d' }}
        onNext={jest.fn()}
        onSkip={jest.fn()}
      />,
    );
    expect(screen.getByLabelText(nameCopy.nameLabel).props.value).toBe('');
  });

  it('can be skipped', async () => {
    const onNext = jest.fn();
    const onSkip = jest.fn();
    await render(<NameStep onNext={onNext} onSkip={onSkip} />);
    await fireEvent.press(screen.getByRole('button', { name: nameCopy.skip }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });
});
