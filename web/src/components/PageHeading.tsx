import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A page's h1. It takes focus when the page opens, so keyboard and screen-reader users
 * land on the new page after a route change instead of staying on the old link.
 */
export function PageHeading(props: { id: string; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <h1 id={props.id} ref={ref} tabIndex={-1}>
      {props.children}
    </h1>
  );
}
