import type { EntityManager } from 'typeorm';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityUnavailable,
  isCanonicalIdentityId,
  type CanonicalIdentityState,
} from '@sdk/features/identity/core';

export function canonicalSqlRequired(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) throw new CanonicalIdentityUnavailable(message);
}

export function canonicalSqlInteger(input: unknown, minimum = 0): number {
  const value =
    typeof input === 'string' && /^\d+$/.test(input) ? Number(input) : input;
  canonicalSqlRequired(
    typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= minimum,
    'Invalid stored identity revision or timestamp'
  );
  return value;
}

function flag(value: unknown): boolean {
  canonicalSqlRequired(
    value === 0 || value === 1,
    'Invalid stored lifecycle flag'
  );
  return value === 1;
}

export function canonicalIdentityState(
  row: Record<string, unknown>
): CanonicalIdentityState {
  canonicalSqlRequired(
    isCanonicalIdentityId(row.identity_id) &&
      row.identity_id === row.claim &&
      typeof row.id === 'string' &&
      /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(row.id),
    'Invalid canonical identity mapping'
  );
  canonicalSqlRequired(
    typeof row.provider_type === 'string' && typeof row.kind === 'string',
    'Invalid identity provider/kind'
  );
  canonicalSqlRequired(
    ['user', 'guest'].includes(row.kind) &&
      /^[a-z][a-z0-9_-]{0,63}$/.test(row.provider_type),
    'Invalid identity kind/provider'
  );
  const result = {
    identityId: row.identity_id,
    subjectId: row.id,
    kind: row.kind,
    provider: row.provider_type,
    isActive: flag(row.is_active),
    isSuspended: flag(row.is_suspended),
    isDeleted: flag(row.is_deleted),
    revision: canonicalSqlInteger(row.revision, 1),
    createdAt: canonicalSqlInteger(row.created_at, 1),
    updatedAt: canonicalSqlInteger(row.updated_at, 1),
    deletedAt: canonicalSqlInteger(row.deleted_at),
  };
  canonicalSqlRequired(
    result.updatedAt >= result.createdAt &&
      result.updatedAt <= 8_640_000_000_000_000 &&
      result.deletedAt <= result.updatedAt &&
      (result.isDeleted
        ? !result.isActive && result.deletedAt > 0
        : result.deletedAt === 0),
    'Invalid identity lifecycle timestamps'
  );
  return result;
}

export function assertActiveIdentity(
  current: CanonicalIdentityState | null
): asserts current is CanonicalIdentityState {
  if (!current || !current.isActive || current.isSuspended || current.isDeleted)
    throw new CanonicalIdentityAccessDenied('Identity is unavailable');
}

export async function readCanonicalIdentity(
  manager: EntityManager,
  uid: string,
  lock = false
): Promise<CanonicalIdentityState | null> {
  const [row] = await manager.query<Record<string, unknown>[]>(
    `SELECT id, identity_id, claim, kind, provider_type, is_active, is_suspended, is_deleted, revision, created_at, updated_at, deleted_at FROM identities WHERE claim = ?${
      lock ? ' FOR UPDATE' : ''
    }`,
    [uid]
  );
  if (!row) return null;
  const result = canonicalIdentityState(row);
  canonicalSqlRequired(
    result.identityId === uid,
    'Identity lookup returned a different case-sensitive principal'
  );
  return result;
}

export async function appendCanonicalIdentityEvent(
  manager: EntityManager,
  type:
    | 'identity.created'
    | 'identity.authenticated'
    | 'identity.updated'
    | 'identity.deleted',
  current: CanonicalIdentityState,
  at: number,
  generateId: () => string,
  provider = current.provider
): Promise<void> {
  const id = generateId();
  const envelope = {
    meta: {
      id,
      type,
      version: 1,
      occurredAt: new Date(at).toISOString(),
      producer: { service: 'identity' },
      correlation: { correlationId: current.identityId },
      subject: { entityType: 'identity', entityId: current.identityId },
    },
    payload:
      type === 'identity.authenticated'
        ? {
            identityId: current.identityId,
            provider,
            revision: current.revision,
          }
        : {
            identityId: current.identityId,
            subjectId: current.subjectId,
            provider: 'firebase',
            revision: current.revision,
            state: {
              isActive: current.isActive,
              isSuspended: current.isSuspended,
              isDeleted: current.isDeleted,
              deletedAt: current.deletedAt,
            },
          },
  };
  await manager.query(
    'INSERT INTO identity_events_outbox (id, identityId, eventType, revision, body, createdAt, availableAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      current.identityId,
      type,
      current.revision,
      JSON.stringify(envelope),
      at,
      at,
    ]
  );
}
