import type { EntityManager } from 'typeorm';
import {
  ArticleConflictError,
  ArticleNotFoundError,
  type ArticleFields,
} from '@domains/publication/article';
import type { EditorialActor } from '../application/editorial.ports';
import {
  articleCoverFromRow,
  type ArticleCoverRow,
} from './mysql-article-covers';
import { articleMediaAsset } from '../application-media/editorial-media-assets';

export type ArticleCoverReferenceKind = 'draft' | 'submission' | 'publication';

/** The caller holds the article owner's lock. Every insertion also locks the upload against cleanup. */
export async function replaceArticleCoverReference(
  manager: EntityManager,
  actor: EditorialActor,
  articleId: string,
  kind: ArticleCoverReferenceKind,
  cover: ArticleFields['cover']
) {
  if (cover) {
    const [row] = await manager.query<ArticleCoverRow[]>(
      'SELECT * FROM article_cover_uploads WHERE id = ? AND articleId = ? AND tenantId = ? AND ownerIdentityId = ? FOR UPDATE',
      [cover.imageId, articleId, actor.tenantId, actor.identityId]
    );
    if (!row) throw new ArticleNotFoundError('Article cover not found');
    const upload = articleCoverFromRow(row);
    if (upload.status !== 'ready' || !upload.asset)
      throw new ArticleConflictError('Choose a ready article cover');
    const asset = await articleMediaAsset(
      manager,
      cover.imageId,
      articleId,
      actor.tenantId,
      true
    );
    if (JSON.stringify(asset) !== JSON.stringify(upload.asset))
      throw new ArticleConflictError(
        'The article cover descriptor is unavailable'
      );
  }
  await manager.query(
    'DELETE FROM article_cover_references WHERE articleId = ? AND kind = ?',
    [articleId, kind]
  );
  if (cover)
    await manager.query(
      'INSERT INTO article_cover_references (articleId, kind, imageId) VALUES (?, ?, ?)',
      [articleId, kind, cover.imageId]
    );
}
