import { CanonicalIdentityInputError } from './canonical-identity';

export const ACCOUNT_EXPORT_SOURCES = [
  'account',
  'credentials',
  'editorial',
  'discussion',
] as const;
export type AccountExportSourceName = (typeof ACCOUNT_EXPORT_SOURCES)[number];
export const ACCOUNT_EXPORT_LIMITS = {
  chunkBytes: 256 * 1024,
  recordBytes: 1024 * 1024,
  archiveBytes: 1024 * 1024 * 1024,
  uncompressedBytes: 4 * 1024 * 1024 * 1024,
  records: 1_000_000,
  attempts: 6,
  requestsPerDay: 6,
  leaseMs: 60_000,
  retentionMs: 24 * 60 * 60 * 1000,
  attemptMs: 15 * 60 * 1000,
} as const;
export type AccountExportStatus =
  | 'queued'
  | 'building'
  | 'ready'
  | 'failed'
  | 'cancelled'
  | 'expired';
export type AccountExportFailure =
  | 'source-unavailable'
  | 'limit-exceeded'
  | 'invalid-source'
  | 'account-unavailable';
export interface AccountExportJob {
  id: string;
  status: AccountExportStatus;
  requestedAt: number;
  expiresAt: number;
  readyAt: number | null;
  bytes: number | null;
  sha256: string | null;
  attempts: number;
  failure: AccountExportFailure | null;
}
export interface AccountExportCapture {
  source: AccountExportSourceName;
  startedAt: number;
  completedAt: number;
  records: number;
}
export interface AccountExportArtifact {
  bytes: number;
  sha256: string;
  chunks: number;
  captures: AccountExportCapture[];
}
export type AccountExportJson =
  | null
  | boolean
  | number
  | string
  | AccountExportJson[]
  | { [key: string]: AccountExportJson };
export type AccountExportEntry =
  | { type: 'begin'; source: AccountExportSourceName; at: number }
  | {
      type: 'record';
      source: AccountExportSourceName;
      collection: string;
      data: AccountExportJson;
    }
  | {
      type: 'end';
      source: AccountExportSourceName;
      at: number;
      records: number;
    };

export class AccountExportLimitExceeded extends Error {}
export class AccountExportSourceInvalid extends Error {}
export class AccountExportLeaseLost extends Error {}

export function accountExportObject(
  input: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    throw new CanonicalIdentityInputError('Unexpected account export fields');
  return Object.fromEntries(Object.entries(input));
}
export function accountExportId(input: unknown): string {
  if (
    typeof input !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      input
    )
  )
    throw new CanonicalIdentityInputError('Invalid account export ID');
  return input;
}
export function accountExportInteger(input: unknown, minimum = 0): number {
  if (
    typeof input !== 'number' ||
    !Number.isSafeInteger(input) ||
    input < minimum
  )
    throw new CanonicalIdentityInputError('Invalid account export number');
  return input;
}
export function accountExportHash(input: unknown): string {
  if (typeof input !== 'string' || !/^[0-9a-f]{64}$/.test(input))
    throw new CanonicalIdentityInputError('Invalid account export digest');
  return input;
}
export function parseAccountExportJob(input: unknown): AccountExportJob {
  const row = accountExportObject(input, [
    'id',
    'status',
    'requestedAt',
    'expiresAt',
    'readyAt',
    'bytes',
    'sha256',
    'attempts',
    'failure',
  ]);
  const requestedAt = accountExportInteger(row['requestedAt'], 1),
    expiresAt = accountExportInteger(row['expiresAt'], 1);
  const status = row['status'],
    failure = row['failure'];
  const readyAt =
    row['readyAt'] === null ? null : accountExportInteger(row['readyAt'], 1);
  const bytes =
    row['bytes'] === null ? null : accountExportInteger(row['bytes'], 1);
  const sha256 =
    row['sha256'] === null ? null : accountExportHash(row['sha256']);
  const attempts = accountExportInteger(row['attempts']);
  if (
    typeof status !== 'string' ||
    !['queued', 'building', 'ready', 'failed', 'cancelled', 'expired'].includes(
      status
    ) ||
    (failure !== null &&
      (typeof failure !== 'string' ||
        ![
          'source-unavailable',
          'limit-exceeded',
          'invalid-source',
          'account-unavailable',
        ].includes(failure))) ||
    expiresAt !== requestedAt + ACCOUNT_EXPORT_LIMITS.retentionMs ||
    attempts > ACCOUNT_EXPORT_LIMITS.attempts ||
    (['building', 'ready'].includes(status) && attempts === 0) ||
    (status === 'ready'
      ? readyAt === null ||
        bytes === null ||
        sha256 === null ||
        readyAt < requestedAt ||
        readyAt >= expiresAt
      : readyAt !== null || bytes !== null || sha256 !== null) ||
    (bytes !== null && bytes > ACCOUNT_EXPORT_LIMITS.archiveBytes) ||
    (status === 'failed') !== (failure !== null)
  )
    throw new CanonicalIdentityInputError('Invalid account export state');
  return {
    id: accountExportId(row['id']),
    status: status as AccountExportStatus,
    requestedAt,
    expiresAt,
    readyAt,
    bytes,
    sha256,
    attempts,
    failure: failure as AccountExportFailure | null,
  };
}
export function parseAccountExportArtifact(
  input: unknown
): AccountExportArtifact {
  try {
    return readAccountExportArtifact(input);
  } catch (error) {
    if (error instanceof AccountExportSourceInvalid) throw error;
    throw new AccountExportSourceInvalid('Invalid account export artifact');
  }
}
function readAccountExportArtifact(input: unknown): AccountExportArtifact {
  const row = accountExportObject(input, [
    'bytes',
    'sha256',
    'chunks',
    'captures',
  ]);
  const bytes = accountExportInteger(row['bytes'], 1),
    chunks = accountExportInteger(row['chunks'], 1);
  if (
    bytes > ACCOUNT_EXPORT_LIMITS.archiveBytes ||
    chunks !== Math.ceil(bytes / ACCOUNT_EXPORT_LIMITS.chunkBytes) ||
    !Array.isArray(row['captures']) ||
    row['captures'].length !== ACCOUNT_EXPORT_SOURCES.length
  )
    throw new AccountExportSourceInvalid('Incomplete account export artifact');
  const captures = row['captures'].map((input, index) => {
    const capture = accountExportObject(input, [
      'source',
      'startedAt',
      'completedAt',
      'records',
    ]);
    const startedAt = accountExportInteger(capture['startedAt'], 1),
      completedAt = accountExportInteger(capture['completedAt'], 1);
    if (
      capture['source'] !== ACCOUNT_EXPORT_SOURCES[index] ||
      completedAt < startedAt
    )
      throw new AccountExportSourceInvalid('Invalid account export capture');
    return {
      source: ACCOUNT_EXPORT_SOURCES[index],
      startedAt,
      completedAt,
      records: accountExportInteger(capture['records']),
    };
  });
  if (
    captures.reduce((total, capture) => total + capture.records, 0) >
    ACCOUNT_EXPORT_LIMITS.records
  )
    throw new AccountExportSourceInvalid(
      'Account export record count exceeds bounds'
    );
  return { bytes, chunks, sha256: accountExportHash(row['sha256']), captures };
}

function exportJson(
  input: unknown,
  budget = { nodes: 0, characters: 0 },
  depth = 0
): AccountExportJson {
  if (++budget.nodes > 100_000 || depth > 32)
    throw new AccountExportSourceInvalid(
      'Account export record is too complex'
    );
  if (input === null || typeof input === 'boolean') return input;
  if (typeof input === 'string') {
    budget.characters += input.length;
    if (budget.characters > ACCOUNT_EXPORT_LIMITS.recordBytes)
      throw new AccountExportLimitExceeded(
        'Account export record exceeds configured bounds'
      );
    return input;
  }
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (
    Array.isArray(input) &&
    input.length <= 100_000 &&
    Object.keys(input).length === input.length &&
    Array.from({ length: input.length }, (_, index) =>
      Object.prototype.hasOwnProperty.call(input, index)
    ).every(Boolean)
  )
    return input.map((value) => exportJson(value, budget, depth + 1));
  if (
    input &&
    typeof input === 'object' &&
    [Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => {
        budget.characters += key.length;
        if (budget.characters > ACCOUNT_EXPORT_LIMITS.recordBytes)
          throw new AccountExportLimitExceeded(
            'Account export record exceeds configured bounds'
          );
        return [key, exportJson(value, budget, depth + 1)];
      })
    );
  throw new AccountExportSourceInvalid(
    'Account export record must contain only JSON values'
  );
}

/** A source is complete only after one begin, its records and an exact end receipt. */
export class AccountExportCaptureSequence {
  private startedAt: number | undefined;
  private completedAt: number | undefined;
  private records = 0;
  constructor(private readonly source: AccountExportSourceName) {}
  accept(input: unknown): AccountExportEntry {
    try {
      const row = accountExportObject(input, [
        'type',
        'source',
        'at',
        'collection',
        'data',
        'records',
      ]);
      if (row['source'] !== this.source || this.completedAt !== undefined)
        throw new AccountExportSourceInvalid(
          'Unexpected account export source entry'
        );
      if (row['type'] === 'begin' && this.startedAt === undefined) {
        accountExportObject(input, ['type', 'source', 'at']);
        this.startedAt = accountExportInteger(row['at'], 1);
        return { type: 'begin', source: this.source, at: this.startedAt };
      }
      if (this.startedAt === undefined)
        throw new AccountExportSourceInvalid(
          'Missing account export source start'
        );
      if (row['type'] === 'record') {
        accountExportObject(input, ['type', 'source', 'collection', 'data']);
        if (
          typeof row['collection'] !== 'string' ||
          !/^[a-z][a-z0-9.-]{0,79}$/.test(row['collection'])
        )
          throw new AccountExportSourceInvalid(
            'Invalid account export collection'
          );
        if (++this.records > ACCOUNT_EXPORT_LIMITS.records)
          throw new AccountExportLimitExceeded(
            'Too many account export records'
          );
        return {
          type: 'record',
          source: this.source,
          collection: row['collection'],
          data: exportJson(row['data']),
        };
      }
      if (row['type'] === 'end') {
        accountExportObject(input, ['type', 'source', 'at', 'records']);
        const at = accountExportInteger(row['at'], 1);
        if (at < this.startedAt || row['records'] !== this.records)
          throw new AccountExportSourceInvalid(
            'Account export source completion disagrees'
          );
        this.completedAt = at;
        return { type: 'end', source: this.source, at, records: this.records };
      }
      throw new AccountExportSourceInvalid('Unexpected account export entry');
    } catch (error) {
      if (
        error instanceof AccountExportLimitExceeded ||
        error instanceof AccountExportSourceInvalid
      )
        throw error;
      throw new AccountExportSourceInvalid(
        'Invalid account export source entry'
      );
    }
  }
  finish(): AccountExportCapture {
    if (this.startedAt === undefined || this.completedAt === undefined)
      throw new AccountExportSourceInvalid(
        'Account export source ended without completion'
      );
    return {
      source: this.source,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      records: this.records,
    };
  }
}
