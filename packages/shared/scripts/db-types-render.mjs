// Renders TypeScript types for the Supabase `public` schema from a catalog snapshot
// (see CATALOG_QUERY). Output follows the `Database` shape that `supabase gen types
// typescript` produces, so supabase-js clients can be typed with it unchanged.

export const SCHEMA = 'public';

/**
 * One JSON document describing tables, columns, foreign keys, enums and functions.
 * Kept here (not in the CLI) so the renderer and its input format live together.
 */
export const CATALOG_QUERY = `
with tables as (
  select c.oid, c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = '${SCHEMA}' and c.relkind in ('r', 'p')
),
columns as (
  select a.attrelid, json_agg(json_build_object(
    'name', a.attname,
    'type', t.typname,
    'typtype', t.typtype,
    'elementType', et.typname,
    'elementTyptype', et.typtype,
    'notNull', a.attnotnull,
    'hasDefault', a.atthasdef or a.attidentity <> '',
    'generated', a.attgenerated <> ''
  ) order by a.attnum) as columns
  from pg_attribute a
  join pg_type t on t.oid = a.atttypid
  left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
  where a.attnum > 0 and not a.attisdropped and a.attrelid in (select oid from tables)
  group by a.attrelid
),
foreign_keys as (
  select con.conrelid, json_agg(json_build_object(
    'name', con.conname,
    'columns', (select json_agg(att.attname order by k.ord)
                from unnest(con.conkey) with ordinality k(attnum, ord)
                join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum),
    'referencedRelation', rc.relname,
    'referencedColumns', (select json_agg(att.attname order by k.ord)
                          from unnest(con.confkey) with ordinality k(attnum, ord)
                          join pg_attribute att on att.attrelid = con.confrelid and att.attnum = k.attnum),
    'isOneToOne', exists (
      select 1 from pg_constraint u
      where u.conrelid = con.conrelid and u.contype in ('p', 'u')
        and u.conkey::int[] @> con.conkey::int[] and u.conkey::int[] <@ con.conkey::int[])
  ) order by con.conname) as foreign_keys
  from pg_constraint con
  join pg_class rc on rc.oid = con.confrelid
  join pg_namespace rn on rn.oid = rc.relnamespace
  where con.contype = 'f' and rn.nspname = '${SCHEMA}'
  group by con.conrelid
),
enums as (
  select t.typname as name, json_agg(e.enumlabel order by e.enumsortorder) as values
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid
  where n.nspname = '${SCHEMA}'
  group by t.typname
),
functions as (
  select p.proname as name,
    coalesce((select json_agg(json_build_object(
        'name', p.proargnames[k.ord],
        'type', at.typname,
        'typtype', at.typtype,
        'elementType', aet.typname,
        'elementTyptype', aet.typtype) order by k.ord)
      from unnest(p.proargtypes::oid[]) with ordinality k(typ, ord)
      join pg_type at on at.oid = k.typ
      left join pg_type aet on aet.oid = at.typelem and at.typcategory = 'A'), '[]'::json) as args,
    rt.typname as "returnType",
    rt.typtype as "returnTyptype",
    rrel.relname as "returnRelation",
    p.proretset as "returnsSet"
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_type rt on rt.oid = p.prorettype
  left join pg_class rrel on rrel.oid = rt.typrelid
  where n.nspname = '${SCHEMA}' and p.prokind = 'f' and rt.typname <> 'trigger'
)
select json_build_object(
  'tables', coalesce((select json_agg(json_build_object(
      'name', t.relname,
      'columns', c.columns,
      'foreignKeys', coalesce(fk.foreign_keys, '[]'::json)) order by t.relname)
    from tables t join columns c on c.attrelid = t.oid
    left join foreign_keys fk on fk.conrelid = t.oid), '[]'::json),
  'enums', coalesce((select json_agg(json_build_object('name', name, 'values', values) order by name)
    from enums), '[]'::json),
  'functions', coalesce((select json_agg(f order by f.name) from functions f), '[]'::json)
)`;

const STRING_TYPES = new Set([
  'text',
  'varchar',
  'bpchar',
  'char',
  'name',
  'citext',
  'uuid',
  'bytea',
  'date',
  'time',
  'timetz',
  'timestamp',
  'timestamptz',
  'interval',
  'inet',
  'cidr',
  'macaddr',
]);
const NUMBER_TYPES = new Set(['int2', 'int4', 'int8', 'float4', 'float8', 'numeric', 'oid']);

const enumRef = (name) => `Database[${q(SCHEMA)}]["Enums"][${q(name)}]`;
const q = (value) => JSON.stringify(value);
const key = (name) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : q(name));

/** Maps one Postgres type (as reported by CATALOG_QUERY) to a TypeScript type. */
export function tsType({ type, typtype, elementType, elementTyptype }) {
  if (elementType) return `${tsType({ type: elementType, typtype: elementTyptype })}[]`;
  if (typtype === 'e') return enumRef(type);
  if (type === 'bool') return 'boolean';
  if (type === 'json' || type === 'jsonb') return 'Json';
  if (NUMBER_TYPES.has(type)) return 'number';
  if (STRING_TYPES.has(type)) return 'string';
  if (type === 'void') return 'undefined';
  return 'unknown';
}

function columnLines(columns, mode) {
  return columns.map((column) => {
    const base = tsType(column) + (column.notNull ? '' : ' | null');
    if (mode === 'Row') return `${key(column.name)}: ${base}`;
    if (column.generated) return `${key(column.name)}?: never`;
    const optional = mode === 'Update' || !column.notNull || column.hasDefault;
    return `${key(column.name)}${optional ? '?' : ''}: ${base}`;
  });
}

function renderTable(table) {
  const block = (mode) => `${mode}: {\n${columnLines(table.columns, mode).join('\n')}\n}`;
  const relationships = table.foreignKeys.map(
    (fk) =>
      `{ foreignKeyName: ${q(fk.name)}; columns: ${q(fk.columns)}; isOneToOne: ${fk.isOneToOne}; ` +
      `referencedRelation: ${q(fk.referencedRelation)}; referencedColumns: ${q(fk.referencedColumns)} }`,
  );
  return `${key(table.name)}: {\n${block('Row')}\n${block('Insert')}\n${block('Update')}\nRelationships: [${relationships.join(', ')}]\n}`;
}

function renderFunction(fn) {
  const args = fn.args.length
    ? `{ ${fn.args.map((arg) => `${key(arg.name)}: ${tsType(arg)}`).join('; ')} }`
    : 'never';
  const single = fn.returnRelation
    ? `Database[${q(SCHEMA)}]["Tables"][${q(fn.returnRelation)}]["Row"]`
    : tsType({ type: fn.returnType, typtype: fn.returnTyptype });
  return `${key(fn.name)}: { Args: ${args}; Returns: ${fn.returnsSet ? `${single}[]` : single} }`;
}

const never = '{ [_ in never]: never }';
const record = (entries) => (entries.length ? `{\n${entries.join('\n')}\n}` : never);

/** Renders the full module text (unformatted; the CLI runs Prettier over it). */
export function renderDatabaseTypes(catalog) {
  return `// Generated from supabase/migrations by packages/shared/scripts/gen-db-types.mjs.
// Do not edit by hand: change the SQL, then run \`npm run gen:db-types -w @huntclub/shared\`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  ${SCHEMA}: {
    Tables: ${record(catalog.tables.map(renderTable))}
    Views: ${never}
    Functions: ${record(catalog.functions.map(renderFunction))}
    Enums: ${record(catalog.enums.map((e) => `${key(e.name)}: ${e.values.map(q).join(' | ')}`))}
    CompositeTypes: ${never}
  }
};

export const Constants = {
  ${SCHEMA}: {
    Enums: {
${catalog.enums.map((e) => `      ${key(e.name)}: ${q(e.values)},`).join('\n')}
    },
  },
} as const;
`;
}
