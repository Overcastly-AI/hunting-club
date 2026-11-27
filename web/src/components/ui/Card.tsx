import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx';
import { ICON_SIZE } from '@huntclub/design';

type Heading = 'h2' | 'h3';

/**
 * A plate on the page (docs/DESIGN.md, "Plates, not cards"): the plate tone, a hairline edge
 * and the plate radius, no shadow; an optional header (title + action) and footer, each
 * divided off by a hairline.
 */
export function Card(props: {
  title?: ReactNode;
  /** The title's heading level in the page outline (default h2). */
  titleAs?: Heading;
  action?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  const Title = props.titleAs ?? 'h2';
  return (
    <section className={cx('ui-card', props.className)} aria-label={props['aria-label']}>
      {props.title || props.action ? (
        <div className="ui-card__header">
          {props.title ? <Title className="ui-card__title">{props.title}</Title> : <span />}
          {props.action}
        </div>
      ) : null}
      {props.children}
      {props.footer ? <div className="ui-card__footer">{props.footer}</div> : null}
    </section>
  );
}

/** The readout strip: labelled cells on one plate, four across from 1024 px, two below. */
export function StatGrid(props: { children: ReactNode; 'aria-label'?: string }) {
  return (
    <ul className="ui-stat-grid" aria-label={props['aria-label']}>
      {props.children}
    </ul>
  );
}

/**
 * One readout cell: label (caption), value (condensed, tabular), optional hint and icon.
 * With `href` the whole cell is the link to its page. Goes inside a StatGrid.
 */
export function StatTile(props: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  href?: string;
}) {
  const Icon = props.icon;
  const body = (
    <>
      <span className="ui-stat-tile__label">
        {Icon ? <Icon size={ICON_SIZE.sm} aria-hidden /> : null}
        {props.label}
      </span>
      <span className="ui-stat-tile__value text-readout">{props.value}</span>
      {props.hint ? <span className="ui-stat-tile__hint">{props.hint}</span> : null}
    </>
  );
  return (
    <li>
      {props.href ? (
        <a className="ui-stat-tile" href={props.href}>
          {body}
        </a>
      ) : (
        <div className="ui-stat-tile">{body}</div>
      )}
    </li>
  );
}
