import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderDatabaseTypes, tsType } from './db-types-render.mjs';

const column = (name, type, extra = {}) => ({
  name,
  type,
  typtype: 'b',
  elementType: null,
  elementTyptype: null,
  notNull: true,
  hasDefault: false,
  generated: false,
  ...extra,
});

test('maps Postgres types to TypeScript', () => {
  assert.equal(tsType(column('a', 'uuid')), 'string');
  assert.equal(tsType(column('a', 'int8')), 'number');
  assert.equal(tsType(column('a', 'bool')), 'boolean');
  assert.equal(tsType(column('a', 'jsonb')), 'Json');
  assert.equal(
    tsType(column('a', 'stand_type', { typtype: 'e' })),
    'Database["public"]["Enums"]["stand_type"]',
  );
  assert.equal(
    tsType(column('a', '_float8', { elementType: 'float8', elementTyptype: 'b' })),
    'number[]',
  );
  assert.equal(tsType(column('a', 'tsvector')), 'unknown');
});

const catalog = {
  tables: [
    {
      name: 'stands',
      columns: [
        column('id', 'uuid', { hasDefault: true }),
        column('name', 'text'),
        column('notes', 'text', { notNull: false }),
        column('type', 'stand_type', { typtype: 'e' }),
      ],
      foreignKeys: [
        {
          name: 'stands_club_id_fkey',
          columns: ['club_id'],
          isOneToOne: false,
          referencedRelation: 'clubs',
          referencedColumns: ['id'],
        },
      ],
    },
  ],
  enums: [{ name: 'stand_type', values: ['tree_stand', 'ladder'] }],
  functions: [
    {
      name: 'redeem_invite',
      args: [column('invite_token', 'text')],
      returnType: 'stands',
      returnTyptype: 'c',
      returnRelation: 'stands',
      returnsSet: false,
    },
  ],
};

test('renders Row, Insert and Update with the right optionality', () => {
  const out = renderDatabaseTypes(catalog);
  assert.match(out, /Row: \{\nid: string\nname: string\nnotes: string \| null\n/);
  assert.match(out, /Insert: \{\nid\?: string\nname: string\nnotes\?: string \| null\n/);
  assert.match(out, /Update: \{\nid\?: string\nname\?: string\n/);
});

test('renders relationships, enums, constants and RPCs', () => {
  const out = renderDatabaseTypes(catalog);
  assert.match(out, /foreignKeyName: "stands_club_id_fkey"; columns: \["club_id"\]/);
  assert.match(out, /stand_type: "tree_stand" \| "ladder"/);
  assert.match(out, /stand_type: \["tree_stand","ladder"\],/);
  assert.match(
    out,
    /redeem_invite: \{ Args: \{ invite_token: string \}; Returns: Database\["public"\]\["Tables"\]\["stands"\]\["Row"\] \}/,
  );
});

test('empty sections use the never map, like the Supabase CLI', () => {
  const out = renderDatabaseTypes({ tables: [], enums: [], functions: [] });
  assert.match(out, /Tables: \{ \[_ in never\]: never \}/);
  assert.match(out, /Functions: \{ \[_ in never\]: never \}/);
});
