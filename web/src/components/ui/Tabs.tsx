import * as RadixTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';

export interface TabItem {
  value: string;
  label: string;
  /** Shown after the label: "Stands (3)". */
  count?: number;
  content: ReactNode;
}

/**
 * Underline tabs with the accent bar (Radix Tabs: passes the strict CSP). Arrow keys move
 * between tabs, Home and End jump, Tab moves into the panel.
 */
export function Tabs(props: {
  label: string;
  items: readonly TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <RadixTabs.Root
      className="ui-tabs"
      value={props.value}
      defaultValue={props.defaultValue ?? props.items[0]?.value}
      onValueChange={props.onValueChange}
      activationMode="automatic"
    >
      <RadixTabs.List className="ui-tabs__list" aria-label={props.label}>
        {props.items.map((t) => (
          <RadixTabs.Trigger key={t.value} value={t.value} className="ui-tabs__tab">
            {t.count === undefined ? t.label : `${t.label} (${t.count})`}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {props.items.map((t) => (
        <RadixTabs.Content key={t.value} value={t.value} className="ui-tabs__panel">
          {t.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
