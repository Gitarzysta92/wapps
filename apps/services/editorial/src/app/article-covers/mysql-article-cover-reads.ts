import type { DataSource, EntityManager } from 'typeorm';
import {
  ArticleNotFoundError,
  ArticleUnavailableError,
} from '@domains/publication/article';
import type { EditorialActor } from '../application/editorial.ports';
import {
  articleDraftRow,
  articleStatus,
  canonicalArticle,
  guardArticleStore,
} from '../articles/mysql-article-state';
import { isEditorialScope } from '../application/editorial-materialization';
import type { ArticleCoverReadStore } from './article-cover-reads';
import {
  articleCoverFromRow,
  type ArticleCoverRow,
} from './mysql-article-covers';
import type { ArticleCoverReferenceKind } from './article-cover-references';
import { articleMediaAsset } from '../application-media/editorial-media-assets';

export class MysqlArticleCoverReads implements ArticleCoverReadStore {
  constructor(
    private readonly source: DataSource,
    private readonly publicTenant: string
  ) {
    if (!isEditorialScope(publicTenant))
      throw new Error('Invalid public article tenant');
  }
  submission(
    actor: EditorialActor,
    id: string,
    revision: number,
    review: boolean
  ) {
    return guardArticleStore(() =>
      this.source.transaction('REPEATABLE READ', async (manager) => {
        const draft = await articleDraftRow(manager, actor, id, review);
        if (draft.deletedAt !== null)
          throw new ArticleNotFoundError('Article draft not found');
        const status = await articleStatus(
          manager,
          draft,
          await canonicalArticle(manager, id)
        );
        const submitted = status.latestSubmission;
        if (
          !submitted ||
          submitted.submittedRevision !== revision ||
          !submitted.cover
        )
          throw new ArticleNotFoundError('Submitted article cover not found');
        return this.asset(
          manager,
          id,
          draft.tenantId,
          draft.ownerIdentityId,
          'submission',
          submitted.cover.imageId
        );
      })
    );
  }
  published(id: string, imageId: string) {
    return guardArticleStore(() =>
      this.source.transaction('REPEATABLE READ', async (manager) => {
        const article = await canonicalArticle(manager, id);
        if (
          !article ||
          article.tenantId !== this.publicTenant ||
          article.deletedAt !== null ||
          article.fields.cover?.imageId !== imageId
        )
          throw new ArticleNotFoundError('Public article cover not found');
        return this.asset(
          manager,
          id,
          article.tenantId,
          article.ownerIdentityId,
          'publication',
          imageId
        );
      })
    );
  }
  private async asset(
    manager: EntityManager,
    id: string,
    tenant: string,
    owner: string | null,
    kind: ArticleCoverReferenceKind,
    imageId: string
  ) {
    if (kind === 'publication') {
      const references = await manager.query(
        "SELECT imageId FROM article_cover_references WHERE articleId=? AND kind='publication' AND imageId=?",
        [id, imageId]
      );
      const asset = await articleMediaAsset(manager, imageId, id, tenant);
      if (references.length !== 1 || !asset)
        throw new ArticleUnavailableError(
          'Article cover authority is incomplete'
        );
      return asset;
    }
    const [row] = await manager.query<ArticleCoverRow[]>(
      `SELECT i.* FROM article_cover_uploads i JOIN article_cover_references r ON r.imageId = i.id AND r.articleId = i.articleId
      WHERE r.articleId = ? AND r.kind = ? AND r.imageId = ? AND i.tenantId = ?
      AND i.ownerIdentityId = ?`,
      [id, kind, imageId, tenant, owner]
    );
    if (!row)
      throw new ArticleUnavailableError(
        'Article cover authority is incomplete'
      );
    const upload = articleCoverFromRow(row);
    const asset = await articleMediaAsset(manager, imageId, id, tenant);
    if (
      upload.status !== 'ready' ||
      !asset ||
      JSON.stringify(asset) !== JSON.stringify(upload.asset)
    )
      throw new ArticleUnavailableError('Article cover is unavailable');
    return asset;
  }
}
