// Keyboard behaviour of every component. jsdom has no default actions for keys (Space does
// not toggle a checkbox there), so native controls are checked for being native, focusable
// and reachable in tab order, and for reacting to the activation the key would cause; Radix
// widgets get real key events. The same walkthrough runs with a real keyboard in Chromium on
// the kit page (see the P1b notes).
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from '@huntclub/design';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Plus, RefreshCw } from 'lucide-react';
import {
  Avatar,
  Badge,
  Banner,
  Button,
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
  StatGrid,
  StatTile,
  StatusPill,
  Switch,
  Tabs,
  Textarea,
  ThemeToggle,
  useToast,
} from '..';
import { renderInPage, renderKitSection } from './kit';

/** Every element a Tab press can reach, in DOM order (tabIndex 0 or more, not disabled). */
const tabStops = (root: HTMLElement) =>
  [
    ...root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]'),
  ].filter((el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled);

describe('Button', () => {
  it('is a native button in tab order, so Enter and Space activate it', () => {
    const onClick = vi.fn();
    renderInPage(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveProperty('type', 'button');
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('stays focusable while loading, is busy, and ignores activation', () => {
    const onClick = vi.fn();
    renderInPage(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('names an icon-only button and shows its tooltip on keyboard focus', async () => {
    renderInPage(<Button iconOnly icon={RefreshCw} label="Refresh" />);
    const button = screen.getByRole('button', { name: 'Refresh' });
    act(() => button.focus());
    expect(await screen.findByRole('tooltip')).toHaveProperty('textContent', 'Refresh');
  });
});

describe('Field, Input, Select, Textarea', () => {
  it('labels each control, describes it by hint and error, and keeps it in tab order', () => {
    const { container } = renderInPage(
      <>
        <Field label="Email" hint="We'll email you a code.">
          <Input />
        </Field>
        <Field label="Season" error="Pick a season.">
          <Select options={[{ value: 'a', label: '2026-27 season' }]} />
        </Field>
        <Field label="Note">
          <Textarea />
        </Field>
      </>,
    );
    const email = screen.getByRole('textbox', { name: 'Email' });
    expect(screen.getByText("We'll email you a code.").id).toBe(
      email.getAttribute('aria-describedby'),
    );
    const season = screen.getByRole('combobox', { name: 'Season' });
    expect(season.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Pick a season.').closest('[id]')!.id).toBe(
      season.getAttribute('aria-describedby'),
    );
    expect(tabStops(container)).toEqual([
      email,
      season,
      screen.getByRole('textbox', { name: 'Note' }),
    ]);
  });
});

describe('RadioGroup and Segmented', () => {
  it.each([
    ['RadioGroup', RadioGroup],
    ['Segmented', Segmented],
  ] as const)('%s: one native radio group, so arrow keys move the choice', (_name, Group) => {
    const onChange = vi.fn();
    renderInPage(
      <Group
        legend="Map style"
        value="topo"
        onChange={onChange}
        options={[
          { value: 'topo', label: 'Topo' },
          { value: 'aerial', label: 'Aerial' },
        ]}
      />,
    );
    const group = screen.getByRole('group', { name: 'Map style' });
    const [topo, aerial] = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(topo!.name).toBe(aerial!.name);
    expect(topo!.checked).toBe(true);
    // An arrow key checks the next radio in the group (the browser's default action).
    fireEvent.click(aerial!);
    expect(onChange).toHaveBeenCalledWith('aerial');
  });
});

describe('Checkbox and Switch', () => {
  it('are native checkboxes (Space toggles), the switch with role="switch"', () => {
    const { container } = renderInPage(
      <>
        <Checkbox label="Show on the board" />
        <Switch label="Notifications" />
        <Checkbox label="Disabled" disabled />
      </>,
    );
    const box = screen.getByRole('checkbox', { name: 'Show on the board' }) as HTMLInputElement;
    const sw = screen.getByRole('switch', { name: 'Notifications' }) as HTMLInputElement;
    expect(tabStops(container)).toEqual([box, sw]);
    fireEvent.click(box);
    fireEvent.click(sw);
    expect([box.checked, sw.checked]).toEqual([true, true]);
  });
});

describe('Card, StatTile', () => {
  it('a card adds no tab stops of its own; a linked tile is one link', () => {
    const { container } = renderInPage(
      <>
        <Card title="Subscription" action={<Button>Manage</Button>}>
          Text
        </Card>
        <StatGrid>
          <StatTile label="Members" value="12" href="#/roster" />
          <StatTile label="Areas" value="2" />
        </StatGrid>
      </>,
    );
    const link = screen.getByRole('link', { name: /Members\s*12/ });
    expect(tabStops(container)).toEqual([screen.getByRole('button', { name: 'Manage' }), link]);
  });
});

describe('DataTable', () => {
  const columns = [
    {
      key: 'name',
      header: 'Name',
      cell: (r: { name: string }) => r.name,
      sortValue: (r: { name: string }) => r.name,
    },
  ];
  const rows = [{ name: 'Bud' }, { name: 'Amy' }];

  it('sorts from a header button (Enter), updating aria-sort, and scrolls in a focusable region', () => {
    renderInPage(
      <DataTable caption="Members" columns={columns} rows={rows} rowKey={(r) => r.name} />,
    );
    const region = screen.getByRole('region', { name: 'Members' });
    expect(region.tabIndex).toBe(0);
    const header = screen.getByRole('columnheader', { name: /Name/ });
    expect(header.getAttribute('aria-sort')).toBe('none');
    fireEvent.click(within(header).getByRole('button'));
    expect(header.getAttribute('aria-sort')).toBe('ascending');
    expect(screen.getAllByRole('cell').map((c) => c.textContent)).toEqual(['Amy', 'Bud']);
    fireEvent.click(within(header).getByRole('button'));
    expect(header.getAttribute('aria-sort')).toBe('descending');
  });

  it('while loading, rows are hidden and a status is read instead', () => {
    renderInPage(
      <DataTable caption="Stands" columns={columns} rows={[]} rowKey={(r) => r.name} loading />,
    );
    expect(screen.getByRole('status').textContent).toBe('Loading stands');
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true');
  });
});

describe('EmptyState, Skeleton, Badge, Avatar, Banner', () => {
  it('add no tab stops except the one action', () => {
    const { container } = renderInPage(
      <>
        <EmptyState icon={Plus} title="Just you so far" action={<Button>Invite member</Button>} />
        <LoadingRegion label="Loading roster">
          <Skeleton />
        </LoadingRegion>
        <Badge tone="info">New</Badge>
        <StatusPill status="pastDue" />
        <Avatar name="Jake Smith" />
        <Banner tone="danger">Payment failed.</Banner>
      </>,
    );
    expect(tabStops(container)).toEqual([screen.getByRole('button', { name: 'Invite member' })]);
    expect(screen.getByRole('status').textContent).toBe('Loading roster');
  });
});

describe('Tabs', () => {
  it('moves between tabs with the arrow keys, Home and End', async () => {
    renderKitSection('tabs');
    const stands = screen.getByRole('tab', { name: 'Stands (3)' });
    const areas = screen.getByRole('tab', { name: 'Areas (1)' });
    act(() => stands.focus());
    fireEvent.keyDown(stands, { key: 'ArrowRight' });
    await waitFor(() => expect(areas.getAttribute('aria-selected')).toBe('true'));
    fireEvent.keyDown(areas, { key: 'Home' });
    await waitFor(() => expect(stands.getAttribute('aria-selected')).toBe('true'));
    fireEvent.keyDown(stands, { key: 'End' });
    await waitFor(() => expect(document.activeElement).toBe(areas));
  });
});

describe('Dialog', () => {
  function Harness(props: { onClose: () => void }) {
    return (
      <Dialog open onClose={props.onClose} title="Remove member?" footer={<Button>Cancel</Button>}>
        <p>Body</p>
      </Dialog>
    );
  }

  it('opens modal with focus on the dialog, and Esc (cancel) asks to close', () => {
    const onClose = vi.fn();
    renderInPage(<Harness onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Remove member?' });
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(document.activeElement).toBe(dialog);
    expect(document.documentElement.classList.contains('ui-scroll-lock')).toBe(true);
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the named close button, and unlocks the page when closed', () => {
    const onClose = vi.fn();
    const { unmount } = renderInPage(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.documentElement.classList.contains('ui-scroll-lock')).toBe(false);
  });
});

describe('Toast', () => {
  function Trigger(props: { tone: 'success' | 'danger' }) {
    const toast = useToast();
    return (
      <Button onClick={() => toast({ tone: props.tone, title: `A ${props.tone} toast` })}>
        Show
      </Button>
    );
  }

  it('a danger toast is an alert; Esc dismisses it', async () => {
    renderInPage(<Trigger tone="danger" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect((await screen.findByRole('alert')).textContent).toBe('A danger toast');
    const toast = screen.getByRole('alert').closest('li')!;
    fireEvent.keyDown(toast, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('a success toast is announced through a status region and closes from its button', async () => {
    renderInPage(<Trigger tone="success" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('A success toast'),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText('A success toast')).toBeNull());
  });
});

describe('PageHeader', () => {
  it('has one h1 that takes focus programmatically only, a back link, and its actions', () => {
    const { container } = renderInPage(
      <PageHeader
        title="Roster"
        back={{ href: '#/club', label: 'My club' }}
        actions={<Button variant="primary">Invite member</Button>}
      />,
    );
    const h1 = screen.getByRole('heading', { level: 1, name: 'Roster' });
    expect(h1.tabIndex).toBe(-1);
    expect(tabStops(container)).toEqual([
      screen.getByRole('link', { name: 'My club' }),
      screen.getByRole('button', { name: 'Invite member' }),
    ]);
  });
});

describe('CopyButton', () => {
  it('copies on activation and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onCopied = vi.fn();
    renderInPage(
      <CopyButton text="https://example.com/join" label="Copy link" onCopied={onCopied} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith('https://example.com/join');
    expect(onCopied).toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('Copied');
  });
});

describe('ThemeToggle', () => {
  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  });

  it('is a radio group (arrow keys); choosing applies and keeps the theme', () => {
    renderInPage(<ThemeToggle />);
    const group = screen.getByRole('group', { name: 'Theme' });
    expect(within(group).getByRole('radio', { name: 'System' })).toHaveProperty('checked', true);
    fireEvent.click(within(group).getByRole('radio', { name: 'Light' }));
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    fireEvent.click(within(group).getByRole('radio', { name: 'System' }));
    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });
});
