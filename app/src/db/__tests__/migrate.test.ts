import { createTestDatabase } from '../../test-utils/nodeSqlite';
import { assertMigrationsOrdered, getSchemaVersion, migrate } from '../migrate';
import { migrations } from '../migrations';
import type { Migration } from '../types';

const EXPECTED_TABLES = [
  'areas',
  'check_ins',
  'groups',
  'harvests',
  'help_requests',
  'map_packs',
  'members',
  'messages',
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
  async function migratedDb() {
    const db = createTestDatabase();
    await migrate(db, migrations);
    return db;
  }

  it('allows only one open check-in per member', async () => {
    const db = await migratedDb();
    const insert = db.raw.prepare(
      `INSERT INTO check_ins (id, member_id, mode, checked_in_at, checked_out_at, updated_at)
       VALUES (?, 'm1', 'moving', 1, ?, 1)`,
    );
    insert.run('c1', 2); // closed
    insert.run('c2', null); // open
    expect(() => insert.run('c3', null)).toThrow(/UNIQUE/);
  });

  it('limits message bodies to 200 characters', async () => {
    const db = await migratedDb();
    const insert = db.raw.prepare(
      `INSERT INTO messages (id, channel, sender, body, sent_at) VALUES (?, 'party', 's', ?, 1)`,
    );
    insert.run('ok', 'a'.repeat(200));
    expect(() => insert.run('too-long', 'a'.repeat(201))).toThrow(/CHECK/);
  });

  it('keeps harvests private by default', async () => {
    const db = await migratedDb();
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
    const db = await migratedDb();
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
