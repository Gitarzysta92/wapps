import { createHash } from 'node:crypto';

export interface LegacyStubPlan {
  format: 1;
  policy: 'restricted-stubs';
  sourceDatabase: string;
  capturedAt: number;
  sourceHash: string;
  identities: {
    identityId: string;
    createdAt: number;
    sourceUpdatedAt: number;
    sourceHash: string;
  }[];
}

function requireValue(condition: unknown): asserts condition {
  if (!condition)
    throw new Error('Invalid or unsupported legacy identity evidence');
}

function object(value: unknown, fields: string[]): Record<string, unknown> {
  requireValue(value && typeof value === 'object' && !Array.isArray(value));
  requireValue(Object.keys(value).every((key) => fields.includes(key)));
  return value as Record<string, unknown>;
}

function timestamp(value: unknown): number {
  requireValue(
    typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value > 0 &&
      value <= 8_640_000_000_000_000
  );
  return value;
}

function text(value: unknown, max: number): string {
  requireValue(
    typeof value === 'string' &&
      value.length > 0 &&
      value.length <= max &&
      [...value].every(
        (character) =>
          character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127
      )
  );
  return value;
}

function uuid(value: unknown): string {
  requireValue(
    typeof value === 'string' &&
      /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value)
  );
  return value;
}

function hash(value: unknown): string {
  requireValue(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value));
  return value;
}

function list(value: unknown): unknown[] {
  requireValue(
    Array.isArray(value) && value.length > 0 && value.length <= 1000
  );
  return value;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, stable(item)])
    );
  return value;
}

export function legacyEvidenceHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
}

/** Offline evidence only; this never interprets an email as proof of an account link. */
export function planLegacyStubs(input: unknown): LegacyStubPlan {
  const evidence = object(input, [
    'sourceDatabase',
    'capturedAt',
    'subjects',
    'nodes',
    'accounts',
    'profiles',
  ]);
  const capturedAt = timestamp(evidence['capturedAt']);
  const subjects = list(evidence['subjects']).map((entry) =>
    object(entry, [
      'id',
      'provider',
      'externalId',
      'identityId',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ])
  );
  const nodes = list(evidence['nodes']).map((entry) =>
    object(entry, ['_id', 'id', 'kind', 'createdAt', 'updatedAt', 'deletedAt'])
  );
  const accounts = list(evidence['accounts']).map((entry) =>
    object(entry, [
      '_id',
      'email',
      'status',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ])
  );
  const profiles = list(evidence['profiles']).map((entry) =>
    object(entry, ['_id', 'createdAt', 'updatedAt', 'deletedAt'])
  );
  const ids = [
    ...new Set(subjects.map((entry) => uuid(entry['identityId']))),
  ].sort();
  requireValue(
    [nodes, accounts, profiles].every((rows) => rows.length === ids.length)
  );
  const subjectKeys = new Set<string>(),
    subjectIds = new Set<string>();
  for (const subject of subjects) {
    const key = JSON.stringify([
      text(subject['provider'], 64),
      text(subject['externalId'], 128),
    ]);
    const id = text(subject['id'], 255);
    requireValue(!subjectKeys.has(key) && !subjectIds.has(id));
    subjectKeys.add(key);
    subjectIds.add(id);
  }
  const identities = ids.map((identityId) => {
    const select = (rows: Record<string, unknown>[], field: string) => {
      const matching = rows.filter((row) => row[field] === identityId);
      requireValue(matching.length === 1);
      return matching[0];
    };
    const node = select(nodes, 'id'),
      account = select(accounts, '_id'),
      profile = select(profiles, '_id');
    const mappings = subjects
      .filter((row) => row['identityId'] === identityId)
      .sort((a, b) => (String(a['id']) < String(b['id']) ? -1 : 1));
    requireValue(node['kind'] === 'identity' && account['status'] === 'STUB');
    text(node['_id'], 128);
    if (account['email'] !== undefined) text(account['email'], 254);
    for (const row of [...mappings, node, account, profile]) {
      requireValue(
        row['deletedAt'] === 0 &&
          timestamp(row['updatedAt']) >= timestamp(row['createdAt']) &&
          Number(row['updatedAt']) <= capturedAt
      );
    }
    return {
      identityId,
      createdAt: timestamp(node['createdAt']),
      sourceUpdatedAt: Math.max(
        ...[...mappings, node, account, profile].map((row) =>
          timestamp(row['updatedAt'])
        )
      ),
      sourceHash: legacyEvidenceHash({ mappings, node, account, profile }),
    };
  });
  return parseLegacyStubPlan({
    format: 1,
    policy: 'restricted-stubs',
    sourceDatabase: evidence['sourceDatabase'],
    capturedAt,
    sourceHash: legacyEvidenceHash(identities),
    identities,
  });
}

export function parseLegacyStubPlan(input: unknown): LegacyStubPlan {
  const plan = object(input, [
    'format',
    'policy',
    'sourceDatabase',
    'capturedAt',
    'sourceHash',
    'identities',
  ]);
  requireValue(plan['format'] === 1 && plan['policy'] === 'restricted-stubs');
  const sourceDatabase = text(plan['sourceDatabase'], 64);
  requireValue(/^[A-Za-z0-9_]+$/.test(sourceDatabase));
  const capturedAt = timestamp(plan['capturedAt']);
  const identities = list(plan['identities']).map((entry) => {
    const row = object(entry, [
      'identityId',
      'createdAt',
      'sourceUpdatedAt',
      'sourceHash',
    ]);
    const result = {
      identityId: uuid(row['identityId']),
      createdAt: timestamp(row['createdAt']),
      sourceUpdatedAt: timestamp(row['sourceUpdatedAt']),
      sourceHash: hash(row['sourceHash']),
    };
    requireValue(
      result.createdAt <= result.sourceUpdatedAt &&
        result.sourceUpdatedAt <= capturedAt
    );
    return result;
  });
  requireValue(
    new Set(identities.map((row) => row.identityId)).size === identities.length
  );
  requireValue(
    identities.every(
      (row, index) =>
        index === 0 || identities[index - 1].identityId < row.identityId
    )
  );
  const sourceHash = hash(plan['sourceHash']);
  requireValue(sourceHash === legacyEvidenceHash(identities));
  return {
    format: 1,
    policy: 'restricted-stubs',
    sourceDatabase,
    capturedAt,
    sourceHash,
    identities,
  };
}
