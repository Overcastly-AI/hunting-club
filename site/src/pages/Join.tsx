import { APP_NAME } from '@huntclub/shared';
import type { ReactNode } from 'react';
import { INITIAL_JOIN_STATE, JOIN_HOOKS, type JoinState } from '../join/states';
import { GET_THE_APP, PAGE_PATHS } from '../routes';

/** Content shown only in the given states (the page script picks one; see join/states.ts). */
function In(props: { states: readonly JoinState[]; children: ReactNode; as?: 'span' | 'div' }) {
  const Tag = props.as ?? 'div';
  const attrs = { [JOIN_HOOKS.state]: props.states.join(' ') };
  return (
    <Tag {...attrs} hidden={!props.states.includes(INITIAL_JOIN_STATE)}>
      {props.children}
    </Tag>
  );
}

const INVITES: readonly JoinState[] = ['club', 'party'];

/** What /join says with no invite, or a broken one, and the one thing to do about it. */
export const JOIN_INVALID_HEADING = 'This invite link is missing or invalid';
export const JOIN_INVALID_NEXT_STEP =
  'Ask the person who invited you to send a new invite link or QR code.';

/**
 * The invite landing page. Every state is in the HTML; the script shows the one the
 * invite link's fragment calls for. With no script it reads as a general invite.
 */
export function Join() {
  return (
    <section className="hero join">
      <div className="wrap">
        <In states={['generic', ...INVITES]}>
          <p className="eyebrow">You&apos;re invited</p>
        </In>
        <h1>
          <In as="span" states={['generic']}>
            Hunt with {APP_NAME}
          </In>
          <In as="span" states={['club']}>
            <span {...{ [JOIN_HOOKS.clubName]: '' }}>Join your hunting club</span>
          </In>
          <In as="span" states={['party']}>
            Hunt with your party
          </In>
          <In as="span" states={['invalid']}>
            {JOIN_INVALID_HEADING}
          </In>
        </h1>

        <In states={['invalid']}>
          <p className="lead" role="alert">
            {JOIN_INVALID_NEXT_STEP}
          </p>
        </In>

        <In states={['generic', ...INVITES]}>
          <p className="lead">
            {APP_NAME} shares a live map, chat and check-ins over small radios, so everyone can see
            each other with no cell service.
          </p>
          <ol className="steps">
            <li>
              <h3>Install the app</h3>
              <p className="muted">
                Skip this if you have it. <a href={GET_THE_APP.href}>How to get the app</a>.
              </p>
            </li>
            <li>
              <h3>Open this invite on your phone</h3>
              <p className="muted">If you just installed the app, open this link again.</p>
            </li>
            <li>
              <h3>The app sets up your radio</h3>
              <p className="muted">Then you are ready to hunt.</p>
            </li>
          </ol>
        </In>

        <In states={INVITES}>
          <div className="actions">
            <a className="button primary" href={PAGE_PATHS.download} {...{ [JOIN_HOOKS.open]: '' }}>
              Open in {APP_NAME}
            </a>
            <a className="button" href={GET_THE_APP.href}>
              {GET_THE_APP.label}
            </a>
          </div>
          <div className="join-qr">
            <h2>On a computer?</h2>
            <p>Scan this with your phone camera.</p>
            <div {...{ [JOIN_HOOKS.qr]: '' }} />
          </div>
        </In>
      </div>
    </section>
  );
}
