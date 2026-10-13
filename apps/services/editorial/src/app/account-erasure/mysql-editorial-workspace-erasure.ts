import type { DataSource, EntityManager } from 'typeorm';
import type { AccountErasureRequest } from '@sdk/features/identity/core';
import {
  isEditorialResourceId,
  isEditorialScope,
} from '../application/editorial-materialization';
import { editorialSqlInteger } from '../infrastructure/mysql-editorial-snapshot';
import type {
  EditorialWorkspaceErasure,
  EditorialWorkspaceErasureState,
} from './editorial-workspace-erasure.port';
import { lockEditorialErasure } from './mysql-editorial-erasure-authority';
import {
  editorialWorkspaceFamilies,
  EDITORIAL_WORKSPACE_ERASURE_BATCH as batch,
  type EditorialWorkspaceFamily,
} from './editorial-workspace-erasure.tables';
import { eraseEditorialWorkspaceMedia } from './mysql-editorial-workspace-media-erasure';

type Row = Record<string, unknown>;

/** The permanent identity barrier excludes new owner writes and independent reviews of owned drafts. */
export class MysqlEditorialWorkspaceErasure
  implements EditorialWorkspaceErasure
{
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}

  advance(
    input: AccountErasureRequest
  ): Promise<EditorialWorkspaceErasureState> {
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const { request, requestedAt } = await lockEditorialErasure(
        manager,
        input
      );
      if (
        (
          await manager.query(
            'SELECT resourceId FROM editorial_resource_states WHERE ownerIdentityId=? LIMIT 1',
            [request.identityId]
          )
        ).length
      )
        return 'pending';
      // Release every owned private reference before dropping any uploader history.
      // Otherwise a shared private image can become an unattributed orphan later in this erasure.
      for (const liveOnly of [true, false])
        for (const family of editorialWorkspaceFamilies) {
          const [draft]: Row[] = await manager.query(
            `SELECT id,tenantId,ownerIdentityId,revision,createdAt,updatedAt,deletedAt FROM ${
              family.drafts
            } WHERE ownerIdentityId=?${
              liveOnly ? ' AND deletedAt IS NULL' : ''
            } ORDER BY id LIMIT 1 FOR UPDATE`,
            [request.identityId]
          );
          if (draft)
            return this.eraseDraft(
              manager,
              family,
              draft,
              request.identityId,
              requestedAt
            );
        }
      // Staff command receipts on peers' drafts are private; the actual review decisions remain for the audit phase.
      for (const family of editorialWorkspaceFamilies) {
        for (const [table, , actor] of family.commands) {
          const result = await manager.query(
            `DELETE FROM ${table} WHERE ${actor}=? ORDER BY tenantId,commandKey LIMIT ${batch}`,
            [request.identityId]
          );
          if (result.affectedRows) return 'pending';
        }
      }
      for (const prefix of ['application_image', 'article_cover'])
        for (const table of [`${prefix}_uploads`, `${prefix}_commands`])
          if (
            (
              await manager.query(
                `SELECT ownerIdentityId FROM ${table} WHERE ownerIdentityId=? LIMIT 1`,
                [request.identityId]
              )
            ).length
          )
            throw new Error(
              'Orphaned Editorial media history requires repair before erasure'
            );
      for (const family of editorialWorkspaceFamilies) {
        const result = await manager.query(
          `DELETE FROM ${family.workspace} WHERE ownerIdentityId=? ORDER BY tenantId LIMIT ${batch}`,
          [request.identityId]
        );
        if (result.affectedRows) return 'pending';
      }
      return 'drained';
    });
  }

  private async eraseDraft(
    manager: EntityManager,
    family: EditorialWorkspaceFamily,
    row: Row,
    owner: string,
    requestedAt: number
  ): Promise<EditorialWorkspaceErasureState> {
    if (
      !isEditorialResourceId(row.id) ||
      !isEditorialScope(row.tenantId) ||
      row.ownerIdentityId !== owner
    )
      throw new Error('Invalid Editorial erasure draft authority');
    const draft = {
      id: row.id,
      tenantId: row.tenantId,
      ownerIdentityId: owner,
    };
    const revision = editorialSqlInteger(row.revision, 1);
    const minimumTime = family.kind === 'application' ? 1 : 0;
    const updatedAt = editorialSqlInteger(row.updatedAt, minimumTime);
    if (
      updatedAt < editorialSqlInteger(row.createdAt, minimumTime) ||
      (row.deletedAt !== null &&
        editorialSqlInteger(row.deletedAt, minimumTime) !== updatedAt)
    )
      throw new Error('Invalid Editorial erasure draft lifecycle');
    for (const [table, parent, actor] of family.commands) {
      const result = await manager.query(
        `DELETE FROM ${table} WHERE ${parent}=? ORDER BY tenantId,${actor},commandKey LIMIT ${batch}`,
        [draft.id]
      );
      if (result.affectedRows) return 'pending';
    }
    // Application publication markers refer to private submitted revisions, unlike the retained public snapshots.
    if (family.kind === 'application')
      await manager.query(
        'DELETE FROM application_publications WHERE applicationId=?',
        [draft.id]
      );
    const submissions: Row[] = await manager.query(
      `SELECT submittedRevision FROM ${family.submissions} WHERE ${family.parent}=? ORDER BY submittedRevision LIMIT ${batch} FOR UPDATE`,
      [draft.id]
    );
    if (submissions.length) {
      for (const submission of submissions) {
        const submitted = editorialSqlInteger(submission.submittedRevision, 1);
        if (submitted >= revision || row.deletedAt !== null)
          throw new Error('Invalid Editorial erasure submission lifecycle');
        if (family.kind === 'application')
          await manager.query(
            'DELETE FROM application_submission_images WHERE draftId=? AND submittedRevision=?',
            [draft.id, submitted]
          );
        await manager.query(
          `DELETE FROM ${family.submissions} WHERE ${family.parent}=? AND submittedRevision=?`,
          [draft.id, submitted]
        );
      }
      if (
        family.kind === 'article' &&
        !(
          await manager.query(
            'SELECT submittedRevision FROM article_submissions WHERE articleId=? LIMIT 1',
            [draft.id]
          )
        ).length
      )
        await manager.query(
          "DELETE FROM article_cover_references WHERE articleId=? AND kind='submission'",
          [draft.id]
        );
      return 'pending';
    }
    const at = Math.max(
      requestedAt,
      updatedAt,
      editorialSqlInteger(this.now(), 1)
    );
    if (row.deletedAt === null) {
      await manager.query(
        `UPDATE ${family.drafts} SET ${family.tombstone},revision=?,updatedAt=?,deletedAt=? WHERE id=?`,
        [editorialSqlInteger(revision + 1, 2), at, at, draft.id]
      );
      if (family.kind === 'application')
        await manager.query(
          'UPDATE application_draft_images SET imageId=NULL,url=NULL WHERE draftId=?',
          [draft.id]
        );
      if (family.kind === 'article')
        await manager.query(
          "DELETE FROM article_cover_references WHERE articleId=? AND kind='draft'",
          [draft.id]
        );
      return 'pending';
    }
    if (family.kind === 'application' || family.kind === 'article') {
      const state = await eraseEditorialWorkspaceMedia(
        manager,
        family.kind,
        draft,
        at
      );
      if (state !== 'drained') return state;
    }
    if (family.kind === 'application') {
      await manager.query(
        'DELETE FROM application_draft_images WHERE draftId=?',
        [draft.id]
      );
      await manager.query(
        'DELETE FROM application_editing_targets WHERE draftId=?',
        [draft.id]
      );
    }
    await manager.query(`DELETE FROM ${family.drafts} WHERE id=?`, [draft.id]);
    return 'pending';
  }
}
