import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';
import { lockIdentityWrites } from '@wapps/account-mysql';
import type { DataSource, EntityManager } from 'typeorm';
import type { ApplicationImageSet } from '@domains/catalog/media';
import {
  draftApplicationImages,
  submittedApplicationImages,
  freezeApplicationImages,
  publishApplicationImages,
} from '../application-media/application-image-bindings';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import {
  assertApplicationPublicationTransition,
  parseApplicationDraft,
  parseApplicationPublicationReceipt,
  parseApplicationPublicationStatus,
  parseApplicationSubmission,
  ApplicationDraftConflictError,
  ApplicationDraftInputError,
  ApplicationDraftNotFoundError,
  ApplicationDraftUnavailableError,
  type ApplicationPublicationReceipt,
  type ApplicationPublicationStatus,
  type ApplicationSubmission,
} from '@domains/catalog/record';
import type { EditorialActor } from '../application/editorial.ports';
import { applicationEditingTarget } from '../application-drafts/application-editing-target';
import {
  assertApplicationPublicationAccess,
  type ApplicationOwner,
  type ApplicationPublicationCommand,
  type ApplicationPublicationStore,
} from './application-publication';
import {
  advanceApplicationPublication,
  applicationPublicState,
  hasApplicationAuthoringAuthority,
} from './application-public-state';

interface DraftRow extends ApplicationOwner {
  id: string;
  revision: string | number;
  name: string;
  slug: string;
  website: string;
  description: string;
  classification?: unknown;
  createdAt: string | number;
  updatedAt: string | number;
  deletedAt: string | number | null;
}

export function applicationSubmissionFromRow(
  row: Record<string, unknown>,
  images?: ApplicationImageSet | null
): ApplicationSubmission {
  try {
    return parseApplicationSubmission({
      name: row['name'],
      slug: row['slug'],
      website: row['website'],
      description: row['description'],
      classification: row['classification'] ?? undefined,
      basePublicationRevision:
        row['basePublicationRevision'] === null
          ? null
          : Number(row['basePublicationRevision']),
      submittedRevision: Number(row.submittedRevision),
      status: row.status,
      submittedAt: Number(row.submittedAt),
      reviewedAt: row.reviewedAt === null ? null : Number(row.reviewedAt),
      reason: row.reason,
      ...(images === undefined ? {} : { images }),
    });
  } catch {
    throw new ApplicationDraftUnavailableError(
      'Stored application submission is invalid'
    );
  }
}

export class MysqlApplicationPublication
  implements ApplicationPublicationStore
{
  constructor(
    private readonly source: DataSource,
    private readonly publicMediaOrigin?: string
  ) {}

  async read(actor: EditorialActor, id: string, review: boolean) {
    return this.guard(() =>
      this.source.transaction('REPEATABLE READ', async (manager) => {
        const row = await this.draft(manager, actor, id, review);
        if (row.deletedAt !== null)
          throw new ApplicationDraftNotFoundError(
            'Application draft not found'
          );
        return this.status(manager, row);
      })
    );
  }

  async reviews(actor: EditorialActor, page: number) {
    return this.guard(() =>
      this.source.transaction('REPEATABLE READ', async (manager) => {
        const parameters = [actor.tenantId, actor.identityId];
        const where = `FROM application_submissions s JOIN application_drafts p ON p.id = s.applicationId
        WHERE s.tenantId = ? AND s.ownerIdentityId <> ? AND s.status = 'submitted' AND p.deletedAt IS NULL
        AND p.tenantId = s.tenantId AND p.ownerIdentityId = s.ownerIdentityId`;
        const [count] = await manager.query<{ total: string | number }[]>(
          `SELECT COUNT(*) AS total ${where}`,
          parameters
        );
        const rows = await manager.query<DraftRow[]>(
          `SELECT p.* ${where} ORDER BY s.submittedAt, s.applicationId LIMIT 20 OFFSET ?`,
          [...parameters, (page - 1) * 20]
        );
        const items: ApplicationPublicationStatus[] = [];
        for (const row of rows) items.push(await this.status(manager, row));
        return { items, page, total: Number(count.total) };
      })
    );
  }

  async commit(
    command: ApplicationPublicationCommand
  ): Promise<ApplicationPublicationReceipt> {
    return this.guard(() =>
      this.source.transaction('READ COMMITTED', async (manager) => {
        const { actor, action, id, key, input } = command;
        const reviewing = action === 'approve' || action === 'reject';
        const owner = await this.draft(manager, actor, id, reviewing);
        await lockIdentityWrites(manager, [
          actor.identityId,
          owner.ownerIdentityId,
        ]);
        // The same owner lock also serializes draft writes/deletion and workspace capacity.
        const locks = await manager.query(
          'SELECT ownerIdentityId FROM application_workspaces WHERE tenantId = ? AND ownerIdentityId = ? FOR UPDATE',
          [owner.tenantId, owner.ownerIdentityId]
        );
        if (locks.length !== 1)
          throw new ApplicationDraftUnavailableError(
            'Application workspace is missing'
          );
        const row = await this.draft(manager, actor, id, reviewing, true);
        const [receipt] = await manager.query<
          { fingerprint: string; receipt: unknown }[]
        >(
          'SELECT fingerprint, receipt FROM application_publication_commands WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?',
          [actor.tenantId, actor.identityId, key]
        );
        if (receipt) {
          if (receipt.fingerprint !== command.fingerprint)
            throw new ApplicationDraftConflictError(
              'Idempotency-Key was used for another command'
            );
          try {
            return parseApplicationPublicationReceipt(
              typeof receipt.receipt === 'string'
                ? JSON.parse(receipt.receipt)
                : receipt.receipt
            );
          } catch {
            throw new ApplicationDraftUnavailableError(
              'Stored application publication receipt is invalid'
            );
          }
        }
        if (row.deletedAt !== null)
          throw new ApplicationDraftNotFoundError(
            'Application draft not found'
          );
        const editing = await applicationEditingTarget(manager, id);
        const applicationId = editing?.applicationId ?? id;
        const publicState = await applicationPublicState(
          manager,
          applicationId,
          true
        );
        if (
          action !== 'reject' &&
          !(await hasApplicationAuthoringAuthority(
            manager,
            applicationId,
            publicState,
            row,
            editing?.claimId ?? null
          ))
        )
          throw new PermissionDeniedError('editorial.application.publication');
        if (
          editing &&
          (action === 'submit' || action === 'withdraw') &&
          editing.sourcePublicationRevision !== Number(publicState?.revision)
        )
          throw new ApplicationDraftConflictError(
            'The canonical application changed. Reload its current content and explicitly merge your private edits before continuing.'
          );
        const status = await this.status(manager, row);
        assertApplicationPublicationTransition(action, status, input);
        const revision = status.revision + 1;
        const at = Math.max(command.at, Number(row.updatedAt));
        let submittedRevision = input.submittedRevision;
        let publicationRevision = status.publicationRevision;
        if (action === 'submit') {
          const draft = parseApplicationDraft({
            id,
            revision: status.revision,
            name: row.name,
            slug: row.slug,
            website: row.website,
            description: row.description,
            classification: row.classification ?? undefined,
            createdAt: Number(row.createdAt),
            updatedAt: Number(row.updatedAt),
            images: await draftApplicationImages(manager, id),
          });
          if (
            status.latestSubmission?.status === 'submitted' &&
            status.latestSubmission.images === null
          )
            await manager.query(
              "UPDATE application_submissions SET status = 'cancelled', reviewedAt = ? WHERE applicationId = ? AND submittedRevision = ? AND status = 'submitted'",
              [at, id, status.latestSubmission.submittedRevision]
            );
          submittedRevision = draft.revision;
          await manager.query(
            `INSERT INTO application_submissions
          (applicationId, submittedRevision, tenantId, ownerIdentityId, name, slug, website, description, classification, basePublicationRevision, status, reason, submittedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', '', ?)`,
            [
              id,
              submittedRevision,
              actor.tenantId,
              row.ownerIdentityId,
              draft.name,
              draft.slug,
              draft.website,
              draft.description,
              draft.classification ?? null,
              status.publicationRevision,
              at,
            ]
          );
          if (!draft.images)
            throw new ApplicationDraftUnavailableError(
              'Draft image snapshot is missing'
            );
          await freezeApplicationImages(
            manager,
            id,
            submittedRevision,
            draft.images,
            row.tenantId
          );
        } else if (action === 'approve' || action === 'reject') {
          if (!status.latestSubmission)
            throw new ApplicationDraftConflictError('Submission is missing');
          await manager.query(
            `UPDATE application_submissions SET status = ?, reason = ?, reviewerIdentityId = ?, reviewedAt = ?
          WHERE applicationId = ? AND submittedRevision = ? AND status = 'submitted'`,
            [
              action === 'approve' ? 'approved' : 'rejected',
              input.reason,
              actor.identityId,
              at,
              id,
              submittedRevision,
            ]
          );
          if (action === 'approve') {
            publicationRevision = await advanceApplicationPublication(
              manager,
              applicationId,
              row.ownerIdentityId,
              actor,
              at,
              status.latestSubmission
            );
            if (!status.latestSubmission.images || publicationRevision === null)
              throw new ApplicationDraftConflictError(
                'The submission has no complete image snapshot. Resubmit before approval.'
              );
            await publishApplicationImages(
              manager,
              applicationId,
              status.latestSubmission.images,
              publicationRevision,
              row.tenantId,
              this.publicMediaOrigin
            );
            await manager.query(
              `INSERT INTO application_publications (applicationId, submittedRevision, publicationRevision, publishedAt) VALUES (?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE submittedRevision = VALUES(submittedRevision), publicationRevision = VALUES(publicationRevision), publishedAt = VALUES(publishedAt)`,
              [id, submittedRevision, publicationRevision, at]
            );
            if (editing)
              await manager.query(
                'UPDATE application_editing_targets SET sourcePublicationRevision = ? WHERE draftId = ?',
                [publicationRevision, id]
              );
          }
        } else {
          if (status.latestSubmission?.status === 'submitted') {
            submittedRevision = status.latestSubmission.submittedRevision;
            await manager.query(
              "UPDATE application_submissions SET status = 'cancelled', reviewedAt = ? WHERE applicationId = ? AND submittedRevision = ? AND status = 'submitted'",
              [at, id, submittedRevision]
            );
          }
          if (status.publicSlug !== null)
            publicationRevision = await advanceApplicationPublication(
              manager,
              applicationId,
              row.ownerIdentityId,
              actor,
              at,
              null
            );
          if (editing && publicationRevision !== null)
            await manager.query(
              'UPDATE application_editing_targets SET sourcePublicationRevision = ? WHERE draftId = ?',
              [publicationRevision, id]
            );
        }
        await manager.query(
          'UPDATE application_drafts SET revision = ?, updatedAt = ? WHERE id = ?',
          [revision, at, id]
        );
        const result: ApplicationPublicationReceipt = {
          id,
          revision,
          action,
          submittedRevision,
          publicationRevision,
        };
        await manager.query(
          `INSERT INTO application_publication_commands (tenantId, actorIdentityId, commandKey, fingerprint, applicationId, receipt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            actor.tenantId,
            actor.identityId,
            key,
            command.fingerprint,
            id,
            JSON.stringify(result),
            at,
          ]
        );
        return result;
      })
    );
  }

  private async draft(
    manager: EntityManager,
    actor: EditorialActor,
    id: string,
    review: boolean,
    lock = false
  ) {
    const [row] = await manager.query<DraftRow[]>(
      `SELECT * FROM application_drafts WHERE id = ? AND tenantId = ?${
        review ? '' : ' AND ownerIdentityId = ?'
      }${lock ? ' FOR UPDATE' : ''}`,
      [id, actor.tenantId, ...(review ? [] : [actor.identityId])]
    );
    if (!row)
      throw new ApplicationDraftNotFoundError('Application draft not found');
    assertApplicationPublicationAccess(actor, row, review);
    return row;
  }

  private async status(
    manager: EntityManager,
    row: DraftRow
  ): Promise<ApplicationPublicationStatus> {
    const [submission] = await manager.query<Record<string, unknown>[]>(
      'SELECT * FROM application_submissions WHERE applicationId = ? ORDER BY submittedRevision DESC LIMIT 1',
      [row.id]
    );
    const editing = await applicationEditingTarget(manager, row.id);
    const state = await applicationPublicState(
      manager,
      editing?.applicationId ?? row.id
    );
    const [publication] = await manager.query<
      {
        submittedRevision: number | string;
        publicationRevision: number | string;
      }[]
    >(
      'SELECT submittedRevision, publicationRevision FROM application_publications WHERE applicationId = ?',
      [row.id]
    );
    if (
      (state && state.tenantId !== row.tenantId) ||
      (publication && !state) ||
      (submission &&
        (submission.tenantId !== row.tenantId ||
          submission.ownerIdentityId !== row.ownerIdentityId))
    )
      throw new ApplicationDraftUnavailableError(
        'Application publication ownership is inconsistent'
      );
    try {
      return parseApplicationPublicationStatus({
        id: row.id,
        revision: Number(row.revision),
        publicationRevision: state ? Number(state.revision) : null,
        publishedSubmissionRevision:
          state &&
          state.deletedAt === null &&
          !state.isSuspended &&
          publication &&
          Number(publication.publicationRevision) === Number(state.revision)
            ? Number(publication.submittedRevision)
            : null,
        publicSlug:
          state && state.deletedAt === null && !state.isSuspended
            ? state.slug
            : null,
        latestSubmission: submission
          ? applicationSubmissionFromRow(
              submission,
              await submittedApplicationImages(
                manager,
                row.id,
                Number(submission.submittedRevision)
              )
            )
          : null,
        ...(editing ? { editing } : {}),
      });
    } catch {
      throw new ApplicationDraftUnavailableError(
        'Stored application publication status is invalid'
      );
    }
  }

  private async guard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY'
      )
        throw new ApplicationDraftConflictError(
          'The public slug or command key is already in use. Reload before continuing.'
        );
      if (
        error instanceof CanonicalIdentityAccessDenied ||
        error instanceof ApplicationDraftInputError ||
        error instanceof ApplicationDraftConflictError ||
        error instanceof ApplicationDraftNotFoundError ||
        error instanceof ApplicationDraftUnavailableError ||
        error instanceof PermissionDeniedError
      )
        throw error;
      throw new ApplicationDraftUnavailableError(
        'Could not confirm application publication. Retry with the same Idempotency-Key.'
      );
    }
  }
}
