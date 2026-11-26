import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ICON } from './sizes';

/**
 * What an empty list or page says instead of "No X yet.": a 48 px icon, a title (title-3),
 * a short body (48ch) and one action. (The topo texture behind the icon comes in P4.)
 */
export function EmptyState(props: {
  icon: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  /** The title's heading level in the page outline (default h2). */
  titleAs?: 'h2' | 'h3';
}) {
  const Icon = props.icon;
  const Title = props.titleAs ?? 'h2';
  return (
    <div className="ui-empty">
      <span className="ui-empty__icon">
        <Icon size={ICON.empty} strokeWidth={1.5} aria-hidden />
      </span>
      <Title className="ui-empty__title">{props.title}</Title>
      {props.children ? <p className="ui-empty__body">{props.children}</p> : null}
      {props.action ? <div className="ui-empty__action">{props.action}</div> : null}
    </div>
  );
}
