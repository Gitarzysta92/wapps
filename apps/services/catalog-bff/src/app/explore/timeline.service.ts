import { catalogSlug, type CatalogReadPort } from '@domains/catalog/record';
import {
  ExploreInputError,
  ExploreUnavailableError,
  TimelineMissingError,
  exploreCursor,
  mergeExplore,
  parseTimelinePage,
  type ExploreCursors,
  type ExploreSource,
} from '@domains/feed';

export class TimelineService {
  constructor(
    private readonly applications: Pick<CatalogReadPort, 'find'>,
    private readonly publications: ExploreSource,
    private readonly community: ExploreSource,
    private readonly cursors: (applicationId: string) => ExploreCursors
  ) {}
  async read(inputSlug: unknown, input: unknown) {
    let slug: string;
    try {
      slug = catalogSlug(inputSlug);
    } catch {
      throw new ExploreInputError('Invalid application');
    }
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some((key) => key !== 'after')
    )
      throw new ExploreInputError('Invalid timeline query');
    const token = exploreCursor((input as Record<string, unknown>)['after']);
    let app;
    try {
      app = await this.applications.find(slug);
    } catch {
      throw new ExploreUnavailableError(
        'Application is temporarily unavailable'
      );
    }
    if (!app) throw new TimelineMissingError('Application not found');
    const cursor = this.cursors(app.id),
      after = token ? cursor.open(token) : null;
    try {
      const batch = mergeExplore(
        await Promise.all([
          this.publications.read(after, undefined, app.id),
          this.community.read(after, undefined, app.id),
        ]),
        after
      );
      const current = await this.applications.find(slug);
      if (!current) throw new TimelineMissingError('Application not found');
      if (JSON.stringify(current) !== JSON.stringify(app))
        throw new ExploreUnavailableError(
          'Application changed while loading activity'
        );
      // The timeline context supplies the application's taxonomy to associated suites too.
      const categories = app.categories.flatMap((value) => [
        value.id,
        value.slug,
      ]);
      const tags = app.tags.flatMap((value) => [value.id, value.slug]);
      return parseTimelinePage({
        application: { id: app.id, slug: app.slug, name: app.name },
        items: batch.items.map((item) => ({
          ...item,
          categories: [...new Set([...item.categories, ...categories])],
          tags: [...new Set([...item.tags, ...tags])],
        })),
        after: batch.through ? cursor.seal(batch.through) : null,
      });
    } catch (error) {
      if (error instanceof TimelineMissingError) throw error;
      throw new ExploreUnavailableError(
        'Application activity is temporarily unavailable. Try again.'
      );
    }
  }
}
