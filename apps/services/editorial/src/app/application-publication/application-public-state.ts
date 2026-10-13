import { advanceContentUpdateCursor } from '@sdk/extras/mysql';
import type { EntityManager } from 'typeorm';
import {
  ApplicationDraftConflictError,
  ApplicationDraftUnavailableError,
  type ApplicationDraftFields,
} from '@domains/catalog/record';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import type { EditorialActor } from '../application/editorial.ports';

export interface ApplicationPublicState {
  tenantId: string;
  ownerIdentityId: string | null;
  revision: number | string;
  deletedAt: number | string | null;
  slug: string;
  isSuspended: number;
}
export async function applicationPublicState(
  manager: EntityManager,
  id: string,
  lock = false
): Promise<ApplicationPublicState | null> {
  // Match the direct Editorial write lock order: catalog row, then lifecycle state.
  const records = await manager.query(
    'SELECT id FROM app_records WHERE id = ?' + (lock ? ' FOR UPDATE' : ''),
    [id]
  );
  const [state] = await manager.query<ApplicationPublicState[]>(
    `SELECT s.tenantId, s.ownerIdentityId, s.revision, s.deletedAt, a.slug, a.isSuspended FROM editorial_resource_states s
    LEFT JOIN app_records a ON a.id = s.resourceId WHERE s.resourceKind = 'app' AND s.resourceId = ?${
      lock ? ' FOR UPDATE' : ''
    }`,
    [id]
  );
  if (!!records.length !== !!state)
    throw new ApplicationDraftUnavailableError(
      'Application publication authority is incomplete'
    );
  return state ?? null;
}
export function assertApplicationPublicOwner(
  state: ApplicationPublicState | null,
  owner: { ownerIdentityId: string; tenantId: string }
) {
  if (
    state &&
    (state.ownerIdentityId !== owner.ownerIdentityId ||
      state.tenantId !== owner.tenantId)
  )
    throw new PermissionDeniedError('editorial.application.publication');
}
/** Call under the canonical application lock before changing public content. */
export async function hasApplicationAuthoringAuthority(
  manager: EntityManager,
  id: string,
  state: ApplicationPublicState | null,
  owner: { ownerIdentityId: string; tenantId: string },
  claimId: string | null = null
): Promise<boolean> {
  if (
    state &&
    (state.ownerIdentityId !== owner.ownerIdentityId ||
      state.tenantId !== owner.tenantId)
  )
    return false;
  const [grant] = await manager.query<
    {
      tenantId: string;
      claimantIdentityId: string;
      claimId: string;
      revokedAt: number | string | null;
    }[]
  >('SELECT * FROM application_ownership_grants WHERE applicationId = ?', [id]);
  // A grant history permanently retires unbound authoring, including the same author's old drafts.
  if (claimId === null) {
    const history = await manager.query(
      'SELECT applicationId FROM application_ownership_history WHERE applicationId=?',
      [id]
    );
    return !grant && !history.length;
  }
  return !!(
    state &&
    grant &&
    grant.revokedAt === null &&
    grant.claimId === claimId &&
    grant.tenantId === owner.tenantId &&
    grant.claimantIdentityId === owner.ownerIdentityId
  );
}
/** Publish/withdraw shares the caller's transaction, including canonical content, lifecycle and outbox. */
export async function advanceApplicationPublication(
  manager: EntityManager,
  id: string,
  ownerIdentityId: string,
  actor: EditorialActor,
  at: number,
  fields: ApplicationDraftFields | null
): Promise<number | null> {
  const previous = await applicationPublicState(manager, id, true);
  assertApplicationPublicOwner(previous, {
    tenantId: actor.tenantId,
    ownerIdentityId,
  });
  if (!previous && !fields) return null;
  if (!fields && previous?.deletedAt !== null)
    return previous ? Number(previous.revision) : null;
  if (fields && previous?.isSuspended)
    throw new ApplicationDraftConflictError(
      'A suspended application requires moderation before publication'
    );
  const revision = Number(previous?.revision ?? 0) + 1;
  if (!Number.isSafeInteger(revision))
    throw new ApplicationDraftConflictError(
      'Application publication revision limit reached'
    );
  const timestamp = new Date(at).toISOString().slice(0, 23).replace('T', ' ');
  if (fields) {
    if (previous)
      await manager.query(
        'UPDATE app_records SET name = ?, slug = ?, website = ?, description = ?, classification = ?, updatedAt = ? WHERE id = ?',
        [
          fields.name,
          fields.slug,
          fields.website,
          fields.description,
          fields.classification ?? null,
          timestamp,
          id,
        ]
      );
    else
      await manager.query(
        'INSERT INTO app_records (id, name, slug, website, description, classification, isPwa, isSuspended, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)',
        [
          id,
          fields.name,
          fields.slug,
          fields.website,
          fields.description,
          fields.classification ?? null,
          timestamp,
          timestamp,
        ]
      );
  }
  await manager.query(
    `INSERT INTO editorial_resource_states (resourceKind, resourceId, tenantId, ownerIdentityId, revision, deletedAt)
    VALUES ('app', ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE revision = VALUES(revision), deletedAt = VALUES(deletedAt)`,
    [id, actor.tenantId, ownerIdentityId, revision, fields ? null : at]
  );
  await manager.query(
    `INSERT INTO editorial_outbox (resourceKind, resourceId, tenantId, revision, operation, actorIdentityId, createdAt, availableAt)
    VALUES ('app', ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      actor.tenantId,
      revision,
      fields ? 'publish' : 'withdraw',
      actor.identityId,
      at,
      at,
    ]
  );
  if (fields) await advanceContentUpdateCursor(manager, 'applications', id, at);
  return revision;
}
export async function deleteApplicationPublication(
  manager: EntityManager,
  id: string,
  actor: EditorialActor,
  at: number,
  privateOnly = false
) {
  const state = privateOnly
    ? null
    : await applicationPublicState(manager, id, true);
  if (
    !privateOnly &&
    (await hasApplicationAuthoringAuthority(manager, id, state, {
      tenantId: actor.tenantId,
      ownerIdentityId: actor.identityId,
    }))
  ) {
    await advanceApplicationPublication(
      manager,
      id,
      actor.identityId,
      actor,
      at,
      null
    );
    await manager.query(
      "UPDATE app_records SET name = '', website = NULL, description = NULL, classification = NULL, logoUrl = NULL, bannerUrl = NULL WHERE id = ?",
      [id]
    );
    await manager.query(
      'DELETE FROM application_published_images WHERE applicationId = ?',
      [id]
    );
  }
  await manager.query(
    'DELETE FROM application_publications WHERE applicationId = ?',
    [id]
  );
  await manager.query(
    'DELETE FROM application_submissions WHERE applicationId = ?',
    [id]
  );
  await manager.query(
    'DELETE FROM application_submission_images WHERE draftId = ?',
    [id]
  );
}
