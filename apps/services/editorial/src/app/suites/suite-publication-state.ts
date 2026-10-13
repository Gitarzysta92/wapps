import { advanceContentUpdateCursor } from '@sdk/extras/mysql';
import type { EntityManager } from 'typeorm';
import {
  SuiteConflictError,
  SuiteUnavailableError,
} from '@domains/publication/suite';
import type { EditorialActor } from '../application/editorial.ports';

export interface SuitePublicState {
  tenantId: string;
  ownerIdentityId: string | null;
  revision: number | string;
  deletedAt: number | string | null;
}

export async function suitePublicState(
  manager: EntityManager,
  id: string,
  lock = false
): Promise<SuitePublicState | null> {
  const [state] = await manager.query<SuitePublicState[]>(
    `SELECT tenantId, ownerIdentityId, revision, deletedAt FROM editorial_resource_states WHERE resourceKind = 'suite' AND resourceId = ?${
      lock ? ' FOR UPDATE' : ''
    }`,
    [id]
  );
  return state ?? null;
}

/** Public lifecycle and its durable wake-up always share the caller's transaction. */
export async function advanceSuitePublication(
  manager: EntityManager,
  id: string,
  ownerIdentityId: string,
  actor: EditorialActor,
  at: number,
  visible: boolean
): Promise<number | null> {
  const previous = await suitePublicState(manager, id, true);
  if (!previous && !visible) return null;
  if (
    previous &&
    (previous.tenantId !== actor.tenantId ||
      previous.ownerIdentityId !== ownerIdentityId)
  )
    throw new SuiteUnavailableError(
      'Suite publication ownership is inconsistent'
    );
  const revision = Number(previous?.revision ?? 0) + 1;
  if (!Number.isSafeInteger(revision))
    throw new SuiteConflictError('Suite publication revision limit reached');
  await manager.query(
    `INSERT INTO editorial_resource_states (resourceKind, resourceId, tenantId, ownerIdentityId, revision, deletedAt)
     VALUES ('suite', ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE revision = VALUES(revision), deletedAt = VALUES(deletedAt)`,
    [id, actor.tenantId, ownerIdentityId, revision, visible ? null : at]
  );
  await manager.query(
    `INSERT INTO editorial_outbox (resourceKind, resourceId, tenantId, revision, operation, actorIdentityId, createdAt, availableAt)
     VALUES ('suite', ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      actor.tenantId,
      revision,
      visible ? 'publish' : 'withdraw',
      actor.identityId,
      at,
      at,
    ]
  );
  if (visible) await advanceContentUpdateCursor(manager, 'suites', id, at);
  return revision;
}

export async function deleteSuitePublication(
  manager: EntityManager,
  id: string,
  actor: EditorialActor,
  at: number
): Promise<void> {
  await advanceSuitePublication(
    manager,
    id,
    actor.identityId,
    actor,
    at,
    false
  );
  await manager.query('DELETE FROM suite_publications WHERE suiteId = ?', [id]);
  await manager.query('DELETE FROM suite_submissions WHERE suiteId = ?', [id]);
}
