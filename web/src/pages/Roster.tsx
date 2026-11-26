import { encodeJoinUrl } from '@huntclub/mesh';
import type { Member } from '@huntclub/shared';
import { useEffect, useRef, useState } from 'react';
import type { ClubApi } from '../api/types';
import { DataTable, type Column } from '../components/DataTable';
import { Loadable } from '../components/Loadable';
import { PageHeading } from '../components/PageHeading';
import { QrCode } from '../components/QrCode';
import { isOffline, useAsync } from '../components/useAsync';
import { ROLE_LABELS, formatDate } from '../format';
import { useSignedInUser } from '../signedInUser';

/** How long a new member invite stays valid. */
const INVITE_DAYS = 14;
const DAY_MS = 86_400_000;

const MEMBER_COLUMNS: readonly Column<Member>[] = [
  { label: 'Name', cell: (m) => m.displayName },
  { label: 'Role', cell: (m) => ROLE_LABELS[m.role] },
  { label: 'Guest pass until', cell: (m) => (m.expiresAt ? formatDate(m.expiresAt) : '—') },
];

type InviteState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; joinUrl: string; expiresAt: string };

/** `copied`: the clipboard took it. `manual`: no clipboard, so the link is selected to copy by hand. */
type CopyState = 'idle' | 'copied' | 'manual';

/**
 * Members other than the signed-in admin. Without a known user (an ID token that could
 * not be read), the viewer is still on the roster, so one row is theirs.
 */
function otherMembers(list: readonly Member[], me: string | undefined): number {
  return me ? list.filter((m) => m.userId !== me).length : Math.max(0, list.length - 1);
}

/** Members and their roles, plus a fresh invite link for new members. */
export function Roster(props: { api: ClubApi }) {
  const members = useAsync(() => props.api.listMembers(), [props.api], { keepLastOn: isOffline });
  const [invite, setInvite] = useState<InviteState>({ kind: 'idle' });
  const [copy, setCopy] = useState<CopyState>('idle');
  const me = useSignedInUser();

  const makeInvite = async () => {
    setInvite({ kind: 'busy' });
    setCopy('idle');
    try {
      // Channel first, invite last: a failed key read must not leave an unused invite behind.
      const channelSet = await props.api.getClubChannelSet();
      const created = await props.api.createInvite({
        role: 'member',
        expiresAt: new Date(Date.now() + INVITE_DAYS * DAY_MS).toISOString(),
      });
      // The one join-link builder (@huntclub/mesh); the https form works in any camera app.
      const target = { kind: 'club', clubId: created.clubId, inviteToken: created.token } as const;
      setInvite({
        kind: 'ready',
        joinUrl: encodeJoinUrl({ channelSet, target }, { form: 'web' }),
        expiresAt: created.expiresAt,
      });
    } catch (error) {
      setInvite({
        kind: 'error',
        message: isOffline(error)
          ? 'No connection. Try again when you are online.'
          : 'Could not make the invite. Try again.',
      });
    }
  };

  const copyLink = async (joinUrl: string) => {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(joinUrl);
      setCopy('copied');
    } catch {
      setCopy('manual');
    }
  };

  return (
    <section aria-labelledby="roster-title">
      <PageHeading id="roster-title">Roster</PageHeading>
      <Loadable state={members}>
        {(list) => (
          <>
            <DataTable
              caption="Club members"
              columns={MEMBER_COLUMNS}
              rows={list}
              rowKey={(m) => m.userId}
              stack
            />
            {otherMembers(list, me?.userId) === 0 ? (
              <p>No other members yet. Make an invite below and share it with your hunters.</p>
            ) : null}
          </>
        )}
      </Loadable>

      {/* Invites need a club: only offered once the roster has loaded. */}
      {members.status === 'ready' ? (
        <>
          <h2>Invite a member</h2>
          <p className="muted">
            New members scan the invite with their phone camera. The new member joins the club radio
            channel.
          </p>
          <button
            className="button primary"
            type="button"
            disabled={invite.kind === 'busy'}
            onClick={() => void makeInvite()}
          >
            {invite.kind === 'busy' ? 'Making invite…' : 'Make an invite'}
          </button>
          {invite.kind === 'error' ? (
            <p className="error" role="alert">
              {invite.message}
            </p>
          ) : null}
          {invite.kind === 'ready' ? (
            <div className="panel" aria-live="polite">
              <QrCode value={invite.joinUrl} label="Club invite QR code" />
              <p>Or send this link (valid until {formatDate(invite.expiresAt)}):</p>
              <p className="code" data-testid="invite-link">
                {invite.joinUrl}
              </p>
              {copy === 'manual' ? (
                <ManualCopy value={invite.joinUrl} />
              ) : (
                <button
                  className="button"
                  type="button"
                  onClick={() => void copyLink(invite.joinUrl)}
                >
                  {copy === 'copied' ? 'Copied' : 'Copy link'}
                </button>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/** When the browser will not copy for us: the link, selected, ready for Ctrl+C or ⌘C. */
function ManualCopy(props: { value: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <div className="field">
      <label htmlFor="invite-copy" className="text-label">
        Copy this link
      </label>
      <input
        id="invite-copy"
        ref={ref}
        readOnly
        value={props.value}
        aria-describedby="invite-copy-hint"
        onFocus={(e) => e.currentTarget.select()}
      />
      <span id="invite-copy-hint" className="muted">
        The link is selected. Press Ctrl+C (⌘C on a Mac) to copy it.
      </span>
    </div>
  );
}
