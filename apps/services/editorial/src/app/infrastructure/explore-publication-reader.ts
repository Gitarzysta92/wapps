import {
  parseExploreItem,
  isApplicationActivity,
  ExploreUnavailableError,
  type ExploreItem,
} from '@domains/feed';
import {
  classificationFields,
  type ContentClassification,
} from '@domains/publication/classification';
import type { EditorialCatalog } from '../application/editorial-catalog';
import type {
  ExplorePublicationCandidate,
  ExplorePublicationReader,
} from '../application/explore-publications';
import type { SuiteCatalog } from '../suites/suite-catalog';
import type { ArticleCatalog } from '../articles/article-catalog';
import type { ReleaseCatalog } from '../releases/release-catalog';

export class CatalogExplorePublicationReader
  implements ExplorePublicationReader
{
  constructor(
    private readonly applications: Pick<EditorialCatalog, 'find'>,
    private readonly suites: Pick<SuiteCatalog, 'find'>,
    private readonly articles: Pick<ArticleCatalog, 'find'>,
    private readonly releases: Pick<ReleaseCatalog, 'find'>
  ) {}
  async confirm(items: ExploreItem[]) {
    for (const item of items) {
      if (item.target.kind !== 'release') continue;
      const app = await this.applications.find(item.target.applicationSlug);
      if (
        !app ||
        app.id !== item.target.applicationId ||
        app.classification !== item.classification ||
        JSON.stringify([
          ...new Set(app.categories.flatMap((c) => [c.id, c.slug])),
        ]) !== JSON.stringify(item.categories) ||
        JSON.stringify([
          ...new Set(app.tags.flatMap((t) => [t.id, t.slug])),
        ]) !== JSON.stringify(item.tags)
      )
        throw new ExploreUnavailableError('Release application changed');
    }
  }
  async read(candidate: ExplorePublicationCandidate, applicationId?: string) {
    const { kind, id, at } = candidate;
    let title: string,
      revision: number,
      categories: string[] = [],
      tags: string[] = [],
      classification: ContentClassification | undefined,
      target: unknown;
    if (kind === 'application') {
      const app = await this.applications.find(candidate.slug ?? '');
      if (!app || app.id !== id)
        throw new ExploreUnavailableError('Application changed');
      title = app.name;
      revision = app.revision;
      classification = app.classification;
      categories = app.categories.flatMap((c) => [c.id, c.slug]);
      tags = app.tags.flatMap((t) => [t.id, t.slug]);
      target = { kind, id, slug: app.slug };
    } else if (kind === 'suite') {
      const suite = await this.suites.find(id);
      if (applicationId && !suite.applicationIds.includes(applicationId))
        throw new ExploreUnavailableError('Suite membership changed');
      title = suite.title;
      revision = suite.revision;
      classification = suite.classification;
      target = { kind, id };
    } else if (kind === 'article') {
      const article = await this.articles.find(candidate.slug ?? '');
      if (article.id !== id)
        throw new ExploreUnavailableError('Article changed');
      title = article.title;
      revision = article.revision;
      classification = article.classification;
      categories = [article.category];
      tags = article.tags;
      target = { kind, id, slug: article.slug };
    } else {
      const release = await this.releases.find(
        candidate.applicationSlug ?? '',
        candidate.version ?? ''
      );
      const app = await this.applications.find(release.applicationSlug);
      if (release.id !== id || !app || app.id !== release.applicationId)
        throw new ExploreUnavailableError('Release changed');
      title = release.title;
      revision = release.revision;
      classification = app.classification;
      categories = app.categories.flatMap((c) => [c.id, c.slug]);
      tags = app.tags.flatMap((t) => [t.id, t.slug]);
      target = {
        kind,
        id,
        applicationId: app.id,
        applicationSlug: app.slug,
        version: release.version,
      };
    }
    const item = parseExploreItem({
      kind,
      id,
      at,
      title,
      target,
      categories: [...new Set(categories)],
      tags: [...new Set(tags)],
      engagement: null,
      ...classificationFields(classification),
    });
    if (applicationId && !isApplicationActivity(item, applicationId))
      throw new ExploreUnavailableError('Application activity changed');
    return {
      item,
      revision,
    };
  }
}
