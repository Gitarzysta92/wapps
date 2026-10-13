import type { DataSource, EntityManager } from 'typeorm';
import {
  ARTICLE_LIMITS,
  articleRevision,
  articleTimestamp,
  assertArticleDeletion,
  assertArticlePublicationTransition,
  assertArticleSlug,
  parseArticleFields,
  parseArticleReceipt,
  parseArticlePublicationReceipt,
  parseArticleReviewPage,
  ArticleConflictError,
  ArticleNotFoundError,
  ArticleUnavailableError,
  type ArticleReceipt,
  type ArticlePublicationReceipt,
} from '@domains/publication/article';
import type { EditorialActor } from '../application/editorial.ports';
import { replaceArticleCoverReference } from '../article-covers/article-cover-references';
import type {
  ArticleDraftCommand,
  ArticlePublicationCommand,
  ArticleWorkspaceStore,
} from './article-workspace';
import {
  advanceArticlePublication,
  articleDraftFromRow,
  articleDraftRow,
  articleJson,
  articleStatus,
  canonicalArticle,
  guardArticleStore,
  lockArticleWorkspaces,
  type ArticleDraftRow,
} from './mysql-article-state';

export class MysqlArticleWorkspace implements ArticleWorkspaceStore {
  constructor(private readonly source: DataSource) {}
  async list(actor: EditorialActor) {
    return guardArticleStore(async () => {
      const rows = await this.source.query<ArticleDraftRow[]>(
        'SELECT * FROM article_drafts WHERE tenantId = ? AND ownerIdentityId = ? AND deletedAt IS NULL ORDER BY updatedAt DESC, id LIMIT ?',
        [actor.tenantId, actor.identityId, ARTICLE_LIMITS.drafts + 1]
      );
      if (rows.length > ARTICLE_LIMITS.drafts)
        throw new ArticleUnavailableError(
          'Article workspace capacity is invalid'
        );
      return rows.map(articleDraftFromRow);
    });
  }
  async read(actor: EditorialActor, id: string) {
    return guardArticleStore(async () => {
      const row = await articleDraftRow(this.source.manager, actor, id);
      if (row.deletedAt !== null)
        throw new ArticleNotFoundError('Article draft not found');
      return articleDraftFromRow(row);
    });
  }
  async status(actor: EditorialActor, id: string, review: boolean) {
    return guardArticleStore(() =>
      this.source.transaction('REPEATABLE READ', async (manager) => {
        const row = await articleDraftRow(manager, actor, id, review);
        if (row.deletedAt !== null)
          throw new ArticleNotFoundError('Article draft not found');
        return articleStatus(manager, row, await canonicalArticle(manager, id));
      })
    );
  }
  async reviews(actor: EditorialActor, page: number) {
    return guardArticleStore(() =>
      this.source.transaction('REPEATABLE READ', async (manager) => {
        const args = [actor.tenantId, actor.identityId];
        const where = `FROM article_submissions s JOIN article_drafts d ON d.id = s.articleId
        WHERE d.tenantId = ? AND d.ownerIdentityId <> ? AND d.deletedAt IS NULL AND s.status = 'submitted'`;
        const [count] = await manager.query<{ total: number | string }[]>(
          `SELECT COUNT(*) AS total ${where}`,
          args
        );
        const rows = await manager.query<ArticleDraftRow[]>(
          `SELECT d.* ${where} ORDER BY s.submittedAt, s.articleId LIMIT 20 OFFSET ?`,
          [...args, (page - 1) * ARTICLE_LIMITS.pageSize]
        );
        const items = [];
        for (const row of rows)
          items.push(
            await articleStatus(
              manager,
              row,
              await canonicalArticle(manager, row.id)
            )
          );
        return parseArticleReviewPage({
          items,
          page,
          total: Number(count.total),
        });
      })
    );
  }
  async changeDraft(command: ArticleDraftCommand): Promise<ArticleReceipt> {
    return guardArticleStore(() =>
      this.source.transaction('READ COMMITTED', async (manager) => {
        const { actor, id, type, fields } = command;
        await lockArticleWorkspaces(manager, actor.tenantId, [
          actor.identityId,
        ]);
        const replay = await this.receipt(manager, command, 'draft');
        if (replay) return parseArticleReceipt(replay);
        const row =
          type === 'create'
            ? null
            : await articleDraftRow(manager, actor, id, false, true);
        if (row && row.deletedAt !== null)
          throw new ArticleNotFoundError('Article draft not found');
        const previous = row ? articleDraftFromRow(row) : null;
        if (previous && previous.revision !== command.expectedRevision)
          throw new ArticleConflictError(
            'Article draft changed. Reload before editing.'
          );
        if (row) {
          const publication = await canonicalArticle(manager, id, true);
          const status = await articleStatus(manager, row, publication);
          if (type === 'delete') assertArticleDeletion(status);
          else if (fields) assertArticleSlug(fields, status.publicSlug);
        }
        const revision = (previous?.revision ?? 0) + 1;
        if (!Number.isSafeInteger(revision))
          throw new ArticleConflictError('Article revision limit reached');
        const at = articleTimestamp(
          Math.max(command.at, previous?.updatedAt ?? 0)
        );
        if (type === 'create') {
          const [count] = await manager.query<{ total: number | string }[]>(
            'SELECT COUNT(*) AS total FROM article_drafts WHERE tenantId = ? AND ownerIdentityId = ? AND deletedAt IS NULL',
            [actor.tenantId, actor.identityId]
          );
          if (Number(count.total) >= ARTICLE_LIMITS.drafts)
            throw new ArticleConflictError(
              'You can keep at most 100 article drafts'
            );
          if (!fields)
            throw new ArticleUnavailableError('Article content is missing');
          await manager.query(
            `INSERT INTO article_drafts (id, tenantId, ownerIdentityId, fields, revision, createdAt, updatedAt, deletedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
            [
              id,
              actor.tenantId,
              actor.identityId,
              JSON.stringify(fields),
              revision,
              at,
              at,
            ]
          );
        } else {
          if (type !== 'delete' && !fields)
            throw new ArticleUnavailableError('Article content is missing');
          await manager.query(
            'UPDATE article_drafts SET fields = ?, revision = ?, updatedAt = ?, deletedAt = ? WHERE id = ?',
            [
              type === 'delete' ? null : JSON.stringify(fields),
              revision,
              at,
              type === 'delete' ? at : null,
              id,
            ]
          );
          if (type === 'delete')
            await manager.query(
              'DELETE FROM article_submissions WHERE articleId = ?',
              [id]
            );
        }
        await replaceArticleCoverReference(
          manager,
          actor,
          id,
          'draft',
          type === 'delete' ? undefined : fields?.cover
        );
        if (type === 'delete')
          await replaceArticleCoverReference(
            manager,
            actor,
            id,
            'submission',
            undefined
          );
        const result = { id, revision, deleted: type === 'delete' };
        await this.saveReceipt(manager, command, 'draft', result, at);
        return result;
      })
    );
  }
  async changePublication(
    command: ArticlePublicationCommand
  ): Promise<ArticlePublicationReceipt> {
    return guardArticleStore(() =>
      this.source.transaction('READ COMMITTED', async (manager) => {
        const { actor, id, action, input } = command;
        const reviewing = action === 'approve' || action === 'reject';
        const owner = await articleDraftRow(manager, actor, id, reviewing);
        await lockArticleWorkspaces(manager, actor.tenantId, [
          actor.identityId,
          owner.ownerIdentityId,
        ]);
        const row = await articleDraftRow(manager, actor, id, reviewing, true);
        const replay = await this.receipt(manager, command, 'publication');
        if (replay) return parseArticlePublicationReceipt(replay);
        if (row.deletedAt !== null)
          throw new ArticleNotFoundError('Article draft not found');
        const publication = await canonicalArticle(manager, id, true);
        const status = await articleStatus(manager, row, publication);
        assertArticlePublicationTransition(action, status, input);
        const revision = articleRevision(status.revision + 1);
        const at = articleTimestamp(
          Math.max(command.at, Number(row.updatedAt))
        );
        let submittedRevision = input.submittedRevision;
        let publicationRevision = status.publicationRevision;
        if (action === 'submit') {
          const draft = articleDraftFromRow(row);
          assertArticleSlug(draft, status.publicSlug);
          submittedRevision = draft.revision;
          await replaceArticleCoverReference(
            manager,
            actor,
            id,
            'submission',
            draft.cover
          );
          await manager.query(
            `INSERT INTO article_submissions (articleId, submittedRevision, sourcePublicationRevision, fields, status, reason, submittedAt)
          VALUES (?, ?, ?, ?, 'submitted', '', ?)`,
            [
              id,
              submittedRevision,
              status.publicationRevision,
              JSON.stringify(parseArticleFields(rowFields(draft))),
              at,
            ]
          );
        } else if (action === 'approve' || action === 'reject') {
          const submission = status.latestSubmission;
          if (!submission)
            throw new ArticleConflictError('Article submission is missing');
          if (action === 'approve') {
            assertArticleSlug(submission, status.publicSlug);
            const fields = parseArticleFields(rowFields(submission));
            await replaceArticleCoverReference(
              manager,
              { ...actor, identityId: row.ownerIdentityId },
              id,
              'publication',
              fields.cover
            );
            // The frozen payload is copied into authority; deleting a private draft never destroys reviewed bytes.
            if (publication) {
              await manager.query(
                'UPDATE article_publications SET title = ?, category = ?, fields = ?, submittedRevision = ?, updatedAt = ? WHERE articleId = ?',
                [
                  fields.title,
                  fields.category,
                  JSON.stringify(fields),
                  submittedRevision,
                  at,
                  id,
                ]
              );
            } else {
              await manager.query(
                `INSERT INTO article_publications (articleId, tenantId, ownerIdentityId, slug, title, category, fields, submittedRevision, publishedAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  id,
                  row.tenantId,
                  row.ownerIdentityId,
                  fields.slug,
                  fields.title,
                  fields.category,
                  JSON.stringify(fields),
                  submittedRevision,
                  at,
                  at,
                ]
              );
            }
            publicationRevision = await advanceArticlePublication(
              manager,
              actor,
              row.ownerIdentityId,
              id,
              publication,
              at,
              true
            );
          }
          await manager.query(
            `UPDATE article_submissions SET status = ?, reason = ?, reviewerIdentityId = ?, reviewedAt = ?
          WHERE articleId = ? AND submittedRevision = ? AND status = 'submitted'`,
            [
              action === 'approve' ? 'approved' : 'rejected',
              input.reason,
              actor.identityId,
              at,
              id,
              submittedRevision,
            ]
          );
        } else {
          if (status.latestSubmission?.status === 'submitted') {
            submittedRevision = status.latestSubmission.submittedRevision;
            await manager.query(
              "UPDATE article_submissions SET status = 'cancelled', reviewedAt = ? WHERE articleId = ? AND submittedRevision = ? AND status = 'submitted'",
              [at, id, submittedRevision]
            );
          }
          if (status.visible)
            publicationRevision = await advanceArticlePublication(
              manager,
              actor,
              row.ownerIdentityId,
              id,
              publication,
              at,
              false
            );
        }
        await manager.query(
          'UPDATE article_drafts SET revision = ?, updatedAt = ? WHERE id = ?',
          [revision, at, id]
        );
        const result = parseArticlePublicationReceipt({
          id,
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
  private async receipt(
    manager: EntityManager,
    command: ArticleDraftCommand | ArticlePublicationCommand,
    kind: 'draft' | 'publication'
  ): Promise<unknown | null> {
    const [row] = await manager.query<
      {
        fingerprint: string;
        articleId: string;
        kind: string;
        receipt: unknown;
      }[]
    >(
      'SELECT fingerprint, articleId, kind, receipt FROM article_commands WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?',
      [command.actor.tenantId, command.actor.identityId, command.key]
    );
    if (!row) return null;
    if (row.fingerprint !== command.fingerprint || row.kind !== kind)
      throw new ArticleConflictError(
        'Idempotency-Key was used for another command'
      );
    const reviewing =
      'action' in command &&
      (command.action === 'approve' || command.action === 'reject');
    const draft = await articleDraftRow(
      manager,
      command.actor,
      row.articleId,
      reviewing
    );
    try {
      const value =
        kind === 'draft'
          ? parseArticleReceipt(articleJson(row.receipt))
          : parseArticlePublicationReceipt(articleJson(row.receipt));
      if (value.id !== draft.id || value.revision > Number(draft.revision))
        throw new Error('Invalid receipt target');
      return value;
    } catch {
      throw new ArticleUnavailableError('Stored article receipt is invalid');
    }
  }
  private async saveReceipt(
    manager: EntityManager,
    command: ArticleDraftCommand | ArticlePublicationCommand,
    kind: 'draft' | 'publication',
    result: ArticleReceipt | ArticlePublicationReceipt,
    at: number
  ) {
    await manager.query(
      `INSERT INTO article_commands (tenantId, actorIdentityId, commandKey, fingerprint, articleId, kind, receipt, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        command.actor.tenantId,
        command.actor.identityId,
        command.key,
        command.fingerprint,
        command.id,
        kind,
        JSON.stringify(result),
        at,
      ]
    );
  }
}
function rowFields(
  fields: import('@domains/publication/article').ArticleFields
) {
  return {
    title: fields.title,
    slug: fields.slug,
    excerpt: fields.excerpt,
    byline: fields.byline,
    category: fields.category,
    tags: fields.tags,
    sections: fields.sections,
    ...(fields.classification === undefined
      ? {}
      : { classification: fields.classification }),
    ...(fields.cover ? { cover: fields.cover } : {}),
  };
}
