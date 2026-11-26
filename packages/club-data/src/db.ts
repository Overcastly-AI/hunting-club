/**
 * Thin helpers over the DynamoDB document client. Every write in club-data goes
 * through `put`, `update`, `remove` or `transact`, and each requires a condition.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  type QueryCommandInput,
  TransactWriteCommand,
  type TransactWriteCommandInput,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { INVITE_TOKEN_BYTES } from '@huntclub/shared';
import { ATTR, type Key } from './items';

export interface ClubDataOptions {
  /** Create with `DynamoDBDocumentClient.from(client, DOCUMENT_CLIENT_OPTIONS)`. */
  client: DynamoDBDocumentClient;
  tableName: string;
  /** Clock; injectable for tests. */
  now?: () => Date;
  newId?: () => string;
  newInviteToken?: () => string;
}

/** Marshalling options club-data relies on (optional fields are left out, never null). */
export const DOCUMENT_CLIENT_OPTIONS = {
  marshallOptions: { removeUndefinedValues: true },
} as const;

export interface Ctx {
  readonly doc: DynamoDBDocumentClient;
  readonly table: string;
  now(): Date;
  nowIso(): string;
  newId(): string;
  newInviteToken(): string;
}

export function createCtx(options: ClubDataOptions): Ctx {
  const now = options.now ?? (() => new Date());
  return {
    doc: options.client,
    table: options.tableName,
    now,
    nowIso: () => now().toISOString(),
    newId: options.newId ?? randomUUID,
    newInviteToken:
      options.newInviteToken ?? (() => randomBytes(INVITE_TOKEN_BYTES).toString('hex')),
  };
}

export type Item = Record<string, unknown>;

/** Expression names/values; merged from fragments by `expression()`. */
export interface Expr {
  names?: Record<string, string>;
  values?: Record<string, unknown>;
}
interface ExprParts {
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, unknown>;
}
export function expression(...parts: Expr[]): ExprParts {
  const names = Object.assign({}, ...parts.map((p) => p.names ?? {}));
  const values = Object.assign({}, ...parts.map((p) => p.values ?? {}));
  return {
    ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
    ...(Object.keys(values).length ? { ExpressionAttributeValues: values } : {}),
  };
}

/** Conditions shared by many writes. */
export const EXISTS = `attribute_exists(${ATTR.PK})`;
export const NOT_EXISTS = `attribute_not_exists(${ATTR.PK})`;

/**
 * `SET a = :a, b = :b, updatedAt = :updatedAt` for the defined fields of `fields`
 * (undefined fields are left unchanged).
 */
export function setFields(fields: Record<string, unknown>, nowIso: string) {
  const entries = Object.entries({ ...fields, updatedAt: nowIso }).filter(
    ([, v]) => v !== undefined,
  );
  return {
    expression: `SET ${entries.map(([k]) => `#f_${k} = :f_${k}`).join(', ')}`,
    names: Object.fromEntries(entries.map(([k]) => [`#f_${k}`, k])),
    values: Object.fromEntries(entries.map(([k, v]) => [`:f_${k}`, v])),
  };
}

export async function get(ctx: Ctx, key: Key): Promise<Item | undefined> {
  const out = await ctx.doc.send(
    new GetCommand({ TableName: ctx.table, Key: key, ConsistentRead: true }),
  );
  return out.Item;
}

export async function queryAll(
  ctx: Ctx,
  input: Omit<QueryCommandInput, 'TableName' | 'ExclusiveStartKey'>,
): Promise<Item[]> {
  const items: Item[] = [];
  let start: Record<string, unknown> | undefined;
  do {
    const out = await ctx.doc.send(
      new QueryCommand({ ...input, TableName: ctx.table, ExclusiveStartKey: start }),
    );
    items.push(...(out.Items ?? []));
    start = out.LastEvaluatedKey;
  } while (start);
  return items;
}

/** Signals a failed single-item condition; callers map it to a ClubDataError. */
export class ConditionFailed extends Error {}

async function conditional<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) throw new ConditionFailed();
    throw error;
  }
}

export interface Write extends Expr {
  condition: string;
}

export const put = (ctx: Ctx, item: Item, w: Write) =>
  conditional(() =>
    ctx.doc.send(
      new PutCommand({
        TableName: ctx.table,
        Item: item,
        ConditionExpression: w.condition,
        ...expression(w),
      }),
    ),
  );

export const update = (ctx: Ctx, key: Key, updateExpression: string, w: Write) =>
  conditional(async () => {
    const out = await ctx.doc.send(
      new UpdateCommand({
        TableName: ctx.table,
        Key: key,
        UpdateExpression: updateExpression,
        ConditionExpression: w.condition,
        ReturnValues: 'ALL_NEW',
        ...expression(w),
      }),
    );
    return out.Attributes as Item;
  });

export const remove = (ctx: Ctx, key: Key, w: Write) =>
  conditional(() =>
    ctx.doc.send(
      new DeleteCommand({
        TableName: ctx.table,
        Key: key,
        ConditionExpression: w.condition,
        ...expression(w),
      }),
    ),
  );

/** Transaction items, each with a mandatory condition. */
export type TxItem =
  | ({ put: Item } & Write)
  | ({ update: Key; set: string } & Write)
  | ({ delete: Key } & Write)
  | ({ check: Key } & Write);

/**
 * A transaction was cancelled because these items' conditions failed
 * (indexes into the TxItem array).
 */
export class TransactionFailed extends Error {
  constructor(readonly failed: ReadonlySet<number>) {
    super('transaction conditions failed');
  }
}

const MAX_CONFLICT_RETRIES = 6;

function toTransactItem(ctx: Ctx, item: TxItem) {
  const common = { TableName: ctx.table, ConditionExpression: item.condition, ...expression(item) };
  if ('put' in item) return { Put: { ...common, Item: item.put } };
  if ('update' in item)
    return { Update: { ...common, Key: item.update, UpdateExpression: item.set } };
  if ('delete' in item) return { Delete: { ...common, Key: item.delete } };
  return { ConditionCheck: { ...common, Key: item.check } };
}

/**
 * Runs one TransactWriteItems. Conflicts with a concurrent transaction on the same
 * items are retried with jittered backoff; failed conditions throw TransactionFailed.
 */
export async function transact(ctx: Ctx, items: TxItem[]): Promise<void> {
  const input: TransactWriteCommandInput = {
    TransactItems: items.map((i) => toTransactItem(ctx, i)),
  };
  for (let attempt = 0; ; attempt++) {
    try {
      await ctx.doc.send(new TransactWriteCommand(input));
      return;
    } catch (error) {
      if (!(error instanceof TransactionCanceledException)) throw error;
      const reasons = error.CancellationReasons ?? [];
      const failed = new Set(
        reasons.flatMap((r, i) => (r.Code === 'ConditionalCheckFailed' ? [i] : [])),
      );
      if (failed.size > 0) throw new TransactionFailed(failed);
      const conflict = reasons.some((r) => r.Code === 'TransactionConflict');
      if (!conflict || attempt >= MAX_CONFLICT_RETRIES) throw error;
      await new Promise((r) => setTimeout(r, Math.random() * 20 * 2 ** attempt));
    }
  }
}
