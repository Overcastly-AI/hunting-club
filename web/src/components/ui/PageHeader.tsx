import { ArrowLeft } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { ButtonLink } from './Button';

/**
 * Every page's header: optional back link, the title (h1, title-1) with an optional status
 * pill, the description (body-lg, 68ch) and the actions: secondary ones first, the single
 * primary last. Under 640 px the actions drop below and the primary goes full width.
 * The h1 takes focus on route change (tabIndex -1); only :focus-visible draws a ring.
 */
export function PageHeader(props: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
  back?: { href: string; label: string };
  titleRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <header className="ui-page-header">
      <div className="ui-page-header__main">
        {props.back ? (
          <ButtonLink
            className="ui-page-header__back"
            variant="link"
            size="sm"
            icon={ArrowLeft}
            href={props.back.href}
          >
            {props.back.label}
          </ButtonLink>
        ) : null}
        <div className="ui-page-header__title-row">
          <h1 className="ui-page-header__title text-title-1" tabIndex={-1} ref={props.titleRef}>
            {props.title}
          </h1>
          {props.status}
        </div>
        {props.description ? (
          <p className="ui-page-header__description">{props.description}</p>
        ) : null}
      </div>
      {props.actions ? <div className="ui-page-header__actions">{props.actions}</div> : null}
    </header>
  );
}
