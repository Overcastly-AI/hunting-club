import type { HarvestSex } from '@huntclub/shared';
import {
  CHECK_IN_MODE_BY_KEY,
  CHECK_IN_MODE_KEYS,
  type CheckInMode,
  type LatLon,
} from '@huntclub/mesh';

import type { SqlDatabase } from '../db/types';
import { AUDIENCES } from '../domain/audience';

/** Who a harvest is shared with (the `harvests.shared_with` column's values). */
export const SHARE_TARGETS = ['none', ...AUDIENCES] as const;
export type SharedWith = (typeof SHARE_TARGETS)[number];

/** A harvest in this phone's log. Private unless shared. */
export type LocalHarvest = {
  id: string;
  species: string;
  sex: HarvestSex;
  pin?: LatLon;
  placeMode?: CheckInMode;
  placeLabel?: string;
  standMeshId?: number;
  areaMeshId?: number;
  notes?: string;
  sharedWith: SharedWith;
  sharedAt?: number;
  harvestedAt: number;
};

/** Free users have no account; their own records use this member id. */
export const SELF_MEMBER_ID = 'self';

type Row = {
  id: string;
  species: string;
  sex: HarvestSex | null;
  lat: number | null;
  lon: number | null;
  place_mode: keyof typeof CHECK_IN_MODE_BY_KEY | null;
  place_label: string | null;
  stand_mesh_id: number | null;
  area_mesh_id: number | null;
  notes: string | null;
  shared_with: SharedWith;
  shared_at: number | null;
  harvested_at: number;
};

const opt = <K extends string, V>(key: K, value: V | null | undefined) =>
  (value === null || value === undefined ? {} : { [key]: value }) as Partial<Record<K, V>>;

function fromRow(r: Row): LocalHarvest {
  return {
    id: r.id,
    species: r.species,
    sex: r.sex ?? 'unknown',
    ...(r.lat !== null && r.lon !== null ? { pin: { lat: r.lat, lon: r.lon } } : {}),
    ...opt('placeMode', r.place_mode === null ? null : CHECK_IN_MODE_BY_KEY[r.place_mode]),
    ...opt('placeLabel', r.place_label),
    ...opt('standMeshId', r.stand_mesh_id),
    ...opt('areaMeshId', r.area_mesh_id),
    ...opt('notes', r.notes),
    sharedWith: r.shared_with,
    ...opt('sharedAt', r.shared_at),
    harvestedAt: r.harvested_at,
  };
}

/** A version 4 UUID made by SQLite (works with no radio and no crypto module). */
const SQL_UUID = `lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))`;

export type NewHarvest = Omit<LocalHarvest, 'id'>;

/** Saves a new harvest and returns its id. */
export async function insertHarvest(db: SqlDatabase, h: NewHarvest, now: number): Promise<string> {
  const row = await db.getFirstAsync<{ id: string }>(
    `INSERT INTO harvests
       (id, member_id, species, sex, lat, lon, place_mode, place_label, stand_mesh_id, area_mesh_id,
        notes, shared_with, shared_at, harvested_at, updated_at)
     VALUES (${SQL_UUID}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    SELF_MEMBER_ID,
    h.species,
    h.sex,
    h.pin?.lat ?? null,
    h.pin?.lon ?? null,
    h.placeMode === undefined ? null : CHECK_IN_MODE_KEYS[h.placeMode],
    h.placeLabel ?? null,
    h.standMeshId ?? null,
    h.areaMeshId ?? null,
    h.notes ?? null,
    h.sharedWith,
    h.sharedAt ?? null,
    h.harvestedAt,
    now,
  );
  if (!row) throw new Error('Harvest was not saved');
  return row.id;
}

export async function markShared(
  db: SqlDatabase,
  id: string,
  sharedWith: SharedWith,
  at: number,
): Promise<void> {
  await db.runAsync(
    `UPDATE harvests SET shared_with = ?, shared_at = ?, updated_at = ? WHERE id = ?`,
    sharedWith,
    sharedWith === 'none' ? null : at,
    at,
    id,
  );
}

/** Our own harvests, newest first. */
export async function listHarvests(db: SqlDatabase): Promise<LocalHarvest[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT id, species, sex, lat, lon, place_mode, place_label, stand_mesh_id, area_mesh_id,
            notes, shared_with, shared_at, harvested_at
     FROM harvests WHERE member_id = ? ORDER BY harvested_at DESC, id`,
    SELF_MEMBER_ID,
  );
  return rows.map(fromRow);
}
