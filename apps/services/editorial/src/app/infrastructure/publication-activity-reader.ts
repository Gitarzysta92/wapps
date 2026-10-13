import { parseProfileActivity } from '@domains/customer/profiles';
import { SuiteUnavailableError } from '@domains/publication/suite';
import type { EditorialCatalog } from '../application/editorial-catalog';
import type {
  PublicationActivityCandidate,
  PublicationActivityReader,
} from '../application/profile-activity';
import type { SuiteCatalog } from '../suites/suite-catalog';
import type { ArticleCatalog } from '../articles/article-catalog';
import type { ReleaseCatalog } from '../releases/release-catalog';

export class CatalogPublicationActivityReader
  implements PublicationActivityReader
{
  constructor(
    private readonly applications: Pick<EditorialCatalog, 'find'>,
    private readonly suites: Pick<SuiteCatalog, 'find'>,
    private readonly articles: Pick<ArticleCatalog, 'find'>,
    private readonly releases: Pick<ReleaseCatalog, 'find'>
  ) {}
  async read(candidate: PublicationActivityCandidate) {
    const { kind, id, at } = candidate;
    let title: string, revision: number;
    let target: unknown;
    if (kind === 'application') {
      const app = await this.applications.find(candidate.slug ?? '');
      if (!app || app.id !== id || app.revision === null)
        throw new SuiteUnavailableError('Activity application changed');
      title = app.name;
      revision = app.revision;
      target = { kind, id, slug: app.slug };
    } else if (kind === 'suite') {
      const suite = await this.suites.find(id);
      title = suite.title;
      revision = suite.revision;
      target = { kind, id };
    } else if (kind === 'article') {
      const article = await this.articles.find(candidate.slug ?? '');
      if (article.id !== id)
        throw new SuiteUnavailableError('Activity article changed');
      title = article.title;
      revision = article.revision;
      target = { kind, id, slug: article.slug };
    } else {
      const release = await this.releases.find(
        candidate.applicationSlug ?? '',
        candidate.version ?? ''
      );
      if (release.id !== id)
        throw new SuiteUnavailableError('Activity release changed');
      title = release.title;
      revision = release.revision;
      target = {
        kind,
        id,
        applicationSlug: release.applicationSlug,
        version: release.version,
      };
    }
    return {
      activity: parseProfileActivity({ kind, id, at, title, target }),
      revision,
    };
  }
}
