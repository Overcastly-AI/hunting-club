import { encodeJoinUrl } from '@huntclub/mesh';
import { useState } from 'react';
import type { ClubApi } from '../api/types';
import { Loadable } from '../components/Loadable';
import { QrCode } from '../components/QrCode';
import { useAsync } from '../components/useAsync';
import { ROLE_LABELS, formatDate } from '../format';

/** How long a new member invite stays valid. */
const INVITE_DAYS = 14;
const DAY_MS = 86_400_000;

/** Members and their roles, plus a fresh invite link for new members. */
export function Roster(props: { api: ClubApi }) {
  const members = useAsync(() => props.api.listMembers(), [props.api]);
  const [invite, setInvite] = useState<{ joinUrl: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const makeInvite = async () => {
    setCopied(false);
    const [created, channelSet] = await Promise.all([
      props.api.createInvite({
        role: 'member',
        expiresAt: new Date(Date.now() + INVITE_DAYS * DAY_MS).toISOString(),
      }),
      props.api.getClubChannelSet(),
    ]);
    // The one join-link builder (@huntclub/mesh); the https form works in any camera app.
    const target = { kind: 'club', clubId: created.clubId, inviteToken: created.token } as const;
    setInvite({
      joinUrl: encodeJoinUrl({ channelSet, target }, { form: 'web' }),
      expiresAt: created.expiresAt,
    });
  };

  const copy = async () => {
    if (!invite) return;
    await navigator.clipboard?.writeText(invite.joinUrl);
    setCopied(true);
  };

  return (
    <section aria-labelledby="roster-title">
      <h1 id="roster-title">Roster</h1>
      <Loadable state={members}>
        {(list) => (
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Guest pass until</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.userId}>
                  <td>{m.displayName}</td>
                  <td>{ROLE_LABELS[m.role]}</td>
                  <td>{m.expiresAt ? formatDate(m.expiresAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Loadable>

      <h2>Invite a member</h2>
      <p className="muted">
        New members scan the invite with their phone camera. It joins the club radio channel even
        with no cell service.
      </p>
      <button className="button primary" type="button" onClick={() => void makeInvite()}>
        Make an invite
      </button>
      {invite ? (
        <div className="panel" aria-live="polite">
          <QrCode value={invite.joinUrl} label="Club invite QR code" />
          <p>Or send this link (valid until {formatDate(invite.expiresAt)}):</p>
          <p className="code" data-testid="invite-link">
            {invite.joinUrl}
          </p>
          <button className="button" type="button" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
