import type { EntityManager } from 'typeorm';
import type { EditorialSnapshot } from '@apps/shared';
import { ArticleUnavailableError } from '@domains/publication/article';
import { canonicalArticle } from './mysql-article-state';

/** The caller owns a consistent SQL snapshot. Private edits are never materialized. */
export async function readArticlePublicationSnapshot(
  manager: EntityManager,
  id: string
): Promise<EditorialSnapshot> {
  const publication = await canonicalArticle(manager, id);
  if (!publication)
    throw new ArticleUnavailableError(
      'Versioned article publication is missing'
    );
  return {
    kind: 'article',
    resourceId: id,
    tenantId: publication.tenantId,
    revision: publication.revision,
    deletedAt: publication.deletedAt,
    content:
      publication.deletedAt === null
        ? {
            ...publication.fields,
            submittedRevision: publication.submittedRevision,
            publishedAt: publication.publishedAt,
            updatedAt: publication.updatedAt,
          }
        : null,
  };
}
