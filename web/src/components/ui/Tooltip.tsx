import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactElement, ReactNode } from 'react';

/** Delay before a tooltip shows on hover, in ms (it shows at once on keyboard focus). */
const OPEN_DELAY_MS = 300;

/**
 * A short text label for a control, on hover and keyboard focus (Radix Tooltip: passes the
 * strict CSP). Never the only name of a control: icon-only buttons also carry aria-label.
 */
export function Tooltip(props: { content: ReactNode; children: ReactElement; open?: boolean }) {
  return (
    <RadixTooltip.Provider delayDuration={OPEN_DELAY_MS}>
      <RadixTooltip.Root open={props.open}>
        <RadixTooltip.Trigger asChild>{props.children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content className="ui-tooltip" sideOffset={6}>
            {props.content}
            <RadixTooltip.Arrow className="ui-tooltip__arrow" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
