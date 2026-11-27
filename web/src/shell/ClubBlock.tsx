import { ICON_SIZE } from '@huntclub/design';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { clubStatus } from '../billingStatus';
import type { AsyncResult } from '../components/useAsync';
import { ButtonLink, Popover, Skeleton, StatusPill } from '../components/ui';
import { HOME_PATH, pageHref } from './routes';
import type { ShellClub } from './shellClub';

/**
 * The club block: the club's name with its status pill (Trial / Active / Past due) and the
 * switcher. The admin runs one club (the first one they administer), so the switcher lists
 * just that club; with no club yet it is "Create club".
 */
export function ClubBlock(props: { state: AsyncResult<ShellClub> }) {
  const { state } = props;
  if (state.status === 'loading')
    return (
      <div className="shell-club" aria-hidden="true">
        <Skeleton shape="title" />
      </div>
    );
  if (state.status === 'ready' && !state.value.club) {
    return (
      <div className="shell-club">
        <ButtonLink variant="secondary" block icon={Plus} href={pageHref(HOME_PATH)}>
          Create club
        </ButtonLink>
      </div>
    );
  }
  if (state.status !== 'ready' || !state.value.club) return <div className="shell-club" />;
  const { club, subscription } = state.value;
  const status = clubStatus(subscription);
  return (
    <div className="shell-club">
      <Popover
        label="Your clubs"
        className="shell-club__switcher"
        triggerClassName="shell-club__button"
        panelClassName="shell-club__panel"
        trigger={
          <>
            <span className="visually-hidden">Club: </span>
            <span className="shell-club__name">{club.name}</span>
            <ChevronDown size={ICON_SIZE.md} aria-hidden />
          </>
        }
      >
        {(close) => (
          <ul className="shell-menu">
            <li>
              <ButtonLink
                variant="tertiary"
                block
                icon={Check}
                href={pageHref(HOME_PATH)}
                aria-current="true"
                onClick={close}
              >
                {club.name}
              </ButtonLink>
            </li>
          </ul>
        )}
      </Popover>
      {status ? (
        <div className="shell-club__status">
          <StatusPill status={status} />
        </div>
      ) : null}
    </div>
  );
}
