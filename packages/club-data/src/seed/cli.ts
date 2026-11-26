/**
 * Dev-only: seeds the "UAT Test Club" for a Cognito user (see README, "Dev test club").
 *   npm run seed:dev -w @huntclub/club-data -- --env dev --table <table> --admin-sub <sub> --email <email>
 * Refuses anything but the dev environment and a "-dev" table. Uses the default AWS
 * credentials (CloudShell's). Prints ids only, never secrets.
 */
import { parseArgs } from 'node:util';
import { clubDataForTable, seedDevClub } from '../index';

export const DEV_ENV = 'dev';

export function parseSeedArgs(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      env: { type: 'string' },
      table: { type: 'string' },
      'admin-sub': { type: 'string' },
      email: { type: 'string' },
    },
    strict: true,
  });
  const { env, table, email } = values;
  const adminSub = values['admin-sub'];
  if (env !== DEV_ENV) throw new Error(`refusing to seed: --env must be "${DEV_ENV}"`);
  if (!table?.endsWith(`-${DEV_ENV}`)) {
    throw new Error(`refusing to seed: --table must be the dev table (ends with "-${DEV_ENV}")`);
  }
  if (!adminSub || !email) throw new Error('--admin-sub and --email are required');
  return { table, adminSub, email };
}

async function main() {
  const { table, adminSub, email } = parseSeedArgs(process.argv.slice(2));
  const result = await seedDevClub(clubDataForTable(table), { adminSub, email });
  console.log(
    `${result.created ? 'Created' : 'Updated'} UAT Test Club ${result.clubId}; features until ${result.featuresUntil}`,
  );
}

if (require.main === module) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
