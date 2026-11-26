// Every UI component in every state: the kit page (Kit.tsx) draws these, and the axe test
// (components/ui/__tests__/axe.test.tsx) checks each one. Sample data is for the kit only.
import {
  CreditCard,
  Crosshair,
  Download,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import { BILLING_INTERVALS, CLUB_PRICING, type BillingInterval } from '@huntclub/shared/pricing';
import { useState, type ReactNode } from 'react';
import {
  Avatar,
  Badge,
  Banner,
  BUTTON_VARIANTS,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  CopyButton,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  Input,
  LoadingRegion,
  PageHeader,
  RadioGroup,
  Segmented,
  Select,
  Skeleton,
  SkeletonText,
  StatGrid,
  STATUSES,
  StatTile,
  StatusPill,
  Switch,
  Tabs,
  Textarea,
  ThemeToggle,
  TONES,
  Tooltip,
  useToast,
  type Status,
  type TableColumn,
} from '../components/ui';

const Row = (props: { children: ReactNode }) => <div className="kit-row">{props.children}</div>;
const Label = (props: { children: ReactNode }) => (
  <p className="kit-label text-caption">{props.children}</p>
);

function Buttons() {
  return (
    <>
      <Label>Variants: default, disabled, loading</Label>
      {BUTTON_VARIANTS.map((v) => (
        <Row key={v}>
          <Button variant={v}>
            {v === 'danger-filled' ? 'Remove member' : `${v[0]!.toUpperCase()}${v.slice(1)}`}
          </Button>
          <Button variant={v} disabled>
            Disabled
          </Button>
          <Button variant={v} loading>
            Saving
          </Button>
        </Row>
      ))}
      <Label>Sizes: sm 48, md 48, lg 56</Label>
      <Row>
        <Button variant="primary" size="sm">
          Small
        </Button>
        <Button variant="primary">Medium</Button>
        <Button variant="primary" size="lg">
          Large
        </Button>
      </Row>
      <Label>Icon leading, icon only (with tooltip), link styled as a button, full width</Label>
      <Row>
        <Button variant="secondary" icon={Download}>
          Export CSV
        </Button>
        <Button variant="tertiary" icon={RefreshCw} iconOnly label="Refresh" />
        <Button variant="secondary" icon={Pencil} iconOnly label="Edit stand" />
        <Button variant="danger" icon={Trash2} iconOnly label="Delete map pack" />
        <ButtonLink variant="secondary" href="#/_kit" icon={CreditCard}>
          Billing
        </ButtonLink>
      </Row>
      <Button variant="primary" size="lg" block>
        Send code
      </Button>
    </>
  );
}

const SEASONS = [
  { value: '2026-27', label: '2026-27 season' },
  { value: 'custom', label: 'Custom' },
];

function Fields() {
  return (
    <div className="kit-grid">
      <Field label="Email" hint="We'll email you a code. No password.">
        <Input type="email" placeholder="you@example.com" autoComplete="email" />
      </Field>
      <Field label="Club name" error="Enter a club name.">
        <Input defaultValue="" />
      </Field>
      <Field label="Code">
        <Input defaultValue="123456" disabled />
      </Field>
      <Field label="Season">
        <Select options={SEASONS} defaultValue="2026-27" />
      </Field>
      <Field label="From" hint="Native date input, drawn with the tokens.">
        <Input type="date" defaultValue="2026-09-01" />
      </Field>
      <Field label="Note to members" hint="Up to 200 characters.">
        <Textarea defaultValue="Gate code changes on Friday." />
      </Field>
    </div>
  );
}

/** A flat swatch for the Topo / Aerial previews (the real thumbnails come in P3). */
const Preview = (props: { kind: 'topo' | 'aerial' }) => (
  <span className={`kit-preview kit-preview--${props.kind}`} />
);

function Choices() {
  const [basemap, setBasemap] = useState<'topo' | 'aerial'>('topo');
  const [plan, setPlan] = useState<BillingInterval>(CLUB_PRICING.defaultInterval);
  const [role, setRole] = useState<'member' | 'admin'>('member');
  return (
    <div className="kit-grid">
      <Segmented
        legend="Map style"
        value={basemap}
        onChange={setBasemap}
        options={[
          { value: 'topo', label: 'Topo', preview: <Preview kind="topo" /> },
          { value: 'aerial', label: 'Aerial', preview: <Preview kind="aerial" /> },
        ]}
      />
      <Segmented
        legend="Billing period"
        value={plan}
        onChange={setPlan}
        options={BILLING_INTERVALS.map((value) => ({
          value,
          label: CLUB_PRICING.intervals[value].label,
        }))}
      />
      <Segmented
        legend="Disabled"
        value="a"
        onChange={() => undefined}
        disabled
        options={[
          { value: 'a', label: 'On' },
          { value: 'b', label: 'Off' },
        ]}
      />
      <RadioGroup
        legend="Role"
        value={role}
        onChange={setRole}
        options={[
          { value: 'member', label: 'Member', hint: 'Uses the radio, map and check-ins.' },
          { value: 'admin', label: 'Admin', hint: 'Also manages the roster, stands and billing.' },
        ]}
      />
    </div>
  );
}

function Checks() {
  return (
    <div className="kit-grid">
      <div>
        <Checkbox label="Unchecked" />
        <Checkbox label="Checked" defaultChecked />
        <Checkbox label="With a hint" hint="Members see this on the clubhouse board." />
        <Checkbox label="Disabled" disabled />
        <Checkbox label="Disabled and checked" disabled defaultChecked />
      </div>
      <div>
        <Switch label="Off" />
        <Switch label="On" defaultChecked />
        <Switch label="Disabled" disabled />
      </div>
    </div>
  );
}

function Cards() {
  return (
    <div className="kit-grid">
      <Card
        title="Subscription"
        action={<StatusPill status="active" />}
        footer="The radio, chat and Ask for a Hand keep working whatever the billing status."
      >
        <p className="kit-text">
          Club plan, {CLUB_PRICING.intervals.year.price}. Renews Feb 10, 2027.
        </p>
      </Card>
      <Card>
        <p className="kit-text">A card with no header: surface-1, a 1 px border, radius-lg.</p>
      </Card>
    </div>
  );
}

function Stats() {
  return (
    <>
      <StatGrid aria-label="Club at a glance">
        <StatTile label="Members" value="12" icon={Users} href="#/_kit" hint="2 guest passes" />
        <StatTile label="Stands" value="8" icon={MapPin} href="#/_kit" />
        <StatTile label="Harvests" value="0" icon={Crosshair} hint="This season" />
        <StatTile
          label="Subscription"
          value="Active"
          icon={CreditCard}
          hint="Renews Feb 10, 2027"
        />
      </StatGrid>
      <Label>Loading</Label>
      <LoadingRegion label="Loading club summary">
        <StatGrid>
          {[1, 2, 3, 4].map((i) => (
            <li key={i}>
              <Skeleton shape="tile" />
            </li>
          ))}
        </StatGrid>
      </LoadingRegion>
    </>
  );
}

interface Member {
  name: string;
  email: string;
  role: Status;
  guestUntil: string;
  you?: boolean;
}

const MEMBERS: readonly Member[] = [
  { name: 'Jake Smith', email: 'jake@example.com', role: 'admin', guestUntil: '', you: true },
  { name: 'Mary Ann Lee', email: 'maryann@example.com', role: 'member', guestUntil: '' },
  { name: 'Bud O’Neil', email: 'bud@example.com', role: 'member', guestUntil: 'Dec 14, 2026' },
];

const COLUMNS: readonly TableColumn<Member>[] = [
  {
    key: 'name',
    header: 'Name',
    sortValue: (m) => m.name,
    cell: (m) => (
      <span className="kit-person">
        <Avatar name={m.name} you={m.you} />
        <span>
          <span className="kit-person__name">{m.name}</span>
          <span className="kit-person__email text-caption">{m.email}</span>
        </span>
      </span>
    ),
  },
  {
    key: 'role',
    header: 'Role',
    sortValue: (m) => m.role,
    cell: (m) => <StatusPill status={m.role} />,
  },
  { key: 'guest', header: 'Guest pass until', cell: (m) => m.guestUntil || 'None' },
];

function Tables() {
  return (
    <>
      <DataTable
        caption="Members"
        columns={COLUMNS}
        rows={MEMBERS}
        rowKey={(m) => m.email}
        initialSort={{ key: 'name', direction: 'ascending' }}
        rowActions={(m) => (
          <Button variant="tertiary" icon={Pencil} iconOnly label={`Edit ${m.name}`} />
        )}
      />
      <Label>Loading</Label>
      <DataTable caption="Stands" columns={COLUMNS} rows={[]} rowKey={(m) => m.email} loading />
      <Label>Empty</Label>
      <DataTable
        caption="Harvests"
        columns={COLUMNS}
        rows={[]}
        rowKey={(m) => m.email}
        empty={
          <EmptyState icon={Crosshair} title="No shared harvests this season" titleAs="h3">
            Members share a harvest from the app after they check out.
          </EmptyState>
        }
      />
    </>
  );
}

function Empty() {
  return (
    <Card>
      <EmptyState
        icon={Users}
        title="Just you so far"
        titleAs="h3"
        action={
          <Button variant="primary" icon={Plus}>
            Invite member
          </Button>
        }
      >
        Invite your members. They scan a code with their phone camera and join the club radio
        channel even with no cell service.
      </EmptyState>
    </Card>
  );
}

function Skeletons() {
  return (
    <LoadingRegion label="Loading roster">
      <Skeleton shape="title" />
      <SkeletonText lines={3} />
    </LoadingRegion>
  );
}

function Toasts() {
  const toast = useToast();
  return (
    <Row>
      <Button onClick={() => toast({ tone: 'success', title: 'Invite link copied' })}>
        Success toast
      </Button>
      <Button
        onClick={() =>
          toast({
            tone: 'info',
            title: 'Map pack building',
            description: 'It will be ready in a few minutes.',
          })
        }
      >
        Info toast
      </Button>
      <Button
        onClick={() =>
          toast({
            tone: 'danger',
            title: 'Could not save',
            description: 'Check your connection and try again.',
          })
        }
      >
        Danger toast
      </Button>
    </Row>
  );
}

const INVITE_LINK = 'https://example.com/join#kit-sample-invite';

function Dialogs() {
  const [open, setOpen] = useState<'invite' | 'confirm' | null>(null);
  const close = () => setOpen(null);
  return (
    <>
      <Row>
        <Button variant="primary" icon={Plus} onClick={() => setOpen('invite')}>
          Invite member
        </Button>
        <Button variant="danger" onClick={() => setOpen('confirm')}>
          Remove member
        </Button>
      </Row>
      <Dialog
        open={open === 'invite'}
        onClose={close}
        title="Invite a member"
        description="They scan the code with their phone camera, or open the link."
        footer={
          <>
            <Button onClick={close}>Done</Button>
            <Button variant="primary" icon={RefreshCw}>
              Make a new invite
            </Button>
          </>
        }
      >
        <Field label="Invite link" hint="Works for 7 days.">
          <Input readOnly value={INVITE_LINK} />
        </Field>
        <div className="kit-row">
          <CopyButton text={INVITE_LINK} label="Copy link" />
        </div>
      </Dialog>
      <Dialog
        open={open === 'confirm'}
        onClose={close}
        title="Remove Bud O’Neil?"
        description="He leaves the club radio channel the next time his phone syncs."
        footer={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="danger-filled" onClick={close}>
              Remove member
            </Button>
          </>
        }
      />
    </>
  );
}

function Badges() {
  return (
    <>
      <Label>Status pills</Label>
      <Row>
        {(Object.keys(STATUSES) as Status[]).map((s) => (
          <StatusPill key={s} status={s} />
        ))}
      </Row>
      <Label>Badge tones</Label>
      <Row>
        {TONES.map((t) => (
          <Badge key={t} tone={t}>
            {t[0]!.toUpperCase() + t.slice(1)}
          </Badge>
        ))}
      </Row>
    </>
  );
}

function TabsDemo() {
  return (
    <Tabs
      label="Stands and areas"
      items={[
        {
          value: 'stands',
          label: 'Stands',
          count: 3,
          content: <p className="kit-text">Stands table goes here.</p>,
        },
        {
          value: 'areas',
          label: 'Areas',
          count: 1,
          content: <p className="kit-text">Areas table goes here.</p>,
        },
      ]}
    />
  );
}

function Headers() {
  return (
    <>
      <PageHeader
        title="Pine Ridge Hunt Club"
        status={<StatusPill status="trial" />}
        description="Everyone in your club and who can do what."
        back={{ href: '#/_kit', label: 'Back to My club' }}
        actions={
          <>
            <Button icon={Download}>Export CSV</Button>
            <Button variant="primary" icon={Plus}>
              Invite member
            </Button>
          </>
        }
      />
      <PageHeader title="Billing" description="Your club's plan, payment and invoices." />
    </>
  );
}

function Avatars() {
  return (
    <Row>
      <Avatar name="Jake Smith" size="sm" />
      <Avatar name="Mary Ann Lee" />
      <Avatar name="bud.oneil@example.com" size="lg" />
      <Avatar name="Jake Smith" you label="You, Jake Smith" />
    </Row>
  );
}

function Banners() {
  return (
    <div className="kit-stack">
      <Banner tone="info" title="Draw your property line in the app first">
        Map packs cover the property line, so the app needs it before a pack can be built.
      </Banner>
      <Banner tone="warning">Features stay on until Feb 24 while you renew.</Banner>
      <Banner tone="danger" title="Payment failed" action={<Button>Manage subscription</Button>}>
        Update your card to keep club features on.
      </Banner>
      <Banner tone="success">Your club is ready.</Banner>
    </div>
  );
}

function Copy() {
  return (
    <Row>
      <CopyButton text={INVITE_LINK} label="Copy link" />
      <CopyButton text="HCM-4821" label="Copy code" variant="tertiary" />
    </Row>
  );
}

function Tooltips() {
  return (
    <Row>
      <Tooltip content="Shown on hover and keyboard focus">
        <Button variant="tertiary" icon={RefreshCw}>
          Hover or focus me
        </Button>
      </Tooltip>
    </Row>
  );
}

export interface KitSection {
  id: string;
  title: string;
  Demo: () => ReactNode;
}

/** The kit's sections, in page order: one per component (section 6 of the brief). */
export const KIT_SECTIONS: readonly KitSection[] = [
  { id: 'button', title: 'Button', Demo: Buttons },
  { id: 'field', title: 'Field, Input, Select, Textarea', Demo: Fields },
  { id: 'radio', title: 'RadioGroup and Segmented', Demo: Choices },
  { id: 'checkbox', title: 'Checkbox and Switch', Demo: Checks },
  { id: 'card', title: 'Card', Demo: Cards },
  { id: 'stat-tile', title: 'StatTile', Demo: Stats },
  { id: 'data-table', title: 'DataTable', Demo: Tables },
  { id: 'empty-state', title: 'EmptyState', Demo: Empty },
  { id: 'skeleton', title: 'Skeleton', Demo: Skeletons },
  { id: 'toast', title: 'Toast', Demo: Toasts },
  { id: 'dialog', title: 'Dialog', Demo: Dialogs },
  { id: 'badge', title: 'Badge and StatusPill', Demo: Badges },
  { id: 'tabs', title: 'Tabs', Demo: TabsDemo },
  { id: 'page-header', title: 'PageHeader', Demo: Headers },
  { id: 'avatar', title: 'Avatar', Demo: Avatars },
  { id: 'banner', title: 'Banner', Demo: Banners },
  { id: 'copy-button', title: 'CopyButton', Demo: Copy },
  { id: 'theme-toggle', title: 'ThemeToggle', Demo: () => <ThemeToggle /> },
  { id: 'tooltip', title: 'Tooltip', Demo: Tooltips },
];
