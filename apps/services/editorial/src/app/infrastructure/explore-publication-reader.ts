import {
  parseExploreItem,
  isApplicationActivity,
  ExploreUnavailableError,
  type ExploreItem,
  type ActivityDetails,
  type ActivityApplication,
} from '@domains/feed';
import type { CatalogApp } from '@domains/catalog/record';
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
    private readonly applications: Pick<EditorialCatalog, 'find' | 'select'>,
    private readonly suites: Pick<SuiteCatalog, 'find'>,
    private readonly articles: Pick<ArticleCatalog, 'find'>,
    private readonly releases: Pick<ReleaseCatalog, 'find'>
  ) {}
  async confirm(items: ExploreItem[]) {
    for (const item of items) {
      if (item.details?.kind === 'suite') {
        const suite = await this.suites.find(item.id);
        const current = await this.suiteDetails(suite);
        if (JSON.stringify(current) !== JSON.stringify(item.details))
          throw new ExploreUnavailableError('Suite applications changed');
      }
      if (item.target.kind !== 'release') continue;
      const app = await this.applications.find(item.target.applicationSlug);
      if (
        !app ||
        (item.details?.kind === 'release' &&
          (item.details.applicationName !== app.name ||
            item.details.logoUrl !== app.logoUrl)) ||
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
      details: ActivityDetails,
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
      details = {
        kind,
        revision: app.revision,
        description: (app.description ?? '').slice(0, 1000),
        logoUrl: app.logoUrl,
        bannerUrl: app.bannerUrl,
        category: app.categories[0] ? this.tag(app.categories[0]) : null,
        tags: app.tags.map((tag) => this.tag(tag)),
        reviews: null,
      };
    } else if (kind === 'suite') {
      const suite = await this.suites.find(id);
      if (applicationId && !suite.applicationIds.includes(applicationId))
        throw new ExploreUnavailableError('Suite membership changed');
      title = suite.title;
      revision = suite.revision;
      classification = suite.classification;
      target = { kind, id };
      details = await this.suiteDetails(suite);
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
      details = {
        kind,
        byline: article.byline,
        excerpt: article.excerpt,
        category: article.category,
        publishedAt: article.publishedAt,
        cover: article.cover ?? null,
        tags: article.tags.map((name) => ({ name, slug: name })),
      };
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
      details = {
        kind,
        applicationName: app.name,
        logoUrl: app.logoUrl,
        description: release.description.slice(0, 1000),
        releasedOn: release.releasedOn,
        channel: release.channel,
        releaseType: release.type,
        changeCount: release.changes.length,
        changes: release.changes.slice(0, 5),
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
      details,
      ...classificationFields(classification),
    });
    if (applicationId && !isApplicationActivity(item, applicationId))
      throw new ExploreUnavailableError('Application activity changed');
    return {
      item,
      revision,
    };
  }
  private tag(value: { name: string; slug: string }) {
    return { name: value.name, slug: value.slug };
  }
  private preview(app: CatalogApp): ActivityApplication {
    return {
      id: app.id,
      slug: app.slug,
      name: app.name,
      description: (app.description ?? '').slice(0, 600),
      logoUrl: app.logoUrl,
      ...classificationFields(app.classification),
    };
  }
  private async suiteDetails(suite: {
    description: string;
    applicationIds: string[];
  }): Promise<Extract<ActivityDetails, { kind: 'suite' }>> {
    const ids = suite.applicationIds.slice(0, 4);
    const applications = ids.length
      ? (await this.applications.select(ids)).items.map((app) =>
          this.preview(app)
        )
      : [];
    return {
      kind: 'suite',
      description: suite.description,
      applicationCount: suite.applicationIds.length,
      applications,
    };
  }
}
