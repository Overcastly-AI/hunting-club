import { MAX_TEXT_CHARS } from '@huntclub/mesh';

import { createMigratedTestDatabase, createTestDatabase } from '../../test-utils/nodeSqlite';
import { assertMigrationsOrdered, getSchemaVersion, migrate } from '../migrate';
import { migrations } from '../migrations';
import type { Migration } from '../types';

const EXPECTED_TABLES = [
  'app_state',
  'areas',
  'chat_messages',
  'check_ins',
  'groups',
  'harvests',
  'help_requests',
  'map_packs',
  'members',
  'paired_radio',
  'party',
  'positions',
  'radios',
  'stands',
];

function tableNames(db: ReturnType<typeof createTestDatabase>): string[] {
  const rows = db.raw
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((row) => row.name);
}

describe('migrate', () => {
  it('creates every local table from the spec and sets the schema version', async () => {
    const db = createTestDatabase();
    expect(await getSchemaVersion(db)).toBe(0);

    const version = await migrate(db, migrations);

    expect(version).toBe(migrations.length);
    expect(tableNames(db)).toEqual(EXPECTED_TABLES);
  });

  it('is idempotent when run again', async () => {
    const db = createTestDatabase();
    await migrate(db, migrations);
    await expect(migrate(db, migrations)).resolves.toBe(migrations.length);
    expect(tableNames(db)).toEqual(EXPECTED_TABLES);
  });

  it('applies only migrations newer than the current version', async () => {
    const db = createTestDatabase();
    const first: Migration = { version: 1, name: 'one', sql: 'CREATE TABLE a (id INTEGER);' };
    const second: Migration = { version: 2, name: 'two', sql: 'CREATE TABLE b (id INTEGER);' };

    await migrate(db, [first]);
    await expect(migrate(db, [first, second])).resolves.toBe(2);
    expect(tableNames(db)).toEqual(['a', 'b']);
  });

  it('rolls back a failing migration and keeps the previous version', async () => {
    const db = createTestDatabase();
    const good: Migration = { version: 1, name: 'good', sql: 'CREATE TABLE a (id INTEGER);' };
    const bad: Migration = {
      version: 2,
      name: 'bad',
      sql: 'CREATE TABLE b (id INTEGER); INSERT INTO missing_table VALUES (1);',
    };

    await expect(migrate(db, [good, bad])).rejects.toThrow();
    expect(await getSchemaVersion(db)).toBe(1);
    expect(tableNames(db)).toEqual(['a']);
  });

  it('refuses a database newer than the app', async () => {
    const db = createTestDatabase();
    await db.execAsync('PRAGMA user_version = 99');
    await expect(migrate(db, migrations)).rejects.toThrow(/newer than this app supports/);
  });

  it('rejects migrations with gaps or out of order', () => {
    expect(() =>
      assertMigrationsOrdered([
        { version: 1, name: 'one', sql: '' },
        { version: 3, name: 'three', sql: '' },
      ]),
    ).toThrow(/expected 2/);
  });
});

describe('initial schema constraints', () => {
  it('allows only one open check-in per member', async () => {
    const db = await createMigratedTestDatabase();
    const insert = db.raw.prepare(
      `INSERT INTO check_ins (id, member_id, mode, checked_in_at, checked_out_at, updated_at)
       VALUES (?, 'm1', 'moving', 1, ?, 1)`,
    );
    insert.run('c1', 2); // closed
    insert.run('c2', null); // open
    expect(() => insert.run('c3', null)).toThrow(/UNIQUE/);
  });

  it('limits chat text bodies to the mesh text limit', async () => {
    const db = await createMigratedTestDatabase();
    const insert = db.raw.prepare(
      `INSERT INTO chat_messages (kind, sender, message_id, conversation, body, at)
       VALUES ('text', 1, ?, 'group:party', ?, 1)`,
    );
    insert.run(1, 'a'.repeat(MAX_TEXT_CHARS));
    expect(() => insert.run(2, 'a'.repeat(MAX_TEXT_CHARS + 1))).toThrow(/CHECK/);
    expect(() => insert.run(1, 'again')).toThrow(/UNIQUE|PRIMARY/); // (sender, message id) de-dup
  });

  it('keeps harvests private by default', async () => {
    const db = await createMigratedTestDatabase();
    db.raw
      .prepare(
        `INSERT INTO harvests (id, member_id, species, harvested_at, updated_at)
         VALUES ('h1', 'm1', 'deer', 1, 1)`,
      )
      .run();
    const row = db.raw.prepare(`SELECT shared_with FROM harvests WHERE id = 'h1'`).get();
    expect(row).toEqual(expect.objectContaining({ shared_with: 'none' }));
  });

  it('accepts only the check-in modes from the spec', async () => {
    const db = await createMigratedTestDatabase();
    const insert = db.raw.prepare(
      `INSERT INTO check_ins (id, member_id, mode, checked_in_at, updated_at)
       VALUES (?, ?, ?, 1, 1)`,
    );
    for (const [i, mode] of ['stand', 'area', 'spot', 'moving'].entries()) {
      insert.run(`c${i}`, `m${i}`, mode);
    }
    expect(() => insert.run('bad', 'm9', 'driving')).toThrow(/CHECK/);
  });
});

describe('migration 2: map pack downloads', () => {
  const v1 = migrations.slice(0, 1);

  it('upgrades a version 1 database and keeps existing map packs', async () => {
    const db = createTestDatabase();
    await migrate(db, v1);
    db.raw
      .prepare(
        `INSERT INTO map_packs (id, bounds, min_zoom, max_zoom, source) VALUES ('p1', '[0,0,1,1]', 8, 15, 'usgs-topo')`,
      )
      .run();

    await expect(migrate(db, migrations)).resolves.toBe(migrations.length);

    const row = db.raw.prepare(`SELECT * FROM map_packs WHERE id = 'p1'`).get();
    expect(row).toEqual(
      expect.objectContaining({
        source: 'usgs-topo',
        name: 'Downloaded area',
        status: 'complete',
        tile_count: null,
        created_at: 0,
      }),
    );
  });

  it('accepts only known download statuses', async () => {
    const db = await createMigratedTestDatabase();
    const insert = db.raw.prepare(
      `INSERT INTO map_packs (id, bounds, min_zoom, max_zoom, source, status) VALUES (?, '[0,0,1,1]', 8, 15, 'usgs-topo', ?)`,
    );
    insert.run('a', 'downloading');
    insert.run('b', 'failed');
    expect(() => insert.run('c', 'paused')).toThrow(/CHECK/);
  });
});
