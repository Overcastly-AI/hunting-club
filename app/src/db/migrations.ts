import { CHECK_IN_MODE_KEYS, MAX_TEXT_CHARS } from '@huntclub/mesh';
import { DEFAULT_THEME_PREFERENCE, THEME_PREFERENCES } from '@huntclub/design';
import { MEMBER_ROLES, STAND_TYPES } from '@huntclub/shared';

import { CHAT_ITEM_KINDS, SEND_STATES } from '../chat/model';
import { AUDIENCES } from '../domain/audience';
import { SHARE_TARGETS } from '../harvest/harvests';
import { MAP_PACK_STATUSES } from '../map/mapPacks';
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
/** A SQL `IN (...)` list from a shared constant, so CHECKs never retype the values. */
const sqlList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');

const initialSchema = `
CREATE TABLE groups (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (${sqlList(AUDIENCES)})),
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
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN (${sqlList(MEMBER_ROLES)})),
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
  type TEXT NOT NULL CHECK (type IN (${sqlList(STAND_TYPES)})),
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
  mode TEXT NOT NULL CHECK (mode IN (${sqlList(Object.values(CHECK_IN_MODE_KEYS))})),
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
  body TEXT NOT NULL CHECK (length(body) <= ${MAX_TEXT_CHARS}),
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
  shared_with TEXT NOT NULL DEFAULT 'none' CHECK (shared_with IN (${sqlList(SHARE_TARGETS)})),
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
  CHECK (status IN (${sqlList(MAP_PACK_STATUSES)}));
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

/**
 * Club layer (Milestone 9): this phone's membership and cached entitlement on the
 * club's group row, an invite waiting to be redeemed when online, and the server's
 * mesh ids for stands and areas (what check-ins send over the radio).
 */
const clubMembership = `
ALTER TABLE groups ADD COLUMN my_user_id TEXT;
ALTER TABLE groups ADD COLUMN my_role TEXT CHECK (my_role IN (${sqlList(MEMBER_ROLES)}));
ALTER TABLE groups ADD COLUMN subscription_status TEXT;
ALTER TABLE groups ADD COLUMN features_until INTEGER;
ALTER TABLE groups ADD COLUMN pending_invite TEXT;
ALTER TABLE groups ADD COLUMN pending_display_name TEXT;
ALTER TABLE groups ADD COLUMN pending_initials TEXT;
ALTER TABLE groups ADD COLUMN synced_at INTEGER;
ALTER TABLE stands ADD COLUMN mesh_id INTEGER;
ALTER TABLE areas ADD COLUMN mesh_id INTEGER;
CREATE UNIQUE INDEX stands_club_mesh_id ON stands (club_id, mesh_id);
CREATE UNIQUE INDEX areas_club_mesh_id ON areas (club_id, mesh_id);
`;

/**
 * Chat history (texts and system cards), kept across app restarts. Replaces
 * the unused `messages` table from version 1. One row per (kind, sender,
 * message id): the mesh's de-duplication key (packet id for texts, app
 * message id for system cards). `extra` is JSON for display only (sender
 * name, place, system event). Bodies are stored, never logged.
 */
const chatHistory = `
DROP INDEX messages_channel_sent_at;
DROP TABLE messages;

CREATE TABLE chat_messages (
  kind TEXT NOT NULL CHECK (kind IN (${sqlList(CHAT_ITEM_KINDS)})),
  sender INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  conversation TEXT NOT NULL,
  body TEXT NOT NULL CHECK (kind <> 'text' OR length(body) <= ${MAX_TEXT_CHARS}),
  at INTEGER NOT NULL,
  mine INTEGER NOT NULL DEFAULT 0,
  send_state TEXT CHECK (send_state IN (${sqlList(SEND_STATES)})),
  delivered_to INTEGER,
  delivered_of INTEGER,
  extra TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (kind, sender, message_id)
);
CREATE INDEX chat_messages_conversation_at ON chat_messages (conversation, at);
`;

/**
 * Club map packs downloaded to this phone (PMTiles archives the club's builder
 * made, Milestone 12): the newest ready pack per club and tile source. The
 * archive itself is a file in the app's documents folder (local_uri).
 */
const clubMapPacks = `
CREATE TABLE club_map_packs (
  club_id TEXT NOT NULL,
  source TEXT NOT NULL,
  pack_id TEXT NOT NULL,
  bounds TEXT NOT NULL,
  min_zoom INTEGER NOT NULL,
  max_zoom INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL,
  built_at TEXT NOT NULL,
  local_uri TEXT NOT NULL,
  downloaded_at INTEGER NOT NULL,
  PRIMARY KEY (club_id, source)
);
`;

/** The hunter's theme choice (Settings → Theme): follow the phone, or always dark or light. */
const themePreference = `
ALTER TABLE app_state ADD COLUMN theme_preference TEXT NOT NULL DEFAULT '${DEFAULT_THEME_PREFERENCE}'
  CHECK (theme_preference IN (${sqlList(THEME_PREFERENCES)}));
`;

/**
 * When the hunter chose "Skip for now" on the name prompt at their first check-in, so it
 * is not asked again (they can still set a name on the Party tab).
 */
const nameSkipped = `
ALTER TABLE app_state ADD COLUMN name_skipped_at INTEGER;
`;

/**
 * The hunter's latest name waiting to reach their clubs (club/nameSync.ts): one row at most,
 * replaced by each edit, removed once every club has it.
 */
const pendingNameSync = `
CREATE TABLE pending_name_sync (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  display_name TEXT NOT NULL,
  initials TEXT NOT NULL,
  queued_at INTEGER NOT NULL
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
  { version: 8, name: 'club membership and mesh ids', sql: clubMembership },
  { version: 9, name: 'chat history', sql: chatHistory },
  { version: 10, name: 'club map packs', sql: clubMapPacks },
  { version: 11, name: 'theme preference', sql: themePreference },
  { version: 12, name: 'name prompt skipped', sql: nameSkipped },
  { version: 13, name: 'pending name sync', sql: pendingNameSync },
];
