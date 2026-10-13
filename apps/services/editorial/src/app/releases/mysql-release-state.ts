import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';
import { lockIdentityWrites } from '@sdk/extras/identity-mysql';
import type { EntityManager } from 'typeorm';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import {
  parseReleaseDraft,
  parseReleaseFields,
  parseReleasePublicationStatus,
  parseReleaseSubmission,
  releaseId,
  releaseRevision,
  releaseTimestamp,
  ReleaseConflictError,
  ReleaseInputError,
  ReleaseNotFoundError,
  ReleaseUnavailableError,
  type ReleaseDraft,
  type ReleaseFields,
  type ReleasePublicationStatus,
  type ReleaseTarget,
} from '@domains/catalog/versioning';
import type { EditorialActor } from '../application/editorial.ports';
import { isEditorialScope } from '../application/editorial-materialization';
import {
  applicationPublicState,
  hasApplicationAuthoringAuthority,
} from '../application-publication/application-public-state';
import { assertReleaseAccess } from './release-workspace';

export interface ReleaseDraftRow {
  id: string;
  tenantId: string;
  ownerIdentityId: string;
  applicationId: string;
  releaseId: string;
  claimId: string;
  sourcePublicationRevision: string | number | null;
  fields: unknown;
  revision: string | number;
  createdAt: string | number;
  updatedAt: string | number;
  deletedAt: string | number | null;
}
export interface CanonicalRelease {
  id: string;
  tenantId: string;
  ownerIdentityId: string | null;
  applicationId: string;
  version: string;
  fields: ReleaseFields;
  publishedAt: number;
  draftId: string;
  submittedRevision: number;
  revision: number;
  deletedAt: number | null;
}
export function releaseJson(input: unknown): unknown {
  return typeof input === 'string' ? JSON.parse(input) : input;
}
export function releaseDraftFromRow(row: ReleaseDraftRow): ReleaseDraft {
  try {
    return parseReleaseDraft({
      ...parseReleaseFields(releaseJson(row.fields)),
      id: row.id,
      target: {
        applicationId: row.applicationId,
        releaseId: row.releaseId,
        claimId: row.claimId,
        sourcePublicationRevision:
          row.sourcePublicationRevision === null
            ? null
            : Number(row.sourcePublicationRevision),
      },
      revision: Number(row.revision),
      createdAt: Number(row.createdAt),
      updatedAt: Number(row.updatedAt),
    });
  } catch {
    throw new ReleaseUnavailableError('Stored release draft is invalid');
  }
}
export function releaseSubmissionFromRow(row: Record<string, unknown>) {
  try {
    return parseReleaseSubmission({
      ...parseReleaseFields(releaseJson(row.fields)),
      target: releaseJson(row.target),
      submittedRevision: Number(row.submittedRevision),
      submittedAt: Number(row.submittedAt),
      reviewedAt: row.reviewedAt === null ? null : Number(row.reviewedAt),
      status: row.status,
      reason: row.reason,
    });
  } catch {
    throw new ReleaseUnavailableError('Stored release submission is invalid');
  }
}
export async function releaseDraftRow(
  manager: EntityManager,
  actor: EditorialActor,
  id: string,
  review = false,
  lock = false
) {
  const [row] = await manager.query<ReleaseDraftRow[]>(
    `SELECT * FROM release_drafts WHERE id = ? AND tenantId = ?${
      review ? '' : ' AND ownerIdentityId = ?'
    }${lock ? ' FOR UPDATE' : ''}`,
    [id, actor.tenantId, ...(review ? [] : [actor.identityId])]
  );
  if (!row) throw new ReleaseNotFoundError('Release draft not found');
  assertReleaseAccess(actor, row, review);
  return row;
}

export async function lockReleaseWorkspaces(
  manager: EntityManager,
  tenant: string,
  owners: string[]
) {
  // A staff command also locks its actor's receipt namespace. Sort to avoid crossed review deadlocks.
  await lockIdentityWrites(manager, owners);
  for (const owner of [...new Set(owners)].sort()) {
    await manager.query(
      'INSERT INTO release_workspaces (tenantId, ownerIdentityId) VALUES (?, ?) ON DUPLICATE KEY UPDATE ownerIdentityId = ownerIdentityId',
      [tenant, owner]
    );
    await manager.query(
      'SELECT ownerIdentityId FROM release_workspaces WHERE tenantId = ? AND ownerIdentityId = ? FOR UPDATE',
      [tenant, owner]
    );
  }
}

export async function assertReleaseGrant(
  manager: EntityManager,
  owner: { tenantId: string; ownerIdentityId: string },
  target: Pick<ReleaseTarget, 'applicationId' | 'claimId'>,
  lock: boolean,
  requireVisible = true
) {
  const state = await applicationPublicState(
    manager,
    target.applicationId,
    lock
  );
  if (
    !(await hasApplicationAuthoringAuthority(
      manager,
      target.applicationId,
      state,
      owner,
      target.claimId
    ))
  )
    throw new PermissionDeniedError('editorial.release.ownership');
  if (
    !state ||
    (requireVisible && (state.deletedAt !== null || state.isSuspended))
  )
    throw new ReleaseConflictError(
      'The parent application must be available before publishing release notes'
    );
  return state;
}

export async function canonicalRelease(
  manager: EntityManager,
  id: string,
  lock = false
): Promise<CanonicalRelease | null> {
  const [publication] = await manager.query<Record<string, unknown>[]>(
    'SELECT * FROM release_publications WHERE releaseId = ?' +
      (lock ? ' FOR UPDATE' : ''),
    [id]
  );
  const [state] = await manager.query<Record<string, unknown>[]>(
    "SELECT * FROM editorial_resource_states WHERE resourceKind = 'release' AND resourceId = ?" +
      (lock ? ' FOR UPDATE' : ''),
    [id]
  );
  if (!publication && !state) return null;
  if (!publication || !state || publication.tenantId !== state.tenantId)
    throw new ReleaseUnavailableError(
      'Release publication authority is incomplete'
    );
  try {
    const fields = parseReleaseFields(releaseJson(publication.fields));
    if (fields.version !== publication.version)
      throw new Error('Version differs from canonical URL');
    if (
      !isEditorialScope(publication.tenantId) ||
      !(
        state.ownerIdentityId === null ||
        isEditorialScope(state.ownerIdentityId)
      )
    )
      throw new Error('Invalid release publication scope');
    return {
      id: releaseId(id),
      tenantId: publication.tenantId,
      ownerIdentityId: state.ownerIdentityId,
      applicationId: releaseId(publication.applicationId),
      version: fields.version,
      fields,
      publishedAt: releaseTimestamp(Number(publication.publishedAt)),
      draftId: releaseId(publication.draftId),
      submittedRevision: releaseRevision(Number(publication.submittedRevision)),
      revision: releaseRevision(Number(state.revision)),
      deletedAt:
        state.deletedAt === null
          ? null
          : releaseTimestamp(Number(state.deletedAt)),
    };
  } catch {
    throw new ReleaseUnavailableError('Stored public release is invalid');
  }
}

export function assertReleaseTarget(
  publication: CanonicalRelease | null,
  owner: { tenantId: string },
  target: ReleaseTarget
) {
  if (
    publication &&
    (publication.tenantId !== owner.tenantId ||
      publication.applicationId !== target.applicationId)
  )
    throw new ReleaseUnavailableError(
      'Release target authority is inconsistent'
    );
}
export async function releaseStatus(
  manager: EntityManager,
  row: ReleaseDraftRow,
  publication: CanonicalRelease | null
): Promise<ReleasePublicationStatus> {
  const [stored] = await manager.query<Record<string, unknown>[]>(
    'SELECT * FROM release_submissions WHERE draftId = ? ORDER BY submittedRevision DESC LIMIT 1',
    [row.id]
  );
  const submission = stored ? releaseSubmissionFromRow(stored) : null;
  if (
    submission &&
    (submission.target.applicationId !== row.applicationId ||
      submission.target.releaseId !== row.releaseId ||
      submission.target.claimId !== row.claimId)
  )
    throw new ReleaseUnavailableError(
      'Release submission target is inconsistent'
    );
  const visible = publication && publication.deletedAt === null;
  const [application] = await manager.query<
    { id: string; name: string; slug: string }[]
  >(
    `SELECT a.id, a.name, a.slug FROM app_records a
     JOIN editorial_resource_states s ON s.resourceKind = 'app' AND s.resourceId = a.id
     WHERE a.id = ? AND s.tenantId = ? AND s.deletedAt IS NULL AND a.isSuspended = 0`,
    [row.applicationId, row.tenantId]
  );
  try {
    return parseReleasePublicationStatus({
      application: application ?? null,
      id: row.id,
      revision: Number(row.revision),
      publicationRevision: publication?.revision ?? null,
      publishedSubmissionRevision:
        visible && publication.draftId === row.id
          ? publication.submittedRevision
          : null,
      publicVersion: visible ? publication.version : null,
      latestSubmission: submission,
    });
  } catch {
    throw new ReleaseUnavailableError(
      'Stored release publication status is invalid'
    );
  }
}

export async function cancelReleaseReview(
  manager: EntityManager,
  id: string,
  at: number
) {
  await manager.query(
    "UPDATE release_submissions SET status = 'cancelled', reviewedAt = ? WHERE draftId = ? AND status = 'submitted'",
    [at, id]
  );
}

/** Canonical content/lifecycle, receipt and this intent share the caller's SQL transaction. */
export async function advanceReleasePublication(
  manager: EntityManager,
  actor: EditorialActor,
  owner: string,
  id: string,
  previous: CanonicalRelease | null,
  at: number,
  visible: boolean
) {
  if (!previous && !visible) return null;
  const revision = releaseRevision((previous?.revision ?? 0) + 1);
  await manager.query(
    `INSERT INTO editorial_resource_states (resourceKind, resourceId, tenantId, ownerIdentityId, revision, deletedAt)
     VALUES ('release', ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE ownerIdentityId = VALUES(ownerIdentityId), revision = VALUES(revision), deletedAt = VALUES(deletedAt)`,
    [
      id,
      actor.tenantId,
      visible ? owner : previous?.ownerIdentityId,
      revision,
      visible ? null : at,
    ]
  );
  await manager.query(
    `INSERT INTO editorial_outbox (resourceKind, resourceId, tenantId, revision, operation, actorIdentityId, createdAt, availableAt)
     VALUES ('release', ?, ?, ?, ?, ?, ?, ?)`,
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
  return revision;
}

export async function guardReleaseStore<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof CanonicalIdentityAccessDenied ||
      error instanceof ReleaseInputError ||
      error instanceof ReleaseConflictError ||
      error instanceof ReleaseNotFoundError ||
      error instanceof ReleaseUnavailableError ||
      error instanceof PermissionDeniedError
    )
      throw error;
    throw new ReleaseUnavailableError(
      'Could not confirm the release operation. Retry with the same Idempotency-Key.'
    );
  }
}
