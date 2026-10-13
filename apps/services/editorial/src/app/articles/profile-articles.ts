import type { IPolicyEvaluator } from '@sdk/kernel/ontology/authority';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import {
  articleObject,
  profileArticlesCursor,
  ArticleInputError,
  ArticleUnavailableError,
} from '@domains/publication/article';
import type { EditorialActor } from '../application/editorial.ports';
import type { ArticleCatalog } from './article-catalog';

import { PROFILE_READER_ID } from '../suites/profile-suites';

export class ProfileArticles {
  constructor(
    private readonly catalog: Pick<ArticleCatalog, 'profile'>,
    private readonly policy: IPolicyEvaluator,
    private readonly publicTenant: string
  ) {}
  async read(input: unknown, actor: EditorialActor) {
    const actionName = 'editorial.profile.articles.read';
    if (
      actor.identityId !== PROFILE_READER_ID ||
      actor.tenantId !== this.publicTenant ||
      !actor.roles.includes('editorial:profile-reader')
    )
      throw new PermissionDeniedError(actionName);
    const row = articleObject(input, ['ownerIdentityId', 'after']);
    const owner = row['ownerIdentityId'];
    if (
      typeof owner !== 'string' ||
      !owner ||
      owner.length > 128 ||
      owner.trim() !== owner ||
      [...owner].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
    )
      throw new ArticleInputError('Invalid profile content owner');
    const after = profileArticlesCursor(row['after']);
    const decision = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: this.publicTenant,
      actionName,
      timestamp: Date.now(),
      subject: { roles: actor.roles },
      resource: {
        type: 'profile-article-collection',
        id: owner,
        tenantId: this.publicTenant,
      },
    });
    if (!decision.ok)
      throw new ArticleUnavailableError(
        'Profile article authorization unavailable'
      );
    if (decision.value !== true) throw new PermissionDeniedError(actionName);
    return this.catalog.profile(owner, after);
  }
}
