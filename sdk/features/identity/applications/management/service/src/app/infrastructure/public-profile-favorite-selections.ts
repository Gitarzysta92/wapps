import { classificationFields } from '@domains/publication/classification';
import type { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { parseCatalogSelection } from '@domains/catalog/record';
import { parsePublicSuiteSelection } from '@domains/publication/suite';
import { parseArticleSelection } from '@domains/publication/article';
import { profileFavoriteDiscussions } from './profile-favorite-discussions';
import {
  ACCOUNT_FAVORITES_LIMIT,
  parseFavoriteTarget,
  parsePublicProfileFavorite,
  publicFavoriteKey,
  type FavoriteTarget,
  type PublicProfileFavorite,
} from '@domains/customer/favorites';
import { CanonicalIdentityUnavailable } from '@sdk/features/identity/core';
import type { PublicProfileFavoriteTargets } from '@wapps/account';

export class PublicProfileFavoriteSelections
  implements PublicProfileFavoriteTargets
{
  private readonly editorial: string;
  private readonly discussion: string;
  constructor(
    private readonly http: HttpService,
    editorial: string,
    discussion: string
  ) {
    this.editorial = this.origin(editorial);
    this.discussion = this.origin(discussion);
  }

  async select(input: FavoriteTarget[]): Promise<PublicProfileFavorite[]> {
    try {
      if (input.length > ACCOUNT_FAVORITES_LIMIT)
        throw new Error('Favorite selection limit');
      const targets = input.map(parseFavoriteTarget);
      if (new Set(targets.map(publicFavoriteKey)).size !== targets.length)
        throw new Error('Duplicate favorite targets');
      const ids = (kind: FavoriteTarget['kind']) =>
        targets
          .filter((target) => target.kind === kind)
          .map((target) => target.id);
      // Four bounded families at a time; each family makes sequential batches of at most fifty.
      const [apps, suites, articles, discussions] = await Promise.all([
        this.selectBatches(
          this.editorial,
          'catalog/app-selection',
          ids('applications'),
          parseCatalogSelection
        ),
        this.selectBatches(
          this.editorial,
          'catalog/suite-selection',
          ids('suites'),
          parsePublicSuiteSelection
        ),
        this.selectBatches(
          this.editorial,
          'catalog/article-selection',
          ids('articles'),
          parseArticleSelection
        ),
        this.selectBatches(
          this.discussion,
          'discussions/selection?bindingPrefix=application%3A',
          ids('discussions'),
          profileFavoriteDiscussions
        ),
      ]);
      const parents = await this.selectBatches(
        this.editorial,
        'catalog/app-selection',
        [...new Set(discussions.map((topic) => topic.applicationId))],
        parseCatalogSelection
      );
      const parentSlugs = new Map(parents.map((app) => [app.id, app.slug]));
      return [
        ...apps.map((app) => ({
          kind: 'applications',
          id: app.id,
          title: app.name,
          ...classificationFields(app.classification),
          slug: app.slug,
          applicationSlug: null,
        })),
        ...suites.map((suite) => ({
          kind: 'suites',
          id: suite.id,
          title: suite.title,
          ...classificationFields(suite.classification),
          slug: suite.id,
          applicationSlug: null,
        })),
        ...articles.map((article) => ({
          kind: 'articles',
          id: article.id,
          title: article.title,
          ...classificationFields(article.classification),
          slug: article.slug,
          applicationSlug: null,
        })),
        ...discussions.flatMap((topic) => {
          const applicationSlug = parentSlugs.get(topic.applicationId);
          return applicationSlug
            ? [
                {
                  kind: 'discussions',
                  id: topic.id,
                  title: topic.title,
                  ...classificationFields(
                    parents.find((app) => app.id === topic.applicationId)
                      ?.classification
                  ),
                  slug: topic.id,
                  applicationSlug,
                },
              ]
            : [];
        }),
      ].map(parsePublicProfileFavorite);
    } catch {
      throw new CanonicalIdentityUnavailable(
        'Shared favorite content is unavailable'
      );
    }
  }

  private async selectBatches<T>(
    origin: string,
    path: string,
    ids: string[],
    parse: (value: unknown, ids: string[]) => { items: T[] }
  ): Promise<T[]> {
    const result: T[] = [];
    for (let offset = 0; offset < ids.length; offset += 50) {
      const batch = ids.slice(offset, offset + 50);
      const response = await firstValueFrom(
        this.http.get<unknown>(`${origin}/api/${path}`, {
          params: { ids: batch.join(',') },
          timeout: 5000,
          maxRedirects: 0,
          maxContentLength: 2 * 1024 * 1024,
          headers: { Accept: 'application/json' },
        })
      );
      result.push(...parse(response.data, batch).items);
    }
    return result;
  }
  private origin(value: string): string {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('Favorite service origin must be an HTTP origin');
    return url.origin;
  }
}
