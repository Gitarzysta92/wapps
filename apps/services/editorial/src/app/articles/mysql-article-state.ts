import { advanceContentUpdateCursor } from '@sdk/extras/mysql';
import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';
import { lockIdentityWrites } from '@sdk/extras/identity-mysql';
import type { EntityManager } from 'typeorm';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import {
  articleId,
  articleRevision,
  articleTimestamp,
  parseArticleDraft,
  parseArticleFields,
  parseArticleSubmission,
  parseArticlePublicationStatus,
  ArticleInputError,
  ArticleConflictError,
  ArticleNotFoundError,
  ArticleUnavailableError,
  ARTICLE_ANONYMOUS_BYLINE,
  type ArticleFields,
  type ArticleDraft,
} from '@domains/publication/article';
import type { EditorialActor } from '../application/editorial.ports';
import { isEditorialScope } from '../application/editorial-materialization';
import { assertArticleAccess } from './article-workspace';

export interface ArticleDraftRow {
  id: string;
  tenantId: string;
  ownerIdentityId: string;
  fields: unknown;
  revision: string | number;
  createdAt: string | number;
  updatedAt: string | number;
  deletedAt: string | number | null;
}
export interface CanonicalArticle {
  id: string;
  tenantId: string;
  ownerIdentityId: string | null;
  fields: ArticleFields;
  publishedAt: number;
  updatedAt: number;
  submittedRevision: number;
  revision: number;
  deletedAt: number | null;
}
export function articleJson(input: unknown): unknown {
  return typeof input === 'string' ? JSON.parse(input) : input;
}
export function articleDraftFromRow(row: ArticleDraftRow): ArticleDraft {
  try {
    return parseArticleDraft({
      ...parseArticleFields(articleJson(row.fields)),
      id: row.id,
      revision: Number(row.revision),
      createdAt: Number(row.createdAt),
      updatedAt: Number(row.updatedAt),
    });
  } catch {
    throw new ArticleUnavailableError('Stored article draft is invalid');
  }
}
export function articleSubmissionFromRow(row: Record<string, unknown>) {
  try {
    return parseArticleSubmission({
      ...parseArticleFields(articleJson(row.fields)),
      submittedRevision: Number(row.submittedRevision),
      sourcePublicationRevision:
        row.sourcePublicationRevision === null
          ? null
          : Number(row.sourcePublicationRevision),
      status: row.status,
      reason: row.reason,
      submittedAt: Number(row.submittedAt),
      reviewedAt: row.reviewedAt === null ? null : Number(row.reviewedAt),
    });
  } catch {
    throw new ArticleUnavailableError('Stored article submission is invalid');
  }
}
export async function articleDraftRow(
  manager: EntityManager,
  actor: EditorialActor,
  id: string,
  review = false,
  lock = false
) {
  const [row] = await manager.query<ArticleDraftRow[]>(
    `SELECT * FROM article_drafts WHERE id = ? AND tenantId = ?${
      review ? '' : ' AND ownerIdentityId = ?'
    }${lock ? ' FOR UPDATE' : ''}`,
    [id, actor.tenantId, ...(review ? [] : [actor.identityId])]
  );
  if (!row) throw new ArticleNotFoundError('Article draft not found');
  assertArticleAccess(actor, row, review);
  return row;
}
export async function lockArticleWorkspaces(
  manager: EntityManager,
  tenant: string,
  owners: string[]
) {
  await lockIdentityWrites(manager, owners);
  // Staff share a receipt namespace across authors; sort both locks to avoid crossed review deadlocks.
  for (const owner of [...new Set(owners)].sort()) {
    await manager.query(
      'INSERT INTO article_workspaces (tenantId, ownerIdentityId) VALUES (?, ?) ON DUPLICATE KEY UPDATE ownerIdentityId = ownerIdentityId',
      [tenant, owner]
    );
    await manager.query(
      'SELECT ownerIdentityId FROM article_workspaces WHERE tenantId = ? AND ownerIdentityId = ? FOR UPDATE',
      [tenant, owner]
    );
  }
}
export async function canonicalArticle(
  manager: EntityManager,
  id: string,
  lock = false
): Promise<CanonicalArticle | null> {
  const [publication] = await manager.query<Record<string, unknown>[]>(
    'SELECT * FROM article_publications WHERE articleId = ?' +
      (lock ? ' FOR UPDATE' : ''),
    [id]
  );
  const [state] = await manager.query<Record<string, unknown>[]>(
    "SELECT * FROM editorial_resource_states WHERE resourceKind = 'article' AND resourceId = ?" +
      (lock ? ' FOR UPDATE' : ''),
    [id]
  );
  if (!publication && !state) return null;
  if (
    !publication ||
    !state ||
    publication.tenantId !== state.tenantId ||
    publication.ownerIdentityId !== state.ownerIdentityId
  )
    throw new ArticleUnavailableError(
      'Article publication authority is incomplete'
    );
  try {
    const fields = parseArticleFields(articleJson(publication.fields));
    const publishedAt = articleTimestamp(Number(publication.publishedAt)),
      updatedAt = articleTimestamp(Number(publication.updatedAt));
    if (
      fields.slug !== publication.slug ||
      fields.title !== publication.title ||
      fields.category !== publication.category ||
      !isEditorialScope(publication.tenantId) ||
      !(
        publication.ownerIdentityId === null ||
        isEditorialScope(publication.ownerIdentityId)
      ) ||
      (publication.ownerIdentityId === null &&
        fields.byline !== ARTICLE_ANONYMOUS_BYLINE) ||
      updatedAt < publishedAt
    )
      throw new Error('Invalid article publication metadata');
    return {
      id: articleId(id),
      tenantId: publication.tenantId,
      ownerIdentityId: publication.ownerIdentityId,
      fields,
      publishedAt,
      updatedAt,
      submittedRevision: articleRevision(Number(publication.submittedRevision)),
      revision: articleRevision(Number(state.revision)),
      deletedAt:
        state.deletedAt === null
          ? null
          : articleTimestamp(Number(state.deletedAt)),
    };
  } catch {
    throw new ArticleUnavailableError('Stored public article is invalid');
  }
}
export async function articleStatus(
  manager: EntityManager,
  row: ArticleDraftRow,
  publication: CanonicalArticle | null
) {
  const [stored] = await manager.query<Record<string, unknown>[]>(
    'SELECT * FROM article_submissions WHERE articleId = ? ORDER BY submittedRevision DESC LIMIT 1',
    [row.id]
  );
  if (
    publication &&
    (publication.tenantId !== row.tenantId ||
      publication.ownerIdentityId !== row.ownerIdentityId)
  )
    throw new ArticleUnavailableError('Article ownership is inconsistent');
  try {
    return parseArticlePublicationStatus({
      id: row.id,
      revision: Number(row.revision),
      publicationRevision: publication?.revision ?? null,
      publishedSubmissionRevision: publication?.submittedRevision ?? null,
      publicSlug: publication?.fields.slug ?? null,
      visible: publication !== null && publication.deletedAt === null,
      latestSubmission: stored ? articleSubmissionFromRow(stored) : null,
    });
  } catch {
    throw new ArticleUnavailableError(
      'Stored article publication status is invalid'
    );
  }
}
export async function advanceArticlePublication(
  manager: EntityManager,
  actor: EditorialActor,
  owner: string,
  id: string,
  previous: CanonicalArticle | null,
  at: number,
  visible: boolean
) {
  const revision = (previous?.revision ?? 0) + 1;
  if (!Number.isSafeInteger(revision))
    throw new ArticleConflictError(
      'Article publication revision limit reached'
    );
  await manager.query(
    `INSERT INTO editorial_resource_states (resourceKind, resourceId, tenantId, ownerIdentityId, revision, deletedAt)
    VALUES ('article', ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE revision = VALUES(revision), deletedAt = VALUES(deletedAt)`,
    [id, actor.tenantId, owner, revision, visible ? null : at]
  );
  await manager.query(
    `INSERT INTO editorial_outbox (resourceKind, resourceId, tenantId, revision, operation, actorIdentityId, createdAt, availableAt)
    VALUES ('article', ?, ?, ?, ?, ?, ?, ?)`,
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
  if (visible) await advanceContentUpdateCursor(manager, 'articles', id, at);
  return revision;
}
export async function guardArticleStore<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof CanonicalIdentityAccessDenied ||
      error instanceof ArticleInputError ||
      error instanceof ArticleConflictError ||
      error instanceof ArticleNotFoundError ||
      error instanceof ArticleUnavailableError ||
      error instanceof PermissionDeniedError
    )
      throw error;
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ER_DUP_ENTRY'
    )
      throw new ArticleConflictError('This article URL is already reserved');
    throw new ArticleUnavailableError(
      'Could not confirm the article operation. Retry with the same Idempotency-Key.'
    );
  }
}
