import type { EntityManager } from 'typeorm';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';

export interface IdentityErasureBarrier {
  identityId: string;
  erasureRevision: number | null;
  requestedAt: number | null;
}

function integer(value: unknown): number {
  const number =
    typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1)
    throw new Error('Invalid canonical identity erasure barrier');
  return number;
}

export function identityErasureBarrier(
  row: Record<string, unknown>
): IdentityErasureBarrier {
  if (!isCanonicalIdentityId(row.identityId))
    throw new Error('Invalid canonical identity erasure barrier');
  const erasureRevision =
    row.erasureRevision === null ? null : integer(row.erasureRevision);
  const requestedAt =
    row.requestedAt === null ? null : integer(row.requestedAt);
  if ((erasureRevision === null) !== (requestedAt === null))
    throw new Error('Incomplete canonical identity erasure barrier');
  return { identityId: row.identityId, erasureRevision, requestedAt };
}

async function lockBarriers(
  manager: EntityManager,
  identities: readonly string[]
) {
  if (!manager.queryRunner?.isTransactionActive)
    throw new Error('Identity write barriers require an active transaction');
  if (
    !identities.length ||
    identities.length > 8 ||
    identities.some((id) => !isCanonicalIdentityId(id))
  )
    throw new CanonicalIdentityInputError('Invalid identity write scope');
  const barriers: IdentityErasureBarrier[] = [];
  // Acquire every identity before resource/workspace locks, in the same order in all services.
  for (const identityId of [...new Set(identities)].sort()) {
    await manager.query(
      'INSERT INTO identity_erasure_barriers (identityId, erasureRevision, requestedAt) VALUES (?, NULL, NULL) ON DUPLICATE KEY UPDATE identityId = identityId',
      [identityId]
    );
    const rows: Record<string, unknown>[] = await manager.query(
      'SELECT identityId, erasureRevision, requestedAt FROM identity_erasure_barriers WHERE identityId = ? FOR UPDATE',
      [identityId]
    );
    if (rows.length !== 1 || rows[0].identityId !== identityId)
      throw new Error('Missing canonical identity write barrier');
    barriers.push(identityErasureBarrier(rows[0]));
  }
  return barriers;
}

/** The caller must keep this transaction open through its canonical mutation and receipt. */
export async function lockIdentityWrites(
  manager: EntityManager,
  identities: readonly string[]
): Promise<void> {
  const barriers = await lockBarriers(manager, identities);
  if (barriers.some((barrier) => barrier.erasureRevision !== null))
    throw new CanonicalIdentityAccessDenied(
      'Account erasure prevents this write'
    );
}

/** Optional recipients may be erased without denying an otherwise valid actor's write. */
export async function lockIdentityWriteRecipients(
  manager: EntityManager,
  writers: readonly string[],
  recipients: readonly string[]
): Promise<string[]> {
  if (!writers.length)
    throw new CanonicalIdentityInputError('A required writer is missing');
  const barriers = await lockBarriers(manager, [...writers, ...recipients]);
  if (
    barriers.some(
      (row) => writers.includes(row.identityId) && row.erasureRevision !== null
    )
  )
    throw new CanonicalIdentityAccessDenied(
      'Account erasure prevents this write'
    );
  return barriers
    .filter(
      (row) =>
        recipients.includes(row.identityId) && row.erasureRevision === null
    )
    .map((row) => row.identityId);
}

/** Internal erasure authority only. A committed barrier is permanent, including after cleanup. */
export async function beginIdentityErasure(
  manager: EntityManager,
  identityId: string,
  erasureRevision: number,
  requestedAt: number
): Promise<IdentityErasureBarrier> {
  if (
    !Number.isSafeInteger(erasureRevision) ||
    erasureRevision < 1 ||
    !Number.isSafeInteger(requestedAt) ||
    requestedAt < 1
  )
    throw new CanonicalIdentityInputError('Invalid identity erasure request');
  const [barrier] = await lockBarriers(manager, [identityId]);
  if (barrier.erasureRevision !== null) {
    if (barrier.erasureRevision !== erasureRevision)
      throw new CanonicalIdentityConflict('Identity erasure revision differs');
    return barrier;
  }
  await manager.query(
    'UPDATE identity_erasure_barriers SET erasureRevision = ?, requestedAt = ? WHERE identityId = ?',
    [erasureRevision, requestedAt, identityId]
  );
  return { identityId, erasureRevision, requestedAt };
}
