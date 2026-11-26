#!/usr/bin/env node
// Writes src/database.types.ts from a database built by `supabase/scripts/db.sh reset`.
// Run through `npm run gen:db-types -w @huntclub/shared` (resets the database first).
// Connection: standard libpq variables (PGHOST, PGPORT, PGUSER, PGPASSWORD) and
// HUNTCLUB_DB (default huntclub_test), the same ones db.sh uses.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { CATALOG_QUERY, renderDatabaseTypes } from './db-types-render.mjs';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(packageDir, 'src', 'database.types.ts');

const json = execFileSync(
  'psql',
  [
    '--no-psqlrc',
    '--tuples-only',
    '--no-align',
    '-v',
    'ON_ERROR_STOP=1',
    '--dbname',
    process.env.HUNTCLUB_DB ?? 'huntclub_test',
    '--command',
    CATALOG_QUERY,
  ],
  { encoding: 'utf8' },
);

const source = renderDatabaseTypes(JSON.parse(json));
const options = (await prettier.resolveConfig(outFile)) ?? {};
writeFileSync(outFile, await prettier.format(source, { ...options, filepath: outFile }));
console.log(`Wrote ${outFile}`);
