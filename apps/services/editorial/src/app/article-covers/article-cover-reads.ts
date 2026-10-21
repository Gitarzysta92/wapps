import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  articleCoverId,
  articleCoverInteger,
  ArticleCoverNotFoundError,
  ArticleCoverUnavailableError,
  type ArticleCoverAsset,
} from '@domains/catalog/media';
import { assertEditorialActor } from '../application/editorial-commands';
import type { EditorialActor } from '../application/editorial.ports';
import type { ArticleCoverObjects } from './article-cover.ports';

export interface ArticleCoverReadStore {
  submission(
    actor: EditorialActor,
    articleId: string,
    revision: number,
    review: boolean
  ): Promise<ArticleCoverAsset>;
  published(articleId: string, imageId: string): Promise<ArticleCoverAsset>;
}
export class ArticleCoverReads {
  constructor(
    private readonly store: ArticleCoverReadStore,
    private readonly objects: ArticleCoverObjects,
    private readonly policy: IPolicyEvaluator
  ) {}
  submission(
    actor: EditorialActor,
    id: string,
    revision: number,
    review: boolean
  ) {
    const articleId = articleCoverId(id),
      version = articleCoverInteger(revision);
    return this.bytes(async () => {
      await this.authorize(actor, articleId, review);
      return this.store.submission(actor, articleId, version, review);
    });
  }
  published(id: string, imageId: string) {
    const articleId = articleCoverId(id),
      image = articleCoverId(imageId);
    return this.bytes(() => this.store.published(articleId, image));
  }
  private async bytes(authority: () => Promise<ArticleCoverAsset>) {
    const asset = await authority();
    const bytes = await this.objects.read(asset);
    const current = await authority();
    if (JSON.stringify(current) !== JSON.stringify(asset))
      throw new ArticleCoverNotFoundError(
        'Article cover changed while loading'
      );
    return { asset, bytes };
  }
  private async authorize(actor: EditorialActor, id: string, review: boolean) {
    assertEditorialActor(actor);
    const actionName = review
      ? 'editorial.article.review'
      : 'editorial.article.read';
    let result;
    try {
      result = await this.policy.evaluate({
        identityId: actor.identityId,
        tenantId: actor.tenantId,
        timestamp: Date.now(),
        actionName,
        subject: { roles: actor.roles },
        resource: {
          type: review ? 'article-review' : 'article-workspace',
          id: review ? id : actor.identityId,
          tenantId: actor.tenantId,
        },
      });
    } catch {
      throw new ArticleCoverUnavailableError(
        'Article cover access authorization is unavailable'
      );
    }
    if (!result.ok)
      throw new ArticleCoverUnavailableError(
        'Article cover access authorization is unavailable'
      );
    if (result.value !== true) throw new PermissionDeniedError(actionName);
  }
}
