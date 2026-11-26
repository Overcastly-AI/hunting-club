import { useState } from 'react';
import type { ClubApi, Invite } from '../api/types';
import { Loadable } from '../components/Loadable';
import { QrCode } from '../components/QrCode';
import { useAsync } from '../components/useAsync';
import { ROLE_LABELS, formatDate } from '../format';

/** Members and their roles, plus a fresh invite link for new members. */
export function Roster(props: { api: ClubApi }) {
  const members = useAsync(() => props.api.listMembers(), [props.api]);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);

  const makeInvite = async () => {
    setCopied(false);
    setInvite(await props.api.createInvite());
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
                <tr key={m.id}>
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
