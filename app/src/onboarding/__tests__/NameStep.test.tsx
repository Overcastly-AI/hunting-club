import { fireEvent, render, screen } from '@testing-library/react-native';

import { onboardingCopy } from '../copy';
import { NameStep } from '../NameStep';

const copy = onboardingCopy.name;

describe('NameStep', () => {
  it('suggests initials from the name and continues with the profile', async () => {
    const onNext = jest.fn();
    await render(<NameStep onNext={onNext} />);
    const next = screen.getByRole('button', { name: copy.continue });
    expect(next).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText(copy.nameLabel), 'Jake Smith');
    expect(screen.getByLabelText(copy.initialsLabel).props.value).toBe('JS');

    await fireEvent.press(next);
    expect(onNext).toHaveBeenCalledWith({ displayName: 'Jake Smith', initials: 'JS' });
  });

  it('keeps initials the hunter typed', async () => {
    const onNext = jest.fn();
    await render(<NameStep onNext={onNext} />);
    await fireEvent.changeText(screen.getByLabelText(copy.initialsLabel), 'JK');
    await fireEvent.changeText(screen.getByLabelText(copy.nameLabel), 'Jake Smith');

    await fireEvent.press(screen.getByRole('button', { name: copy.continue }));
    expect(onNext).toHaveBeenCalledWith({ displayName: 'Jake Smith', initials: 'JK' });
  });

  it('starts from a saved profile', async () => {
    await render(<NameStep initial={{ displayName: 'Sam', initials: 'SM' }} onNext={jest.fn()} />);
    expect(screen.getByLabelText(copy.nameLabel).props.value).toBe('Sam');
    expect(screen.getByLabelText(copy.initialsLabel).props.value).toBe('SM');
  });
});
