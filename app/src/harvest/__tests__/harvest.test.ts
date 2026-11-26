import type { HarvestSharer, OpenCheckIn } from '@huntclub/core';
import { CheckInMode, type DeliveryResult } from '@huntclub/mesh';
import { NOTES_MAX, SPECIES_MAX } from '@huntclub/shared';

import { migrate } from '../../db/migrate';
import { migrations } from '../../db/migrations';
import { createMigratedTestDatabase, createTestDatabase } from '../../test-utils/nodeSqlite';
import { EMPTY_DRAFT, draftProblem, harvestFromDraft, harvestToShare, shareChoices } from '../form';
import { shareHarvest, type HarvestRadio } from '../HarvestRadio';
import { insertHarvest, listHarvests, markShared, type NewHarvest } from '../harvests';

// Compile-time check: core's sharer is what RadioProvider will pass.
type Fits<T, U extends T> = U;
export type SharerFits = Fits<HarvestRadio['sharer'], HarvestSharer>;

const NOW = Date.UTC(2026, 10, 30, 12);
const PIN = { lat: 40.79, lon: -77.86 };
const atStand: OpenCheckIn = {
  placement: { mode: CheckInMode.Stand, standId: 7, pin: PIN },
  messageId: 1,
  checkedInAt: NOW - 3_600_000,
  modeSince: NOW - 3_600_000,
};

const deer: NewHarvest = {
  species: 'Deer',
  sex: 'male',
  pin: PIN,
  placeMode: CheckInMode.Stand,
  placeLabel: 'Club stand',
  standMeshId: 7,
  notes: '8 point',
  sharedWith: 'none',
  harvestedAt: NOW,
};

describe('harvest form', () => {
  it('needs a species within the shared limit and notes within the shared limit', () => {
    expect(draftProblem(EMPTY_DRAFT)).toBe('Pick or type a species');
    expect(draftProblem({ ...EMPTY_DRAFT, species: 'x'.repeat(SPECIES_MAX + 1) })).toMatch(
      /40 characters/,
    );
    expect(
      draftProblem({ ...EMPTY_DRAFT, species: 'Deer', notes: 'n'.repeat(NOTES_MAX + 1) }),
    ).toMatch(/notes/);
    expect(draftProblem({ ...EMPTY_DRAFT, species: ' Deer ' })).toBeNull();
  });

  it('fills where from the check-in and saves private', () => {
    expect(
      harvestFromDraft(
        { species: ' Deer ', sex: 'male', notes: ' 8 point ', share: 'party' },
        atStand,
        NOW,
      ),
    ).toEqual(deer);
    expect(harvestFromDraft({ ...EMPTY_DRAFT, species: 'Turkey' }, null, NOW)).toEqual({
      species: 'Turkey',
      sex: 'unknown',
      sharedWith: 'none',
      harvestedAt: NOW,
    });
  });

  it('offers Club sharing only to club members', () => {
    expect(shareChoices('party')).toEqual(['none', 'party']);
    expect(shareChoices('club')).toEqual(['none', 'party', 'club']);
  });

  it('shares species, sex, where and the note', () => {
    expect(harvestToShare({ ...deer, id: 'h' })).toEqual({
      species: 'Deer',
      sex: 'male',
      note: '8 point',
      placement: { mode: CheckInMode.Stand, standId: 7, pin: PIN },
    });
  });
});

describe('harvest storage', () => {
  it('saves with a UUID made on the phone, lists newest first and marks shares', async () => {
    const db = await createMigratedTestDatabase();
    const first = await insertHarvest(db, deer, NOW);
    const second = await insertHarvest(
      db,
      { species: 'Turkey', sex: 'unknown', sharedWith: 'none', harvestedAt: NOW + 1 },
      NOW,
    );
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);

    await markShared(db, first, 'party', NOW + 5);
    const [turkey, saved] = await listHarvests(db);
    expect(turkey).toEqual({
      id: second,
      species: 'Turkey',
      sex: 'unknown',
      sharedWith: 'none',
      harvestedAt: NOW + 1,
    });
    expect(saved).toEqual({ ...deer, id: first, sharedWith: 'party', sharedAt: NOW + 5 });
  });
});

describe('migration 3: harvest places', () => {
  it('upgrades a version 2 database, keeps harvests private by default and checks the mode', async () => {
    const db = createTestDatabase();
    await migrate(db, migrations.slice(0, 2));
    db.raw
      .prepare(
        `INSERT INTO harvests (id, member_id, species, harvested_at, updated_at) VALUES ('old', 'self', 'Deer', 1, 1)`,
      )
      .run();
    await expect(migrate(db, migrations)).resolves.toBe(migrations.length);
    expect(
      db.raw.prepare(`SELECT shared_with, place_mode FROM harvests WHERE id = 'old'`).get(),
    ).toEqual({
      shared_with: 'none',
      place_mode: null,
    });
    expect(() =>
      db.raw.prepare(`UPDATE harvests SET place_mode = 'driving' WHERE id = 'old'`).run(),
    ).toThrow(/CHECK/);
  });
});

describe('shareHarvest', () => {
  const radio = (result: DeliveryResult, sent: unknown[]) =>
    ({
      audience: 'party',
      channelOf: () => 0,
      sharer: {
        share: (h, channel) => {
          sent.push([h, channel]);
          return { id: 1, result: Promise.resolve(result) };
        },
      },
    }) satisfies HarvestRadio;

  it('marks the harvest shared once the radio sent it', async () => {
    const db = await createMigratedTestDatabase();
    const id = await insertHarvest(db, deer, NOW);
    const sent: unknown[] = [];
    await expect(
      shareHarvest(radio({ status: 'sent' }, sent), db, { ...deer, id }, 'party', () => NOW),
    ).resolves.toBe(true);
    expect(sent).toHaveLength(1);
    expect((await listHarvests(db))[0]).toMatchObject({ sharedWith: 'party', sharedAt: NOW });
  });

  it('leaves it private when the radio could not send', async () => {
    const db = await createMigratedTestDatabase();
    const id = await insertHarvest(db, deer, NOW);
    await expect(
      shareHarvest(radio({ status: 'timeout' }, []), db, { ...deer, id }, 'party'),
    ).resolves.toBe(false);
    expect((await listHarvests(db))[0]?.sharedWith).toBe('none');
  });
});
