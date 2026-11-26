import type { ReactNode } from 'react';

import { Screen } from './Screen';

type Props = {
  title: string;
  description: string;
  children?: ReactNode;
};

/** Temporary screen body used until each tab's milestone lands. */
export function PlaceholderScreen({ title, description, children }: Props) {
  return (
    <Screen title={title} description={description} scroll={false}>
      {children}
    </Screen>
  );
}
