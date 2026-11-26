import { fireEvent, screen } from '@testing-library/react';
import { KIT_SECTIONS } from '../../../kit/examples';
import { axeViolations } from './axe';
import { renderKitSection } from './kit';

// The kit's examples are the single list of every component in every state: each one is
// checked here, so a component added to the kit is checked too.
describe('axe: every component in every kit state', () => {
  it.each(KIT_SECTIONS.map((s) => [s.title, s.id] as const))('%s', async (_title, id) => {
    const { container } = renderKitSection(id);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('Dialog, open', async () => {
    renderKitSection('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Invite member' }));
    expect(await axeViolations(screen.getByRole('dialog'))).toEqual([]);
  });

  it.each(['Success toast', 'Danger toast'])('Toast, shown (%s)', async (name) => {
    renderKitSection('toast');
    fireEvent.click(screen.getByRole('button', { name }));
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
