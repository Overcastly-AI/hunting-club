import { CHECK_IN_MODE_KEYS } from '@huntclub/mesh';

import type { Migration } from './types';

/**
 * Local tables from docs/SPEC.md, "Local data model (on the phone)".
 *
 * Conventions:
 * - IDs are UUID strings; Meshtastic node IDs are integers.
 * - Times are integer milliseconds since the Unix epoch.
 * - Records that sync with the cloud carry `updated_at` (last write wins).
 * - Booleans are INTEGER 0/1.
 * - Mesh-sourced rows (check-ins, positions, messages, help requests) have no
 *   foreign keys: they can arrive before the member or group they refer to.
 */
const initialSchema = `
CREATE TABLE groups (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('party', 'club')),
  name TEXT NOT NULL,
  channel_key BLOB,
  region TEXT,
  overdue_grace_minutes INTEGER NOT NULL DEFAULT 30,
  entitlement_token TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE members (
  id TEXT PRIMARY KEY NOT NULL,
  group_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  initials TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'guest')),
  node_id INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX members_group_id ON members (group_id);
CREATE INDEX members_node_id ON members (node_id);

CREATE TABLE radios (
  node_id INTEGER PRIMARY KEY NOT NULL,
  member_id TEXT,
  hardware_model TEXT,
  battery_level INTEGER,
  last_heard_at INTEGER,
  last_snr REAL
);

CREATE TABLE areas (
  id TEXT PRIMARY KEY NOT NULL,
  club_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  boundary TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
CREATE INDEX areas_club_id ON areas (club_id);

CREATE TABLE stands (
  id TEXT PRIMARY KEY NOT NULL,
  club_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  area_id TEXT REFERENCES areas (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('tree_stand', 'ladder', 'ground_blind')),
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
CREATE INDEX stands_club_id ON stands (club_id);

CREATE TABLE check_ins (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('stand', 'area', 'spot', 'moving')),
  stand_id TEXT,
  area_id TEXT,
  pin_lat REAL,
  pin_lon REAL,
  pin_name TEXT,
  checked_in_at INTEGER NOT NULL,
  checked_out_at INTEGER,
  overdue_alert_sent_at INTEGER,
  updated_at INTEGER NOT NULL
);
-- One open check-in per member.
CREATE UNIQUE INDEX check_ins_one_open_per_member
  ON check_ins (member_id) WHERE checked_out_at IS NULL;

-- Last known position only; no location history.
CREATE TABLE positions (
  node_id INTEGER PRIMARY KEY NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  accuracy REAL,
  received_at INTEGER NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('club', 'party', 'direct')),
  sender TEXT NOT NULL,
  body TEXT NOT NULL CHECK (length(body) <= 200),
  sent_at INTEGER NOT NULL,
  delivered_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX messages_channel_sent_at ON messages (channel, sent_at);

CREATE TABLE help_requests (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  created_at INTEGER NOT NULL,
  acknowledged_by TEXT,
  resolved_at INTEGER
);

CREATE TABLE harvests (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL,
  species TEXT NOT NULL,
  sex TEXT,
  lat REAL,
  lon REAL,
  stand_id TEXT,
  area_id TEXT,
  notes TEXT,
  photo_uri TEXT,
  shared_with TEXT NOT NULL DEFAULT 'none' CHECK (shared_with IN ('none', 'party', 'club')),
  harvested_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE map_packs (
  id TEXT PRIMARY KEY NOT NULL,
  bounds TEXT NOT NULL,
  min_zoom INTEGER NOT NULL,
  max_zoom INTEGER NOT NULL,
  source TEXT NOT NULL,
  size_bytes INTEGER,
  downloaded_at INTEGER
);
`;

/**
 * Offline map downloads (Milestone 4). `map_packs.id` is the MapLibre offline
 * pack ID. `bounds` is JSON [west, south, east, north]; zooms are map zooms.
 */
const mapPackDownloads = `
ALTER TABLE map_packs ADD COLUMN name TEXT NOT NULL DEFAULT 'Downloaded area';
ALTER TABLE map_packs ADD COLUMN tile_count INTEGER;
ALTER TABLE map_packs ADD COLUMN status TEXT NOT NULL DEFAULT 'complete'
  CHECK (status IN ('downloading', 'complete', 'failed'));
ALTER TABLE map_packs ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
`;

/**
 * The radio this phone is paired with, so the app reconnects to it on launch.
 * One row at most: one phone talks to one radio at a time.
 */
const pairedRadio = `
CREATE TABLE paired_radio (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  peripheral_id TEXT NOT NULL,
  name TEXT NOT NULL,
  paired_at INTEGER NOT NULL
);
`;

/**
 * Harvest log (Milestone 7). Where a harvest happened is kept as the check-in
 * at the time: mode and the stand/area mesh ids (so it can be shared later)
 * and the place label shown in the list. `shared_at` is when it was last sent.
 */
const sqlList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');

const harvestPlaces = `
ALTER TABLE harvests ADD COLUMN place_mode TEXT CHECK (place_mode IN (${sqlList(Object.values(CHECK_IN_MODE_KEYS))}));
ALTER TABLE harvests ADD COLUMN place_label TEXT;
ALTER TABLE harvests ADD COLUMN stand_mesh_id INTEGER;
ALTER TABLE harvests ADD COLUMN area_mesh_id INTEGER;
ALTER TABLE harvests ADD COLUMN shared_at INTEGER;
`;

/**
 * One row of app-wide state on this phone. `onboarded_at` is set when the
 * hunter finishes (or skips the rest of) onboarding, so it shows only once.
 */
const appState = `
CREATE TABLE app_state (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  onboarded_at INTEGER
);
INSERT INTO app_state (id) VALUES (1);
`;

/** The hunter's own name and initials (onboarding step "Enter your name"). */
const myProfile = `
ALTER TABLE app_state ADD COLUMN display_name TEXT;
ALTER TABLE app_state ADD COLUMN initials TEXT;
`;

/**
 * The free party this phone is in (core PartyService's StoredParty, as JSON).
 * One row at most. It holds the party's join link, which contains the channel
 * key: never log it.
 */
const freeParty = `
CREATE TABLE party (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  data TEXT NOT NULL
);
`;

export const migrations: readonly Migration[] = [
  { version: 1, name: 'initial local schema', sql: initialSchema },
  { version: 2, name: 'map pack downloads', sql: mapPackDownloads },
  { version: 3, name: 'paired radio', sql: pairedRadio },
  { version: 4, name: 'harvest places', sql: harvestPlaces },
  { version: 5, name: 'app state', sql: appState },
  { version: 6, name: 'my profile', sql: myProfile },
  { version: 7, name: 'free party', sql: freeParty },
];
