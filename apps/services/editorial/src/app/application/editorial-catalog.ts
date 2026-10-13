import { classificationFields } from '@domains/publication/classification';
import type {
  CatalogApp,
  CatalogCategory,
  CatalogFacet,
  CatalogFacets,
  CatalogPage,
  CatalogReadQuery,
  CatalogSelection,
} from '@domains/catalog/record';
import {
  CatalogUnavailableError,
  catalogAppIds,
  catalogSlug,
  parseCatalogQuery,
} from '@domains/catalog/record';
import type { EditorialAppContent } from '@apps/shared';
import {
  EditorialProjectionStore,
  inspectEditorialProjection,
} from './editorial-materialization';

export interface CatalogAuthoritySnapshot {
  tenantId: string;
  records: { id: string; slug: string; revision: number | null }[];
  facets: CatalogFacets;
  total: number;
  page: number;
  pageSize: number;
  signature: string;
}

export interface CatalogAuthority {
  /** Bounded filtering/count/pagination and taxonomy from one authoritative SQL snapshot. */
  read(
    query: CatalogReadQuery,
    selector?: CatalogSelector
  ): Promise<CatalogAuthoritySnapshot>;
}

export type CatalogSelector = { slug: string } | { ids: string[] };

function references(ids: string[], values: CatalogFacet[]): CatalogFacet[] {
  const byId = new Map(values.map((item) => [item.id, item]));
  return ids.map((id) => {
    const value = byId.get(id);
    if (!value)
      throw new CatalogUnavailableError('Catalog reference is unavailable');
    return { id: value.id, slug: value.slug, name: value.name };
  });
}

export function catalogAncestry(
  id: string | null,
  categories: CatalogCategory[]
): CatalogFacet[] {
  const byId = new Map(categories.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const chain: CatalogFacet[] = [];
  let current = id;
  while (current !== null) {
    const category = byId.get(current);
    if (!category || seen.has(current) || chain.length >= 64)
      throw new CatalogUnavailableError('Invalid catalog category ancestry');
    seen.add(current);
    chain.push({ id: category.id, slug: category.slug, name: category.name });
    current = category.parentId;
  }
  return chain;
}

/** SQL owns eligibility. Materialized values are usable only at the currently authorized revision. */
export class EditorialCatalog {
  constructor(
    private readonly authority: CatalogAuthority,
    private readonly projections: Pick<EditorialProjectionStore, 'find'>
  ) {}

  browse(query: CatalogReadQuery): Promise<CatalogPage> {
    return this.read(query);
  }

  async visibility(input: string) {
    const ids = catalogAppIds([input]);
    try {
      const snapshot = await this.authority.read(
        parseCatalogQuery({ pageSize: '1' }),
        { ids }
      );
      const record = snapshot.records.find((record) => record.id === ids[0]);
      if (!record) return null;
      if (record.revision === null)
        throw new CatalogUnavailableError(
          'Catalog ownership backfill is pending'
        );
      return {
        id: record.id,
        tenantId: snapshot.tenantId,
        revision: record.revision,
      };
    } catch {
      throw new CatalogUnavailableError(
        'Application visibility authority is unavailable'
      );
    }
  }

  async facets(): Promise<CatalogFacets> {
    try {
      return (await this.authority.read(parseCatalogQuery({ pageSize: '1' })))
        .facets;
    } catch {
      throw new CatalogUnavailableError('Catalog taxonomy is unavailable');
    }
  }

  async find(slug: string): Promise<CatalogApp | null> {
    const result = await this.read(
      {
        search: '',
        categories: [],
        tags: [],
        platforms: [],
        devices: [],
        monetizations: [],
        sort: 'name',
        page: 1,
        pageSize: 1,
      },
      { slug: catalogSlug(slug) }
    );
    return result.items[0] ?? null;
  }

  async select(input: string[]): Promise<CatalogSelection> {
    const ids = catalogAppIds(input);
    const result = await this.read(
      parseCatalogQuery({ pageSize: String(ids.length) }),
      { ids }
    );
    const byId = new Map(result.items.map((app) => [app.id, app]));
    return {
      items: ids.flatMap((id) => {
        const app = byId.get(id);
        return app ? [app] : [];
      }),
    };
  }

  private async read(
    query: CatalogReadQuery,
    selector?: CatalogSelector
  ): Promise<CatalogPage> {
    try {
      const snapshot = await this.authority.read(query, selector);
      const items: CatalogApp[] = [];
      // Bound concurrent projection reads independently of the requested page size.
      for (let start = 0; start < snapshot.records.length; start += 10) {
        items.push(
          ...(await Promise.all(
            snapshot.records.slice(start, start + 10).map(async (record) => {
              if (record.revision === null)
                throw new CatalogUnavailableError(
                  'Catalog ownership backfill is pending'
                );
              const value = await this.projections.find('app', record.id);
              if (!value)
                throw new CatalogUnavailableError(
                  'Catalog projection is pending'
                );
              const projection = inspectEditorialProjection(value);
              if (
                projection.kind !== 'app' ||
                projection.resourceId !== record.id ||
                projection.tenantId !== snapshot.tenantId ||
                projection.revision !== record.revision ||
                projection.deletedAt !== null ||
                projection.content === null
              )
                throw new CatalogUnavailableError(
                  'Catalog projection revision is pending'
                );
              const content = projection.content as EditorialAppContent;
              if (content.isSuspended || content.slug !== record.slug)
                throw new CatalogUnavailableError(
                  'Catalog projection is unavailable'
                );
              return this.app(
                record.id,
                record.revision,
                content,
                snapshot.facets
              );
            })
          ))
        );
      }
      // A separate snapshot after projection I/O catches edits, deletions, tenant changes and taxonomy changes.
      const current = await this.authority.read(query, selector);
      if (current.signature !== snapshot.signature)
        throw new CatalogUnavailableError(
          'Catalog changed during reading; retry'
        );
      return {
        items,
        total: snapshot.total,
        page: snapshot.page,
        pageSize: snapshot.pageSize,
        totalPages: Math.max(1, Math.ceil(snapshot.total / snapshot.pageSize)),
        facets: snapshot.facets,
      };
    } catch (error) {
      if (error instanceof CatalogUnavailableError) throw error;
      throw new CatalogUnavailableError('Catalog dependencies are unavailable');
    }
  }

  private app(
    id: string,
    revision: number,
    content: EditorialAppContent,
    facets: CatalogFacets
  ): CatalogApp {
    const timestamp = (value: string) =>
      value.replace(' ', 'T').slice(0, 23) + 'Z';
    return {
      id,
      revision,
      slug: content.slug,
      name: content.name,
      description: content.description,
      website: content.website,
      logoUrl: content.logoUrl,
      bannerUrl: content.bannerUrl,
      isPwa: content.isPwa,
      estimatedNumberOfUsers: content.estimatedNumberOfUsers,
      createdAt: timestamp(content.createdAtSql),
      updatedAt: timestamp(content.updatedAtSql),
      categories: catalogAncestry(content.categoryId, facets.categories),
      tags: references(content.tagIds, facets.tags),
      platforms: references(content.platformIds, facets.platforms),
      devices: references(content.deviceIds, facets.devices),
      monetizations: references(
        content.monetizationModelIds,
        facets.monetizations
      ),
      reviews: null,
      ...classificationFields(content.classification),
    };
  }
}
