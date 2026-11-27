import {
  ClipboardList,
  CreditCard,
  Download,
  Map as MapIcon,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { lazy, type ReactNode } from 'react';
import type { ClubApi } from '../api/types';
import { standIcon } from '../components/standIcons';

// Each admin page loads on first visit (the roster also pulls in the mesh codec and QR encoder).
const MyClub = lazy(() => import('../pages/MyClub').then((m) => ({ default: m.MyClub })));
const Roster = lazy(() => import('../pages/Roster').then((m) => ({ default: m.Roster })));
const StandsAndAreas = lazy(() =>
  import('../pages/StandsAndAreas').then((m) => ({ default: m.StandsAndAreas })),
);
const Harvests = lazy(() => import('../pages/Harvests').then((m) => ({ default: m.Harvests })));
const MapPacks = lazy(() => import('../pages/MapPacks').then((m) => ({ default: m.MapPacks })));
const Billing = lazy(() => import('../pages/Billing').then((m) => ({ default: m.Billing })));

export interface AdminPage {
  path: string;
  /** The page's name: its title and its nav item on desktop. */
  label: string;
  /** The start of `label` that the tablet rail and the phone tab bar show (14 px labels). */
  shortLabel?: string;
  icon: LucideIcon;
  /** On phones the page sits in the More sheet, not in the tab bar. */
  inMore?: boolean;
  /** The map is the page: no content column or padding (the page lays itself out). */
  bleed?: boolean;
  render: (api: ClubApi) => ReactNode;
}

/**
 * Pages reachable once signed in, in navigation order (hash routes: no server rewrites).
 * My club is the map; Stands and areas wears the ladder stand's icon (as in the mockups);
 * Harvests is ClipboardList, never Crosshair.
 */
export const PAGES = [
  {
    path: 'club',
    label: 'My club',
    icon: MapIcon,
    bleed: true,
    render: (api: ClubApi) => <MyClub api={api} />,
  },
  { path: 'roster', label: 'Roster', icon: Users, render: (api: ClubApi) => <Roster api={api} /> },
  {
    path: 'stands',
    label: 'Stands and areas',
    shortLabel: 'Stands',
    icon: standIcon('ladder'),
    render: (api: ClubApi) => <StandsAndAreas api={api} />,
  },
  {
    path: 'harvests',
    label: 'Harvests',
    icon: ClipboardList,
    render: (api: ClubApi) => <Harvests api={api} />,
  },
  {
    path: 'maps',
    label: 'Map packs',
    icon: Download,
    inMore: true,
    render: (api: ClubApi) => <MapPacks api={api} />,
  },
  {
    path: 'billing',
    label: 'Billing',
    icon: CreditCard,
    inMore: true,
    render: (api: ClubApi) => <Billing api={api} />,
  },
] as const satisfies readonly AdminPage[];

export type PagePath = (typeof PAGES)[number]['path'];

/** The first page: no hash, and where sign-out returns to. */
export const HOME_PATH: PagePath = PAGES[0].path;

/** A page's hash link: `#/roster`. */
export const pageHref = (path: PagePath) => `#/${path}`;

/** The page the hash names; no hash is the first page, and an unknown one is null (Page not found). */
export function currentPath(): PagePath | null {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash === '') return HOME_PATH;
  return PAGES.find((p) => p.path === hash)?.path ?? null;
}
