import { encodeJoinUrl, nodeId } from '@huntclub/mesh';
import {
  DAY_MS,
  MEMBER_ROLE_LABELS,
  pluralize,
  type Member,
  type MemberRole,
} from '@huntclub/shared';
import { Link2, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import type { ClubApi } from '../api/types';
import { Loadable } from '../components/Loadable';
import { Page } from '../components/Page';
import { QrCode } from '../components/QrCode';
import { isOffline, useAsync } from '../components/useAsync';
import {
  Avatar,
  Banner,
  Button,
  CopyButton,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  Input,
  Segmented,
  type TableColumn,
} from '../components/ui';
import { formatDate } from '../format';
import { useSignedInUser } from '../signedInUser';

/** How long a new member invite stays valid. */
const INVITE_DAYS = 14;

/** The roster's word for a member with no radio paired yet. */
export const NO_RADIO = 'No radio paired';

/** The header's tally: "6 members and 1 guest" (guests are not members). */
export function rosterTally(list: readonly Member[]): string {
  const guests = list.filter((m) => m.role === 'guest').length;
  const members = pluralize(list.length - guests, 'member');
  return guests ? `${members} and ${pluralize(guests, 'guest')}` : members;
}

/** The second line under a name: the role, "You", or how long a guest pass lasts. */
function roleLine(m: Member, me: string | undefined): string {
  const role =
    m.role === 'guest' && m.expiresAt
      ? `Guest until ${formatDate(m.expiresAt)}`
      : MEMBER_ROLE_LABELS[m.role];
  return m.userId === me ? `${role}. You` : role;
}

type Filter = 'all' | MemberRole;

/** The invite dialog: nothing is made until the admin asks (`idle`), then busy, then the link. */
type InviteState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; joinUrl: string; expiresAt: string };

/**
 * Members other than the signed-in admin. Without a known user (an ID token that could
 * not be read), the viewer is still on the roster, so one row is theirs.
 */
function otherMembers(list: readonly Member[], me: string | undefined): number {
  return me ? list.filter((m) => m.userId !== me).length : Math.max(0, list.length - 1);
}

/** Members, their roles and radios, and the invite QR for new members. */
export function Roster(props: { api: ClubApi }) {
  const members = useAsync(() => props.api.listMembers(), [props.api], { keepLastOn: isOffline });
  // Opening the dialog makes nothing: the invite is made only by its "Create invite link"
  // button (never on open, and never by an effect, which could run twice and leave unused
  // invites behind).
  const [invite, setInvite] = useState<InviteState | null>(null);
  const ready = members.status === 'ready';
  const makeInvite = () => {
    setInvite({ kind: 'busy' });
    // A dialog closed while the invite was being made stays closed.
    void createInviteLink(props.api).then((next) => setInvite((open) => (open ? next : open)));
  };

  return (
    <Page
      title="Roster"
      description={ready ? rosterTally(members.value) : undefined}
      // Invites need a club: only offered once the roster has loaded.
      actions={
        ready ? (
          <Button variant="primary" icon={Plus} onClick={() => setInvite({ kind: 'idle' })}>
            Invite members
          </Button>
        ) : null
      }
    >
      <Loadable state={members}>{(list) => <Members list={list} />}</Loadable>
      {invite ? (
        <InviteDialog state={invite} onCreate={makeInvite} onClose={() => setInvite(null)} />
      ) : null}
    </Page>
  );
}

function Members(props: { list: readonly Member[] }) {
  const me = useSignedInUser()?.userId;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const count = (role: MemberRole) => props.list.filter((m) => m.role === role).length;
  const words = query.trim().toLowerCase();
  const rows = props.list.filter(
    (m) =>
      (filter === 'all' || m.role === filter) &&
      (words === '' || m.displayName.toLowerCase().includes(words)),
  );
  const columns: readonly TableColumn<Member>[] = [
    {
      key: 'name',
      header: 'Member',
      sortValue: (m) => m.displayName,
      cell: (m) => (
        <span className="person">
          <Avatar name={m.displayName} you={m.userId === me} />
          <span className="person__text">
            <span className="person__name">{m.displayName}</span>
            <span className="person__role">{roleLine(m, me)}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'radio',
      header: 'Radio',
      cell: (m) =>
        m.nodeId === undefined ? (
          <span className="quiet">{NO_RADIO}</span>
        ) : (
          <span className="text-readout-inline">{nodeId(m.nodeId)}</span>
        ),
    },
    {
      key: 'joined',
      header: 'Joined',
      sortValue: (m) => m.createdAt,
      cell: (m) => formatDate(m.createdAt),
    },
  ];

  return (
    <>
      <div className="filters">
        <Field label="Find a member" className="filters__search">
          <Input
            type="search"
            placeholder="Name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <Segmented
          legend="Show"
          options={[
            { value: 'all', label: `Everyone ${props.list.length}` },
            { value: 'admin', label: `Admins ${count('admin')}` },
            { value: 'guest', label: `Guests ${count('guest')}` },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <DataTable
        caption="Club members"
        columns={columns}
        rows={rows}
        rowKey={(m) => m.userId}
        initialSort={{ key: 'name', direction: 'ascending' }}
        empty={
          <EmptyState icon={Search} title="Nobody matches" titleAs="h3">
            Check the spelling, or show everyone.
          </EmptyState>
        }
      />
      {otherMembers(props.list, me) === 0 ? (
        <p className="after-table">
          No other members yet. Invite your hunters with the club's QR code.
        </p>
      ) : null}
    </>
  );
}

/**
 * A new member invite as a join link. Channel first, invite last: a failed key read must not
 * leave an unused invite behind.
 */
async function createInviteLink(api: ClubApi): Promise<InviteState> {
  try {
    // The club's name goes in the link so the invite page can say "Join <club name>".
    const [channelSet, club] = await Promise.all([api.getClubChannelSet(), api.getClub()]);
    const created = await api.createInvite({
      role: 'member',
      expiresAt: new Date(Date.now() + INVITE_DAYS * DAY_MS).toISOString(),
    });
    // The one join-link builder (@huntclub/mesh); the https form works in any camera app.
    const target = {
      kind: 'club',
      clubId: created.clubId,
      inviteToken: created.token,
      ...(club ? { clubName: club.name } : {}),
    } as const;
    return {
      kind: 'ready',
      joinUrl: encodeJoinUrl({ channelSet, target }, { form: 'web' }),
      expiresAt: created.expiresAt,
    };
  } catch (error) {
    return {
      kind: 'error',
      message: isOffline(error)
        ? 'No connection. Try again when you are online.'
        : 'Could not make the invite. Try again.',
    };
  }
}

/** The button that makes the invite: the only thing that writes one. */
export const CREATE_INVITE = 'Create invite link';

/** Create invite link, then the invite's QR code and link, with Copy link and its expiry. */
function InviteDialog(props: { state: InviteState; onCreate: () => void; onClose: () => void }) {
  const { state } = props;
  return (
    <Dialog
      open
      onClose={props.onClose}
      title="Invite members"
      description="New members scan the code with their phone camera. It adds them to the club and its radio channel."
      footer={
        <Button variant="secondary" onClick={props.onClose}>
          Done
        </Button>
      }
    >
      <div aria-live="polite">
        {state.kind === 'idle' ? (
          <div className="invite__start">
            <p className="form-note">
              The link works for {INVITE_DAYS} days, for as many hunters as you send it to.
            </p>
            <Button variant="primary" icon={Link2} onClick={props.onCreate}>
              {CREATE_INVITE}
            </Button>
          </div>
        ) : null}
        {state.kind === 'busy' ? (
          <p className="loading" role="status">
            Making invite…
          </p>
        ) : null}
        {state.kind === 'error' ? (
          <Banner
            tone="danger"
            live
            action={
              <Button size="sm" onClick={props.onCreate}>
                Try again
              </Button>
            }
          >
            {state.message}
          </Banner>
        ) : null}
        {state.kind === 'ready' ? (
          <div className="invite">
            <QrCode value={state.joinUrl} label="Club invite QR code" />
            <div className="invite__link">
              <Field label="Or send this link" hint={`Works until ${formatDate(state.expiresAt)}.`}>
                <Input
                  readOnly
                  value={state.joinUrl}
                  data-testid="invite-link"
                  onFocus={(e) => e.currentTarget.select()}
                />
              </Field>
              <CopyButton text={state.joinUrl} label="Copy link" />
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
