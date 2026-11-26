import { Screen } from './Screen';

type Props = {
  title: string;
  description: string;
};

/** Temporary screen body used until each tab's milestone lands. */
export function PlaceholderScreen({ title, description }: Props) {
  return <Screen title={title} description={description} scroll={false} />;
}
