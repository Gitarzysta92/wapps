import {
  parsePublishedRelease,
  parseReleaseBrowseFilter,
  releaseVersion,
  ReleaseInputError,
  ReleaseNotFoundError,
  ReleaseUnavailableError,
  type PublishedRelease,
  type ReleaseBrowseFilter,
} from '@domains/catalog/versioning';
import {
  inspectEditorialProjection,
  type EditorialProjectionStore,
} from '../application/editorial-materialization';

export type ReleaseCatalogQuery = { applicationSlug: string } & (
  | ({ page: number } & ReleaseBrowseFilter)
  | { version: string }
);
export interface ReleaseCatalogSelection {
  tenantId: string;
  application: { id: string; slug: string; name: string; revision: number };
  total: number;
  items: {
    id: string;
    version: string;
    revision: number;
    publishedAt: number;
  }[];
}
export interface ReleaseCatalogAuthority {
  select(query: ReleaseCatalogQuery): Promise<ReleaseCatalogSelection>;
}

export class ReleaseCatalog {
  constructor(
    private readonly authority: ReleaseCatalogAuthority,
    private readonly projections: Pick<EditorialProjectionStore, 'find'>
  ) {}
  async browse(
    applicationSlug: string,
    page: number,
    filter: ReleaseBrowseFilter = {}
  ) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      throw new ReleaseInputError('Invalid release page');
    const result = await this.read({
      applicationSlug: this.slug(applicationSlug),
      page,
      ...parseReleaseBrowseFilter(filter),
    });
    return { ...result, page };
  }
  async find(applicationSlug: string, version: string) {
    const result = await this.read({
      applicationSlug: this.slug(applicationSlug),
      version: releaseVersion(version),
    });
    if (!result.items[0]) throw new ReleaseNotFoundError('Release not found');
    return result.items[0];
  }
  private slug(value: string) {
    if (
      typeof value !== 'string' ||
      value.length > 255 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
    )
      throw new ReleaseInputError('Invalid application slug');
    return value;
  }
  private async read(query: ReleaseCatalogQuery) {
    try {
      const selected = await this.authority.select(query);
      const items: PublishedRelease[] = [];
      for (let offset = 0; offset < selected.items.length; offset += 10) {
        items.push(
          ...(await Promise.all(
            selected.items.slice(offset, offset + 10).map(async (expected) => {
              const projection = inspectEditorialProjection(
                await this.projections.find('release', expected.id)
              );
              const content = projection.content;
              if (
                projection.kind !== 'release' ||
                projection.resourceId !== expected.id ||
                projection.tenantId !== selected.tenantId ||
                projection.revision !== expected.revision ||
                projection.deletedAt !== null ||
                !content ||
                !('version' in content) ||
                content.version !== expected.version ||
                content.applicationId !== selected.application.id ||
                content.publishedAt !== expected.publishedAt
              )
                throw new ReleaseUnavailableError(
                  'Release publication is updating. Try again shortly.'
                );
              return parsePublishedRelease({
                ...content,
                id: expected.id,
                revision: expected.revision,
                applicationSlug: selected.application.slug,
                applicationName: selected.application.name,
              });
            })
          ))
        );
      }
      if (
        JSON.stringify(await this.authority.select(query)) !==
        JSON.stringify(selected)
      )
        throw new ReleaseUnavailableError(
          'Release publication changed while loading. Try again.'
        );
      return { items, total: selected.total };
    } catch (error) {
      if (
        error instanceof ReleaseNotFoundError ||
        error instanceof ReleaseUnavailableError
      )
        throw error;
      throw new ReleaseUnavailableError(
        'Release catalog is unavailable. Try again shortly.'
      );
    }
  }
}
