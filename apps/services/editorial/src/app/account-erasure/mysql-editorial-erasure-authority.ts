import type { EntityManager } from 'typeorm';
import {
  accountErasureRequest,
  type AccountErasureRequest,
} from '@sdk/features/identity/core';
import { identityErasureBarrier } from '@sdk/extras/identity-mysql';
import { editorialSqlInteger } from '../infrastructure/mysql-editorial-snapshot';

export async function lockEditorialErasureState(
  manager: EntityManager,
  input: AccountErasureRequest
) {
  const request = accountErasureRequest(input);
  if (!manager.queryRunner?.isTransactionActive)
    throw new Error('Editorial erasure requires a canonical transaction');
  const [row]: Record<string, unknown>[] = await manager.query(
    'SELECT identityId,erasureRevision,requestedAt FROM identity_erasure_barriers WHERE identityId=? FOR UPDATE',
    [request.identityId]
  );
  const [receipt]: Record<string, unknown>[] = await manager.query(
    'SELECT revision,requestedAt,completedAt FROM identity_erasure_requests WHERE identityId=? FOR UPDATE',
    [request.identityId]
  );
  if (!row || !receipt) throw new Error('Missing Editorial erasure request');
  const barrier = identityErasureBarrier(row);
  if (
    barrier.identityId !== request.identityId ||
    barrier.erasureRevision !== request.revision ||
    editorialSqlInteger(receipt.revision, 1) !== request.revision ||
    editorialSqlInteger(receipt.requestedAt, 1) !== barrier.requestedAt
  )
    throw new Error('Editorial cleanup requires the exact erasure request');
  const requestedAt = editorialSqlInteger(receipt.requestedAt, 1);
  const completedAt =
    receipt.completedAt === null
      ? null
      : editorialSqlInteger(receipt.completedAt, 1);
  if (completedAt !== null && completedAt < requestedAt)
    throw new Error('Invalid Editorial erasure completion time');
  return { request, requestedAt, completedAt };
}

export async function lockEditorialErasure(
  manager: EntityManager,
  input: AccountErasureRequest
) {
  const state = await lockEditorialErasureState(manager, input);
  if (state.completedAt !== null)
    throw new Error('Editorial cleanup requires a pending erasure request');
  return state;
}
