import { advanceContentUpdateCursor } from '@sdk/extras/mysql';
import type { DataSource, EntityManager } from 'typeorm';
import {
  RELEASE_DRAFT_LIMIT,
  assertReleasePublicationTransition,
  assertReleaseSubmissionDate,
  assertReleaseVersion,
  parseReleaseFields,
  parseReleasePublicationReceipt,
  parseReleaseReceipt,
  parseReleaseSource,
  releaseRevision,
  releaseTimestamp,
  ReleaseConflictError,
  ReleaseNotFoundError,
  ReleaseUnavailableError,
  type ReleaseDraft,
  type ReleasePublicationReceipt,
  type ReleaseReceipt,
  type ReleaseTarget,
} from '@domains/catalog/versioning';
import type { EditorialActor } from '../application/editorial.ports';
import type {
  ReleaseDraftCommand,
  ReleasePublicationCommand,
  ReleaseWorkspaceStore,
} from './release-workspace';
import {
  advanceReleasePublication,
  assertReleaseGrant,
  assertReleaseTarget,
  cancelReleaseReview,
  canonicalRelease,
  guardReleaseStore,
  lockReleaseWorkspaces,
  releaseDraftFromRow,
  releaseDraftRow,
  releaseJson,
  releaseStatus,
  type ReleaseDraftRow,
} from './mysql-release-state';

export class MysqlReleaseWorkspace implements ReleaseWorkspaceStore {
  constructor(private readonly sourceDb: DataSource) {}

  async list(actor: EditorialActor) {
    return guardReleaseStore(async () => {
      const rows = await this.sourceDb.query<ReleaseDraftRow[]>(
        'SELECT * FROM release_drafts WHERE tenantId = ? AND ownerIdentityId = ? AND deletedAt IS NULL ORDER BY updatedAt DESC, id LIMIT ?',
        [actor.tenantId, actor.identityId, RELEASE_DRAFT_LIMIT + 1]
      );
      if (rows.length > RELEASE_DRAFT_LIMIT)
        throw new ReleaseUnavailableError(
          'Release workspace capacity is invalid'
        );
      return rows.map(releaseDraftFromRow);
    });
  }
  async read(actor: EditorialActor, id: string) {
    return guardReleaseStore(async () => {
      const row = await releaseDraftRow(this.sourceDb.manager, actor, id);
      if (row.deletedAt !== null)
        throw new ReleaseNotFoundError('Release draft not found');
      return releaseDraftFromRow(row);
    });
  }
  async source(
    actor: EditorialActor,
    applicationId: string,
    id: string | null
  ) {
    return guardReleaseStore(() =>
      this.sourceDb.transaction('REPEATABLE READ', async (manager) => {
        const [grant] = await manager.query<{ claimId: string }[]>(
          'SELECT claimId FROM application_ownership_grants WHERE applicationId = ? AND tenantId = ? AND claimantIdentityId = ? AND revokedAt IS NULL',
          [applicationId, actor.tenantId, actor.identityId]
        );
        if (!grant)
          throw new ReleaseNotFoundError(
            'No current application ownership grant'
          );
        const owner = {
          tenantId: actor.tenantId,
          ownerIdentityId: actor.identityId,
        };
        await assertReleaseGrant(
          manager,
          owner,
          { applicationId, claimId: grant.claimId },
          false
        );
        const publication = id ? await canonicalRelease(manager, id) : null;
        if (
          id &&
          (!publication ||
            publication.tenantId !== actor.tenantId ||
            publication.applicationId !== applicationId)
        )
          throw new ReleaseNotFoundError('Release not found');
        const [app] = await manager.query<{ name: string }[]>(
          'SELECT name FROM app_records WHERE id = ?',
          [applicationId]
        );
        return parseReleaseSource({
          applicationId,
          applicationName: app?.name,
          claimId: grant.claimId,
          release: publication
            ? {
                ...publication.fields,
                id: publication.id,
                revision: publication.revision,
                visible: publication.deletedAt === null,
              }
            : null,
        });
      })
    );
  }
  async status(actor: EditorialActor, id: string, review: boolean) {
    return guardReleaseStore(() =>
      this.sourceDb.transaction('REPEATABLE READ', async (manager) => {
        const row = await releaseDraftRow(manager, actor, id, review);
        if (row.deletedAt !== null)
          throw new ReleaseNotFoundError('Release draft not found');
        const publication = await canonicalRelease(manager, row.releaseId);
        assertReleaseTarget(publication, row, releaseDraftFromRow(row).target);
        return releaseStatus(manager, row, publication);
      })
    );
  }
  async reviews(actor: EditorialActor, page: number) {
    return guardReleaseStore(() =>
      this.sourceDb.transaction('REPEATABLE READ', async (manager) => {
        const parameters = [actor.tenantId, actor.identityId];
        const where = `FROM release_submissions s JOIN release_drafts d ON d.id = s.draftId
        WHERE d.tenantId = ? AND d.ownerIdentityId <> ? AND d.deletedAt IS NULL AND s.status = 'submitted'`;
        const [count] = await manager.query<{ total: string | number }[]>(
          `SELECT COUNT(*) AS total ${where}`,
          parameters
        );
        const rows = await manager.query<ReleaseDraftRow[]>(
          `SELECT d.* ${where} ORDER BY s.submittedAt, s.draftId LIMIT 20 OFFSET ?`,
          [...parameters, (page - 1) * 20]
        );
        const items = [];
        for (const row of rows) {
          const publication = await canonicalRelease(manager, row.releaseId);
          assertReleaseTarget(
            publication,
            row,
            releaseDraftFromRow(row).target
          );
          items.push(await releaseStatus(manager, row, publication));
        }
        return { items, page, total: Number(count.total) };
      })
    );
  }

  async changeDraft(command: ReleaseDraftCommand): Promise<ReleaseReceipt> {
    return guardReleaseStore(() =>
      this.sourceDb.transaction('READ COMMITTED', async (manager) => {
        const { actor, id, type } = command;
        await lockReleaseWorkspaces(manager, actor.tenantId, [
          actor.identityId,
        ]);
        const replay = await this.receipt(manager, command, 'draft');
        if (replay) return parseReleaseReceipt(replay);
        const creating = type === 'create' || type === 'open';
        const row = creating
          ? null
          : await releaseDraftRow(manager, actor, id, false, true);
        if (row?.deletedAt !== null && row)
          throw new ReleaseNotFoundError('Release draft not found');
        const previous = row ? releaseDraftFromRow(row) : null;
        if (previous && previous.revision !== command.expectedRevision)
          throw new ReleaseConflictError(
            'Release draft changed. Reload before editing.'
          );
        let fields = command.fields;
        let target: ReleaseTarget | null =
          previous?.target ??
          (command.target
            ? {
                ...command.target,
                sourcePublicationRevision: command.expectedPublicationRevision,
              }
            : null);
        if (!target)
          throw new ReleaseUnavailableError('Release target is missing');
        if (creating || type === 'rebase') {
          await assertReleaseGrant(
            manager,
            { tenantId: actor.tenantId, ownerIdentityId: actor.identityId },
            target,
            true
          );
          const publication = await canonicalRelease(
            manager,
            target.releaseId,
            true
          );
          assertReleaseTarget(publication, actor, target);
          if (
            (publication?.revision ?? null) !==
              command.expectedPublicationRevision ||
            (type === 'open' && !publication)
          )
            throw new ReleaseConflictError(
              'Public release changed. Reload before opening or merging.'
            );
          if (type === 'open' && publication) fields = publication.fields;
          if (fields)
            assertReleaseVersion(fields, publication?.version ?? null);
          target = {
            ...target,
            sourcePublicationRevision: publication?.revision ?? null,
          };
        } else if (type === 'update') {
          // Reading a canonical version only constrains the URL. Revocation never prevents private editing/deletion.
          const publication = await canonicalRelease(manager, target.releaseId);
          assertReleaseTarget(publication, actor, target);
          if (fields)
            assertReleaseVersion(fields, publication?.version ?? null);
        }
        const revision = releaseRevision((previous?.revision ?? 0) + 1);
        const at = releaseTimestamp(
          Math.max(command.at, previous?.updatedAt ?? 0)
        );
        if (creating) {
          const [count] = await manager.query<{ total: number | string }[]>(
            'SELECT COUNT(*) AS total FROM release_drafts WHERE tenantId = ? AND ownerIdentityId = ? AND deletedAt IS NULL',
            [actor.tenantId, actor.identityId]
          );
          if (Number(count.total) >= RELEASE_DRAFT_LIMIT)
            throw new ReleaseConflictError(
              'You can keep at most 100 release drafts'
            );
          if (!fields)
            throw new ReleaseUnavailableError('Release content is missing');
          await manager.query(
            `INSERT INTO release_drafts
          (id, tenantId, ownerIdentityId, applicationId, releaseId, claimId, sourcePublicationRevision, fields, revision, createdAt, updatedAt, deletedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
            [
              id,
              actor.tenantId,
              actor.identityId,
              target.applicationId,
              target.releaseId,
              target.claimId,
              target.sourcePublicationRevision,
              JSON.stringify(fields),
              revision,
              at,
              at,
            ]
          );
        } else {
          if (type === 'delete' || type === 'rebase')
            await cancelReleaseReview(manager, id, at);
          await manager.query(
            'UPDATE release_drafts SET fields = ?, sourcePublicationRevision = ?, revision = ?, updatedAt = ?, deletedAt = ? WHERE id = ?',
            [
              type === 'delete' ? null : JSON.stringify(fields),
              target.sourcePublicationRevision,
              revision,
              at,
              type === 'delete' ? at : null,
              id,
            ]
          );
          if (type === 'delete')
            await manager.query(
              'DELETE FROM release_submissions WHERE draftId = ?',
              [id]
            );
        }
        const result = { id, revision, deleted: type === 'delete' };
        await this.saveReceipt(manager, command, 'draft', result, at);
        return result;
      })
    );
  }

  async changePublication(
    command: ReleasePublicationCommand
  ): Promise<ReleasePublicationReceipt> {
    return guardReleaseStore(() =>
      this.sourceDb.transaction('READ COMMITTED', async (manager) => {
        const { actor, id, action, input } = command;
        const reviewing = action === 'approve' || action === 'reject';
        const owner = await releaseDraftRow(manager, actor, id, reviewing);
        await lockReleaseWorkspaces(manager, actor.tenantId, [
          actor.identityId,
          owner.ownerIdentityId,
        ]);
        const row = await releaseDraftRow(manager, actor, id, reviewing, true);
        const replay = await this.receipt(manager, command, 'publication');
        if (replay) return parseReleasePublicationReceipt(replay);
        if (row.deletedAt !== null)
          throw new ReleaseNotFoundError('Release draft not found');
        const draft = releaseDraftFromRow(row);
        if (action !== 'reject')
          await assertReleaseGrant(
            manager,
            row,
            draft.target,
            true,
            action !== 'withdraw'
          );
        const publication = await canonicalRelease(
          manager,
          draft.target.releaseId,
          true
        );
        assertReleaseTarget(publication, row, draft.target);
        const status = await releaseStatus(manager, row, publication);
        assertReleasePublicationTransition(action, status, input);
        if (
          (action === 'submit' || action === 'withdraw') &&
          draft.target.sourcePublicationRevision !== status.publicationRevision
        )
          throw new ReleaseConflictError(
            'Public release changed. Rebase before submitting or withdrawing.'
          );
        const revision = releaseRevision(draft.revision + 1);
        const at = releaseTimestamp(
          Math.max(command.at, draft.updatedAt, publication?.publishedAt ?? 0)
        );
        let publicationRevision = status.publicationRevision;
        let submittedRevision = input.submittedRevision;
        if (action === 'submit') {
          const fields = this.fields(draft);
          assertReleaseSubmissionDate(fields, at);
          assertReleaseVersion(fields, publication?.version ?? null);
          submittedRevision = draft.revision;
          await manager.query(
            `INSERT INTO release_submissions (draftId, submittedRevision, target, fields, status, reason, submittedAt)
          VALUES (?, ?, ?, ?, 'submitted', '', ?)`,
            [
              id,
              submittedRevision,
              JSON.stringify(draft.target),
              JSON.stringify(fields),
              at,
            ]
          );
        } else if (action === 'approve' || action === 'reject') {
          const submission = status.latestSubmission;
          if (!submission)
            throw new ReleaseConflictError('Release submission is missing');
          if (action === 'approve') {
            const fields = this.fields(submission);
            assertReleaseSubmissionDate(fields, at);
            assertReleaseVersion(fields, publication?.version ?? null);
            const duplicates = await manager.query<{ releaseId: string }[]>(
              'SELECT releaseId FROM release_publications WHERE tenantId = ? AND applicationId = ? AND version = ? AND releaseId <> ? LIMIT 1',
              [
                actor.tenantId,
                draft.target.applicationId,
                fields.version,
                draft.target.releaseId,
              ]
            );
            if (duplicates.length)
              throw new ReleaseConflictError(
                'This application version already has release notes. Open that release to edit it.'
              );
            await manager.query(
              `INSERT INTO release_publications (releaseId, applicationId, tenantId, version, fields, publishedAt, draftId, submittedRevision)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE fields = VALUES(fields), publishedAt = VALUES(publishedAt), draftId = VALUES(draftId), submittedRevision = VALUES(submittedRevision)`,
              [
                draft.target.releaseId,
                draft.target.applicationId,
                actor.tenantId,
                fields.version,
                JSON.stringify(fields),
                at,
                id,
                submittedRevision,
              ]
            );
            publicationRevision = await advanceReleasePublication(
              manager,
              actor,
              row.ownerIdentityId,
              draft.target.releaseId,
              publication,
              at,
              true
            );
          }
          await manager.query(
            "UPDATE release_submissions SET status = ?, reason = ?, reviewedAt = ?, reviewerIdentityId = ? WHERE draftId = ? AND submittedRevision = ? AND status = 'submitted'",
            [
              action === 'approve' ? 'approved' : 'rejected',
              input.reason,
              at,
              actor.identityId,
              id,
              submittedRevision,
            ]
          );
        } else {
          if (status.latestSubmission?.status === 'submitted')
            submittedRevision = status.latestSubmission.submittedRevision;
          await cancelReleaseReview(manager, id, at);
          if (publication?.deletedAt === null)
            publicationRevision = await advanceReleasePublication(
              manager,
              actor,
              row.ownerIdentityId,
              draft.target.releaseId,
              publication,
              at,
              false
            );
        }
        await manager.query(
          'UPDATE release_drafts SET revision = ?, updatedAt = ?, sourcePublicationRevision = ? WHERE id = ?',
          [
            revision,
            at,
            action === 'approve' || action === 'withdraw'
              ? publicationRevision
              : draft.target.sourcePublicationRevision,
            id,
          ]
        );
        if (action === 'approve')
          await advanceContentUpdateCursor(
            manager,
            'applications',
            draft.target.applicationId,
            at
          );
        const result = parseReleasePublicationReceipt({
          id,
          releaseId: draft.target.releaseId,
          revision,
          action,
          submittedRevision,
          publicationRevision,
        });
        await this.saveReceipt(manager, command, 'publication', result, at);
        return result;
      })
    );
  }

  private fields(
    value: ReleaseDraft | Parameters<typeof assertReleaseSubmissionDate>[0]
  ) {
    return parseReleaseFields({
      version: value.version,
      channel: value.channel,
      type: value.type,
      releasedOn: value.releasedOn,
      title: value.title,
      description: value.description,
      changes: value.changes,
    });
  }
  private async receipt(
    manager: EntityManager,
    command: ReleaseDraftCommand | ReleasePublicationCommand,
    kind: 'draft' | 'publication'
  ) {
    const [row] = await manager.query<
      { fingerprint: string; kind: string; draftId: string; receipt: unknown }[]
    >(
      'SELECT * FROM release_commands WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?',
      [command.actor.tenantId, command.actor.identityId, command.key]
    );
    if (!row) return null;
    if (row.fingerprint !== command.fingerprint || row.kind !== kind)
      throw new ReleaseConflictError(
        'Idempotency-Key was used for another command'
      );
    await releaseDraftRow(
      manager,
      command.actor,
      row.draftId,
      kind === 'publication' &&
        'action' in command &&
        (command.action === 'approve' || command.action === 'reject')
    );
    try {
      return kind === 'draft'
        ? parseReleaseReceipt(releaseJson(row.receipt))
        : parseReleasePublicationReceipt(releaseJson(row.receipt));
    } catch {
      throw new ReleaseUnavailableError(
        'Stored release command receipt is invalid'
      );
    }
  }
  private async saveReceipt(
    manager: EntityManager,
    command: ReleaseDraftCommand | ReleasePublicationCommand,
    kind: string,
    receipt: ReleaseReceipt | ReleasePublicationReceipt,
    at: number
  ) {
    await manager.query(
      'INSERT INTO release_commands (tenantId, actorIdentityId, commandKey, fingerprint, draftId, kind, receipt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        command.actor.tenantId,
        command.actor.identityId,
        command.key,
        command.fingerprint,
        receipt.id,
        kind,
        JSON.stringify(receipt),
        at,
      ]
    );
  }
}
