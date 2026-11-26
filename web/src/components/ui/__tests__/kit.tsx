import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { KIT_SECTIONS } from '../../../kit/examples';
import { ToastProvider } from '../Toast';

/** Renders UI as a page would: inside the toast provider and a <main> landmark. */
export const renderInPage = (ui: ReactNode) =>
  render(
    <ToastProvider>
      <main>{ui}</main>
    </ToastProvider>,
  );

/** Renders one kit section's examples (src/kit/examples.tsx) by its id. */
export function renderKitSection(id: string) {
  const section = KIT_SECTIONS.find((s) => s.id === id);
  if (!section) throw new Error(`No kit section ${id}`);
  const { Demo } = section;
  return renderInPage(<Demo />);
}
