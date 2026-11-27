import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { PageHeader } from './ui';

/** True until the first page heading of this page load has mounted. */
let firstHeading = true;

/**
 * The page heading's ref: it takes focus when the page opens after a route change (or
 * sign-in, or sign-out), so keyboard and screen-reader users land on the new page instead of
 * staying on the old link. The first page of a load keeps focus at the top of the document,
 * where the skip link is (and no ring is drawn on arrival).
 */
export function usePageHeadingFocus(): RefObject<HTMLHeadingElement | null> {
  const heading = useRef<HTMLHeadingElement>(null);
  const done = useRef(false);
  useEffect(() => {
    // Once per mount, also under StrictMode's second effect run.
    if (done.current) return;
    done.current = true;
    if (firstHeading) {
      firstHeading = false;
      return;
    }
    heading.current?.focus();
  }, []);
  return heading;
}

/** A page: a section named by its PageHeader, whose heading takes focus on arrival. */
export function Page(props: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  const { children, ...header } = props;
  const id = useId();
  const heading = usePageHeadingFocus();
  return (
    <section aria-labelledby={id}>
      <PageHeader {...header} titleId={id} titleRef={heading} />
      {children}
    </section>
  );
}
