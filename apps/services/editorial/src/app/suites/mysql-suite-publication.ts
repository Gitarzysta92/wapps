import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';
import { lockIdentityWrites } from '@wapps/account-mysql';
import type { DataSource, EntityManager } from 'typeorm';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import {
  assertSuitePublicationTransition,
  parsePrivateSuite,
  parseSuitePublicationReceipt,
  parseSuitePublicationStatus,
  parseSuiteSubmission,
  SuiteConflictError,
  SuiteInputError,
  SuiteNotFoundError,
  SuiteUnavailableError,
  type SuitePublicationReceipt,
  type SuitePublicationStatus,
  type SuiteSubmission,
} from '@domains/publication/suite';
import type { EditorialActor } from '../application/editorial.ports';
import {
  assertSuitePublicationAccess,
  type SuiteOwner,
  type SuitePublicationCommand,
  type SuitePublicationStore,
} from './suite-publication';
import {
  advanceSuitePublication,
  suitePublicState,
} from './suite-publication-state';
import { suitePublicationFields } from './suite-publication-fields';

interface DraftRow extends SuiteOwner {
  id: string;
  revision: string | number;
  title: string;
  description: string;
  classification?: unknown;
  applicationIds: unknown;
  createdAt: string | number;
  updatedAt: string | number;
  deletedAt: string | number | null;
}

export function suiteSubmissionFromRow(
  row: Record<string, unknown>
): SuiteSubmission {
  try {
    return parseSuiteSubmission({
      title: row.title,
      description: row.description,
      classification: row.classification ?? undefined,
      applicationIds:
        typeof row.applicationIds === 'string'
          ? JSON.parse(row.applicationIds)
          : row.applicationIds,
      submittedRevision: Number(row.submittedRevision),
      status: row.status,
      submittedAt: Number(row.submittedAt),
      reviewedAt: row.reviewedAt === null ? null : Number(row.reviewedAt),
      reason: row.reason,
    });
  } catch {
    throw new SuiteUnavailableError('Stored suite submission is invalid');
  }
}

export class MysqlSuitePublication implements SuitePublicationStore {
  constructor(
    private readonly source: DataSource,
    private readonly publicTenant: string
  ) {}

  async read(actor: EditorialActor, id: string, review: boolean) {
    return this.guard(() =>
      this.source.transaction('REPEATABLE READ', async (manager) => {
        const row = await this.draft(manager, actor, id, review);
        if (row.deletedAt !== null)
          throw new SuiteNotFoundError('Suite not found');
        return this.status(manager, row);
      })
    );
  }

  async reviews(actor: EditorialActor, page: number) {
    return this.guard(() =>
      this.source.transaction('REPEATABLE READ', async (manager) => {
        const parameters = [actor.tenantId, actor.identityId];
        const where = `FROM suite_submissions s JOIN private_suites p ON p.id = s.suiteId
        WHERE s.tenantId = ? AND s.ownerIdentityId <> ? AND s.status = 'submitted' AND p.deletedAt IS NULL
        AND p.tenantId = s.tenantId AND p.ownerIdentityId = s.ownerIdentityId`;
        const [count] = await manager.query<{ total: string | number }[]>(
          `SELECT COUNT(*) AS total ${where}`,
          parameters
        );
        const rows = await manager.query<DraftRow[]>(
          `SELECT p.* ${where} ORDER BY s.submittedAt, s.suiteId LIMIT 20 OFFSET ?`,
          [...parameters, (page - 1) * 20]
        );
        const items: SuitePublicationStatus[] = [];
        for (const row of rows) items.push(await this.status(manager, row));
        return { items, page, total: Number(count.total) };
      })
    );
  }

  async commit(
    command: SuitePublicationCommand
  ): Promise<SuitePublicationReceipt> {
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
          'SELECT ownerIdentityId FROM suite_workspaces WHERE tenantId = ? AND ownerIdentityId = ? FOR UPDATE',
          [owner.tenantId, owner.ownerIdentityId]
        );
        if (locks.length !== 1)
          throw new SuiteUnavailableError('Suite workspace is missing');
        const row = await this.draft(manager, actor, id, reviewing, true);
        const [receipt] = await manager.query<
          { fingerprint: string; receipt: unknown }[]
        >(
          'SELECT fingerprint, receipt FROM suite_publication_commands WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?',
          [actor.tenantId, actor.identityId, key]
        );
        if (receipt) {
          if (receipt.fingerprint !== command.fingerprint)
            throw new SuiteConflictError(
              'Idempotency-Key was used for another command'
            );
          try {
            return parseSuitePublicationReceipt(
              typeof receipt.receipt === 'string'
                ? JSON.parse(receipt.receipt)
                : receipt.receipt
            );
          } catch {
            throw new SuiteUnavailableError(
              'Stored suite publication receipt is invalid'
            );
          }
        }
        if (row.deletedAt !== null)
          throw new SuiteNotFoundError('Suite not found');
        const status = await this.status(manager, row);
        assertSuitePublicationTransition(action, status, input);
        const revision = status.revision + 1;
        const at = Math.max(command.at, Number(row.updatedAt));
        let submittedRevision = input.submittedRevision;
        let publicationRevision = status.publicationRevision;
        if (action === 'submit') {
          const draft = parsePrivateSuite({
            id,
            revision: status.revision,
            visibility: 'private',
            title: row.title,
            description: row.description,
            classification: row.classification ?? undefined,
            applicationIds:
              typeof row.applicationIds === 'string'
                ? JSON.parse(row.applicationIds)
                : row.applicationIds,
            createdAt: Number(row.createdAt),
            updatedAt: Number(row.updatedAt),
          });
          await this.assertMembers(manager, draft.applicationIds);
          submittedRevision = draft.revision;
          await manager.query(
            `INSERT INTO suite_submissions
          (suiteId, submittedRevision, tenantId, ownerIdentityId, title, description, applicationIds, classification, status, reason, submittedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', '', ?)`,
            [
              id,
              submittedRevision,
              actor.tenantId,
              row.ownerIdentityId,
              draft.title,
              draft.description,
              JSON.stringify(draft.applicationIds),
              draft.classification ?? null,
              at,
            ]
          );
        } else if (action === 'approve' || action === 'reject') {
          if (!status.latestSubmission)
            throw new SuiteConflictError('Submission is missing');
          if (action === 'approve')
            await this.assertMembers(
              manager,
              status.latestSubmission.applicationIds
            );
          await manager.query(
            `UPDATE suite_submissions SET status = ?, reason = ?, reviewerIdentityId = ?, reviewedAt = ?
          WHERE suiteId = ? AND submittedRevision = ? AND status = 'submitted'`,
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
            const fields = suitePublicationFields({
              ...status.latestSubmission,
            });
            await manager.query(
              `INSERT INTO suite_publications (suiteId, submittedRevision, publishedAt, title, description, applicationIds, classification) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE submittedRevision = VALUES(submittedRevision), publishedAt = VALUES(publishedAt),
              title = VALUES(title), description = VALUES(description), applicationIds = VALUES(applicationIds), classification = VALUES(classification)`,
              [
                id,
                submittedRevision,
                at,
                fields.title,
                fields.description,
                JSON.stringify(fields.applicationIds),
                fields.classification ?? null,
              ]
            );
            publicationRevision = await advanceSuitePublication(
              manager,
              id,
              row.ownerIdentityId,
              actor,
              at,
              true
            );
          }
        } else {
          if (status.latestSubmission?.status === 'submitted') {
            submittedRevision = status.latestSubmission.submittedRevision;
            await manager.query(
              "UPDATE suite_submissions SET status = 'cancelled', reviewedAt = ? WHERE suiteId = ? AND submittedRevision = ? AND status = 'submitted'",
              [at, id, submittedRevision]
            );
          }
          if (status.publishedSubmissionRevision !== null)
            publicationRevision = await advanceSuitePublication(
              manager,
              id,
              row.ownerIdentityId,
              actor,
              at,
              false
            );
        }
        await manager.query(
          'UPDATE private_suites SET revision = ?, updatedAt = ? WHERE id = ?',
          [revision, at, id]
        );
        const result: SuitePublicationReceipt = {
          id,
          revision,
          action,
          submittedRevision,
          publicationRevision,
        };
        await manager.query(
          `INSERT INTO suite_publication_commands (tenantId, actorIdentityId, commandKey, fingerprint, suiteId, receipt, createdAt)
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
      `SELECT * FROM private_suites WHERE id = ? AND tenantId = ?${
        review ? '' : ' AND ownerIdentityId = ?'
      }${lock ? ' FOR UPDATE' : ''}`,
      [id, actor.tenantId, ...(review ? [] : [actor.identityId])]
    );
    if (!row) throw new SuiteNotFoundError('Suite not found');
    assertSuitePublicationAccess(actor, row, review);
    return row;
  }

  private async status(
    manager: EntityManager,
    row: DraftRow
  ): Promise<SuitePublicationStatus> {
    const [submission] = await manager.query<Record<string, unknown>[]>(
      'SELECT * FROM suite_submissions WHERE suiteId = ? ORDER BY submittedRevision DESC LIMIT 1',
      [row.id]
    );
    const state = await suitePublicState(manager, row.id);
    const [publication] = await manager.query<
      { submittedRevision: number | string }[]
    >('SELECT submittedRevision FROM suite_publications WHERE suiteId = ?', [
      row.id,
    ]);
    if (
      (state &&
        (state.tenantId !== row.tenantId ||
          state.ownerIdentityId !== row.ownerIdentityId ||
          !publication)) ||
      (publication && !state) ||
      (submission &&
        (submission.tenantId !== row.tenantId ||
          submission.ownerIdentityId !== row.ownerIdentityId))
    )
      throw new SuiteUnavailableError(
        'Suite publication ownership is inconsistent'
      );
    try {
      return parseSuitePublicationStatus({
        id: row.id,
        revision: Number(row.revision),
        publicationRevision: state ? Number(state.revision) : null,
        publishedSubmissionRevision:
          state && state.deletedAt === null && publication
            ? Number(publication.submittedRevision)
            : null,
        latestSubmission: submission
          ? suiteSubmissionFromRow(submission)
          : null,
      });
    } catch {
      throw new SuiteUnavailableError(
        'Stored suite publication status is invalid'
      );
    }
  }

  private async assertMembers(manager: EntityManager, ids: string[]) {
    for (const id of [...ids].sort()) {
      const [row] = await manager.query(
        `SELECT a.id FROM app_records a LEFT JOIN editorial_resource_states s ON s.resourceKind = 'app' AND s.resourceId = a.id
        WHERE a.id = ? AND a.isSuspended = 0 AND s.deletedAt IS NULL AND (s.tenantId = ? OR s.resourceId IS NULL) FOR SHARE`,
        [id, this.publicTenant]
      );
      if (!row)
        throw new SuiteInputError(
          'Every submitted application must currently be public'
        );
    }
  }

  private async guard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof CanonicalIdentityAccessDenied ||
        error instanceof SuiteInputError ||
        error instanceof SuiteConflictError ||
        error instanceof SuiteNotFoundError ||
        error instanceof SuiteUnavailableError ||
        error instanceof PermissionDeniedError
      )
        throw error;
      throw new SuiteUnavailableError(
        'Could not confirm suite publication. Retry with the same Idempotency-Key.'
      );
    }
  }
}
